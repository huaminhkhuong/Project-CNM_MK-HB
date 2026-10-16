import base64
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from config import BASE_DIR, DATA_DIR, DEFAULT_HEADERS, HACOM_CONFIG, IMAGES_DIR, REQUEST_DELAY, REQUEST_TIMEOUT
from .base import BaseCrawler

logger = logging.getLogger("Crawler.Hacom")


class HacomCrawler(BaseCrawler):
    def __init__(
        self,
        delay: float = REQUEST_DELAY,
        timeout: int = REQUEST_TIMEOUT,
        download_images: bool = False,
    ):
        super().__init__(
            name="hacom",
            base_url=HACOM_CONFIG["base_url"],
            headers=DEFAULT_HEADERS,
            delay=delay,
            timeout=timeout,
            download_images=download_images,
        )
        self.categories = HACOM_CONFIG["categories"]

    def get_product_urls(self, category: str, max_pages: int = 1) -> List[str]:
        """Collect product URLs from category pagination."""
        cat_path = self.categories.get(category.lower())
        if not cat_path:
            logger.error(f"[Hacom] Unknown category '{category}'. Available: {list(self.categories.keys())}")
            return []

        product_urls: List[str] = []
        for page in range(1, max_pages + 1):
            page_url = f"{self.base_url}{cat_path}?page={page}"
            logger.info(f"[Hacom] Fetching listing page {page}: {page_url}")
            resp = self.fetch(page_url)
            if not resp:
                break

            soup = BeautifulSoup(resp.text, "lxml")
            items = soup.select(".p-item, .product-item, .item")
            if not items:
                logger.info(f"[Hacom] No items found with selector on page {page}")
                break

            page_links = 0
            for item in items:
                a_tag = item.select_one("a.p-img, a[href]")
                if a_tag and a_tag.get("href"):
                    href = a_tag.get("href").strip()
                    # Filter out category page itself or anchors
                    if href == cat_path or href.startswith("#") or "javascript:" in href:
                        continue
                    full_url = urljoin(self.base_url, href)
                    if full_url not in product_urls and full_url != page_url:
                        product_urls.append(full_url)
                        page_links += 1

            logger.info(f"[Hacom] Found {page_links} products on page {page}")

        return product_urls

    @staticmethod
    def decode_cdn_image(src: str) -> str:
        """Decode base64 encoded high-res image URL from HACOM transformations CDN."""
        if "cdn-transformations.hacom.vn" in src:
            parts = src.split("/")
            b64_part = parts[-1].replace(".webp", "")
            try:
                padded = b64_part + "=" * (-len(b64_part) % 4)
                decoded = base64.b64decode(padded).decode("utf-8", errors="ignore")
                if decoded.startswith("http"):
                    return decoded
            except Exception:
                pass
        return src

    def parse_product(self, url: str, category: str) -> Optional[Dict[str, Any]]:
        """Extract full details, specs, and images from HACOM product page."""
        logger.info(f"[Hacom] Parsing product: {url}")
        resp = self.fetch(url)
        if not resp:
            return None

        soup = BeautifulSoup(resp.text, "lxml")

        # 1. Product Title
        h1 = soup.find("h1")
        title = self.clean_text(h1.text) if h1 else ""
        if not title:
            logger.warning(f"[Hacom] No title found for {url}")
            return None

        slug = self.extract_slug(url)

        # 2. Extract Product ID
        product_id = slug
        sku_el = soup.find(text=re.compile(r"Mã SP:", re.IGNORECASE))
        if sku_el and sku_el.parent:
            sku_text = self.clean_text(sku_el.parent.text).replace("Mã SP:", "").strip()
            if sku_text:
                product_id = sku_text

        # 3. Prices
        price: Optional[int] = None
        price_str = ""
        # Search for price element with currency
        for s in soup.find_all(["span", "div", "b", "strong"]):
            t = self.clean_text(s.text)
            if ("đ" in t or "₫" in t) and any(c.isdigit() for c in t) and len(t) <= 25:
                if not any(skip in t.lower() for skip in ["tiết kiệm", "giảm", "vat", "trả góp"]):
                    val = self.parse_price(t)
                    if val and val > 10000:
                        price = val
                        price_str = t
                        break

        # Old / original price
        original_price: Optional[int] = None
        old_price_el = soup.select_one(".line-through, .old-price, del")
        if old_price_el:
            original_price = self.parse_price(old_price_el.text)

        # 4. Specifications Table
        specs: Dict[str, str] = {}
        for tr in soup.find_all("tr"):
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
                            "thông số cơ bản",
                            "xem thêm",
                            "khuyến mãi",
                            "quà tặng",
                        ]
                    )
                ):
                    specs[k] = v

        # 5. Brand detection
        brand = specs.get("Thương hiệu") or specs.get("Hãng sản xuất") or ""
        if not brand:
            known_brands = [
                "Intel", "AMD", "ASUS", "MSI", "Gigabyte", "Kingston",
                "Corsair", "Samsung", "Western Digital", "WD", "Seagate",
                "Deepcool", "Thermalright", "Noctua", "NZXT", "Lian Li",
                "Seasonic", "Cooler Master", "Xigmatek", "Colorful",
                "Zotac", "Inno3D", "Palit", "Galax", "Crucial"
            ]
            for b in known_brands:
                if re.search(rf"\b{b}\b", title, re.IGNORECASE):
                    brand = b
                    break

        # 6. Images Extraction (Description images + Gallery)
        images: List[str] = []

        # (a) High-res images in product detail description / static container
        desc_container = soup.select_one("#seo-product-detail-static, #mota, .content-detail, .detail-info-content")
        if desc_container:
            for img in desc_container.find_all("img"):
                src = img.get("data-src") or img.get("src") or ""
                decoded = self.decode_cdn_image(src)
                if (
                    decoded
                    and not any(skip in decoded.lower() for skip in ["logo", "icon", "banner", "map", "dvt", "avatar"])
                    and any(ext in decoded.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"])
                ):
                    if decoded not in images:
                        images.append(decoded)

        # (b) Images in product gallery sliders
        for img in soup.select(".product-gallery img, .p-detail-slider img, #slider-for img, .swiper-slide img"):
            src = img.get("data-src") or img.get("src") or ""
            decoded = self.decode_cdn_image(src)
            if (
                decoded
                and "hanoicomptercdn" in decoded
                or "hacom.vn" in decoded
            ):
                if not any(skip in decoded.lower() for skip in ["logo", "icon", "banner", "map", "avatar", "dvt"]):
                    if decoded not in images:
                        images.append(decoded)

        thumbnail = images[0] if images else ""

        # 7. Download Images if requested
        local_images: List[str] = []
        source_image_urls = list(images)
        if self.download_images and images:
            product_img_dir = IMAGES_DIR / "hacom" / category / slug
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
            "id": f"hacom_{product_id}",
            "site": "hacom",
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
        logger.info(f"[Hacom] Crawling {len(urls)} products for category '{category}'...")

        for idx, url in enumerate(urls, 1):
            try:
                data = self.parse_product(url, category)
                if data:
                    results.append(data)
                    logger.info(f"[Hacom] [{idx}/{len(urls)}] Extracted: {data['name'][:50]}... ({len(data['specifications'])} specs, {len(data['images'])} imgs)")
            except Exception as e:
                logger.error(f"[Hacom] Failed parsing {url}: {e}")

        return results
