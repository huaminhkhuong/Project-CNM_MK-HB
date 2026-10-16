from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Ensure console supports utf-8 in Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("Crawler")


class BaseCrawler:
    def __init__(
        self,
        name: str,
        base_url: str,
        headers: Optional[Dict[str, str]] = None,
        delay: float = 1.0,
        timeout: int = 15,
        download_images: bool = False,
    ):
        self.name = name
        self.base_url = base_url
        self.delay = delay
        self.timeout = timeout
        self.download_images = download_images

        self.session = requests.Session()
        if headers:
            self.session.headers.update(headers)

        retries = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retries)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def fetch(self, url: str) -> Optional[requests.Response]:
        """Fetch a URL with polite delay and error handling."""
        time.sleep(self.delay)
        try:
            resp = self.session.get(url, timeout=self.timeout)
            if resp.status_code == 200:
                return resp
            logger.warning(f"[{self.name}] Non-200 status {resp.status_code} for URL: {url}")
            return None
        except Exception as e:
            logger.error(f"[{self.name}] Error fetching {url}: {e}")
            return None

    @staticmethod
    def clean_text(text: Optional[str]) -> str:
        """Strip redundant whitespace, newlines, and non-breaking spaces."""
        if not text:
            return ""
        cleaned = text.replace("\xa0", " ").replace("\u200b", "").strip()
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned

    @staticmethod
    def parse_price(text: Optional[str]) -> Optional[int]:
        """Extract numeric price from string, e.g. '4.399.000 đ' -> 4399000."""
        if not text:
            return None
        digits = re.sub(r"[^\d]", "", text)
        if digits:
            try:
                val = int(digits)
                return val if val > 1000 else None
            except ValueError:
                return None
        return None

    @staticmethod
    def extract_slug(url: str) -> str:
        """Extract clean product slug from URL."""
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        filename = path.split("/")[-1]
        slug = re.sub(r"\.html?$", "", filename)
        return slug or "product"

    def download_image_file(self, img_url: str, save_path: Path) -> bool:
        """Download an image URL directly to disk."""
        try:
            save_path.parent.mkdir(parents=True, exist_ok=True)
            if save_path.exists() and save_path.stat().st_size > 0:
                return True
            resp = self.session.get(img_url, timeout=self.timeout, stream=True)
            if resp.status_code == 200:
                with open(save_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                return True
        except Exception as e:
            logger.debug(f"Failed to download image {img_url}: {e}")
        return False

    def download_images_parallel(self, items: List[Tuple[str, Path, str]]) -> List[str]:
        """Download list of (img_url, save_path, rel_path) in parallel using thread pool."""
        if not items:
            return []
        successful_paths = set()
        with ThreadPoolExecutor(max_workers=6) as executor:
            future_to_item = {
                executor.submit(self.download_image_file, url, path): (path, rel)
                for url, path, rel in items
            }
            for future in as_completed(future_to_item):
                path, rel = future_to_item[future]
                try:
                    if future.result():
                        successful_paths.add(path)
                except Exception:
                    pass

        # Return ordered rel_paths
        return [rel for _, path, rel in items if path in successful_paths]

    def save_outputs(
        self,
        products: List[Dict[str, Any]],
        output_name: str,
        json_dir: Path,
        csv_dir: Path,
    ):
        """Export products to both JSON and CSV files."""
        if not products:
            logger.warning(f"No products to export for {output_name}")
            return

        json_path = json_dir / f"{output_name}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved {len(products)} products to JSON: {json_path}")

        # Flatten for CSV
        csv_path = csv_dir / f"{output_name}.csv"
        # Common spec keys to promote to direct columns
        promoted_spec_keys = [
            "Socket", "Hãng sản xuất", "Thương hiệu", "Model", "Dung lượng",
            "Chuẩn kết nối", "Bảo hành", "Bộ nhớ", "Tốc độ", "Công suất", "Kích thước"
        ]

        fieldnames = [
            "id", "site", "category", "name", "slug", "brand",
            "price", "price_formatted", "original_price", "url",
            "thumbnail", "images_count", "images", "local_images",
        ] + [f"spec_{k}" for k in promoted_spec_keys] + ["all_specifications_json"]

        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for p in products:
                specs = p.get("specifications", {})
                row = {
                    "id": p.get("id", ""),
                    "site": p.get("site", ""),
                    "category": p.get("category", ""),
                    "name": p.get("name", ""),
                    "slug": p.get("slug", ""),
                    "brand": p.get("brand", ""),
                    "price": p.get("price", ""),
                    "price_formatted": p.get("price_formatted", ""),
                    "original_price": p.get("original_price", ""),
                    "url": p.get("url", ""),
                    "thumbnail": p.get("thumbnail", ""),
                    "images_count": len(p.get("images", [])),
                    "images": "; ".join(p.get("images", [])),
                    "local_images": "; ".join(p.get("local_images", [])),
                    "all_specifications_json": json.dumps(specs, ensure_ascii=False),
                }
                for k in promoted_spec_keys:
                    # Match case-insensitively
                    val = ""
                    for sk, sv in specs.items():
                        if k.lower() in sk.lower():
                            val = sv
                            break
                    row[f"spec_{k}"] = val
                writer.writerow(row)
        logger.info(f"Saved {len(products)} products to CSV: {csv_path}")
