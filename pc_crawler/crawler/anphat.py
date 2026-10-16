import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from config import ANPHAT_CONFIG, BASE_DIR, DATA_DIR, DEFAULT_HEADERS, IMAGES_DIR, REQUEST_DELAY, REQUEST_TIMEOUT
from .base import BaseCrawler

logger = logging.getLogger("Crawler.AnPhat")


class AnPhatCrawler(BaseCrawler):
    def __init__(
        self,
        delay: float = REQUEST_DELAY,
        timeout: int = REQUEST_TIMEOUT,
        download_images: bool = False,
    ):
        super().__init__(
            name="anphat",
            base_url=ANPHAT_CONFIG["base_url"],
            headers=DEFAULT_HEADERS,
            delay=delay,
            timeout=timeout,
            download_images=download_images,
        )
        self.categories = ANPHAT_CONFIG["categories"]

    def get_product_urls(self, category: str, max_pages: int = 1) -> List[str]:
        """Collect product URLs from category pagination."""
        cat_path = self.categories.get(category.lower())
        if not cat_path:
            logger.error(f"[AnPhat] Unknown category '{category}'. Available: {list(self.categories.keys())}")
            return []

        product_urls: List[str] = []
        for page in range(1, max_pages + 1):
            page_url = f"{self.base_url}{cat_path}?page={page}"
            logger.info(f"[AnPhat] Fetching listing page {page}: {page_url}")
            resp = self.fetch(page_url)
            if not resp:
                break

            soup = BeautifulSoup(resp.text, "lxml")
            items = soup.select(".p-item, .product-item")
            if not items:
                logger.info(f"[AnPhat] No more items found on page {page}")
                break

            page_links = 0
            for item in items:
                a_tag = item.select_one("a.p-img, a[href*='.html']")
                if a_tag and a_tag.get("href"):
                    href = a_tag.get("href").strip()
                    full_url = urljoin(self.base_url, href)
                    if full_url not in product_urls and full_url.endswith(".html"):
                        product_urls.append(full_url)
                        page_links += 1

            logger.info(f"[AnPhat] Found {page_links} products on page {page}")

        return product_urls

    def parse_product(self, url: str, category: str) -> Optional[Dict[str, Any]]:
        """Extract full details, specs, and images from product page."""
        logger.info(f"[AnPhat] Parsing product: {url}")
        resp = self.fetch(url)
        if not resp:
            return None

        soup = BeautifulSoup(resp.text, "lxml")

        # 1. Product Title
        h1 = soup.find("h1")
        title = self.clean_text(h1.text) if h1 else ""
        if not title:
            logger.warning(f"[AnPhat] No title found for {url}")
            return None

        slug = self.extract_slug(url)

        # 2. Extract Product ID
        pid_match = (
            re.search(r"_id(\d+)\.html", url)
            or re.search(r"productId\s*=\s*['\"]?(\d+)", resp.text)
            or re.search(r"media/product/\d+_(\d+)_", resp.text)
        )
        product_id = pid_match.group(1) if pid_match else slug

        # 3. Prices
        price_el = soup.select_one(".js-p-price, .p-price, .fs-dtprice")
        price_str = self.clean_text(price_el.text) if price_el else ""
        price = self.parse_price(price_str)

        old_price_el = soup.select_one(".p-oldprice, .original-price, .old-price")
        original_price = self.parse_price(old_price_el.text) if old_price_el else None

        # 4. Specifications Table
        specs: Dict[str, str] = {}
        # Priority 1: dedicated #pro-spec container
        spec_containers = soup.select("#pro-spec, #tab-specs, .pro-spec, .tbl-technical")
        search_roots = spec_containers if spec_containers else [soup]

        for root in search_roots:
            for tr in root.find_all("tr"):
                cols = tr.find_all(["td", "th"])
                if len(cols) == 2:
                    k = self.clean_text(cols[0].text)
                    v = self.clean_text(cols[1].text)
                    if (
                        k
                        and v
                        and len(k) < 60
                        and not any(
                            skip in k.lower()
                            for skip in [
                                "đánh giá",
                                "tên đầy đủ",
                                "email",
                                "điện thoại",
                                "gửi ảnh",
                                "giá niêm yết",
                                "giá khuyến mại",
                            ]
                        )
                    ):
                        specs[k] = v

        # Fallback to general tables if #pro-spec was not found
        if not specs:
            for tr in soup.find_all("tr"):
                cols = tr.find_all(["td", "th"])
                if len(cols) == 2:
                    k = self.clean_text(cols[0].text)
                    v = self.clean_text(cols[1].text)
                    if k and v and len(k) < 60 and not any(skip in k.lower() for skip in ["đánh giá", "bình luận", "email", "điện thoại", "khuyến mại"]):
                        specs[k] = v

        # 5. Brand detection
        brand = specs.get("Hãng sản xuất") or specs.get("Thương hiệu") or ""
        if not brand:
            # Detect from title
            known_brands = [
                "Intel", "AMD", "ASUS", "MSI", "Gigabyte", "Kingston",
                "Corsair", "Samsung", "Western Digital", "WD", "Seagate",
                "Deepcool", "Thermalright", "Noctua", "NZXT", "Lian Li",
                "Seasonic", "Corsair", "Cooler Master", "Acrox", "Xigmatek",
                "Colorful", "Zotac", "Inno3D", "Palit", "Galax", "Crucial"
            ]
            for b in known_brands:
                if re.search(rf"\b{b}\b", title, re.IGNORECASE):
                    brand = b
                    break

        # 6. Images Extraction (Main Gallery + Description Images)
        images: List[str] = []

        # (a) Main gallery images (high-res by removing thumbnail prefixes)
        for img in soup.find_all("img"):
            src = img.get("data-src") or img.get("src") or ""
            if "media/product/" in src:
                # Filter images related to this product ID or item holder
                if product_id and f"_{product_id}_" in src or "item-holder" in str(img.parent):
                    full_res = re.sub(r"/(250|75|50|100)_", "/", src)
                    full_res_url = urljoin(self.base_url, full_res)
                    if full_res_url not in images:
                        images.append(full_res_url)

        # (b) Description article images
        desc_container = soup.select_one("#pro-desc, #tab-content, .content-detail, #content-detail")
        if desc_container:
            for img in desc_container.find_all("img"):
                src = img.get("data-src") or img.get("src") or ""
                if src and not any(skip in src.lower() for skip in ["icon", "banner", "logo", "gif"]):
                    full_url = urljoin(self.base_url, src)
                    if full_url not in images:
                        images.append(full_url)

        # Fallback: any product image with extension
        if not images:
            for a in soup.select("a.fancybox, a[data-fancybox]"):
                href = a.get("href", "")
                if any(ext in href.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                    full_url = urljoin(self.base_url, href)
                    if full_url not in images:
                        images.append(full_url)

        thumbnail = images[0] if images else ""

        # 7. Download Images if requested
        local_images: List[str] = []
        source_image_urls = list(images)
        if self.download_images and images:
            product_img_dir = IMAGES_DIR / "anphat" / category / slug
            download_items = []
            for idx, img_url in enumerate(images, 1):
                ext = Path(img_url.split("?")[0]).suffix or ".jpg"
                save_file = product_img_dir / f"image_{idx:02d}{ext}"
                rel_path = save_file.relative_to(BASE_DIR).as_posix()
                download_items.append((img_url, save_file, rel_path))

            local_images = self.download_images_parallel(download_items)


        final_thumbnail = local_images[0] if local_images else thumbnail
        final_images = local_images if local_images else images

        return {
            "id": f"anphat_{product_id}",
            "site": "anphat",
            "category": category,
            "product_id": str(product_id),
            "name": title,
            "slug": slug,
            "brand": brand,
            "price": price,
            "price_formatted": price_str,
            "original_price": original_price,
            "url": url,
            "thumbnail": final_thumbnail,
            "images": final_images,
            "source_image_urls": source_image_urls,
            "local_images": local_images,
            "specifications": specs,
            "specifications_count": len(specs),
            "crawled_at": datetime.now().isoformat(),
        }

    def crawl_category(
        self, category: str, max_pages: int = 1, limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Crawl products for a category."""
        urls = self.get_product_urls(category, max_pages=max_pages)
        if limit and limit > 0:
            urls = urls[:limit]

        results: List[Dict[str, Any]] = []
        logger.info(f"[AnPhat] Crawling {len(urls)} products for category '{category}'...")

        for idx, url in enumerate(urls, 1):
            try:
                data = self.parse_product(url, category)
                if data:
                    results.append(data)
                    logger.info(f"[AnPhat] [{idx}/{len(urls)}] Extracted: {data['name'][:50]}... ({len(data['specifications'])} specs, {len(data['images'])} imgs)")
            except Exception as e:
                logger.error(f"[AnPhat] Failed parsing {url}: {e}")

        return results
