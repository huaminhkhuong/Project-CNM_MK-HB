import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
JSON_DIR = DATA_DIR / "json"
CSV_DIR = DATA_DIR / "csv"
IMAGES_DIR = DATA_DIR / "images"

for d in [JSON_DIR, CSV_DIR, IMAGES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Common HTTP Headers
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
}

# Site Configurations
ANPHAT_CONFIG = {
    "name": "anphat",
    "base_url": "https://www.anphatpc.com.vn",
    "categories": {
        "cpu": "/cpu-bo-vi-xu-ly.html",
        "mainboard": "/mainboard-bo-mach-chu.html",
        "ram": "/ram-bo-nho-trong.html",
        "vga": "/vga-card-man-hinh.html",
        "ssd": "/o-cung-the-ran-ssd.html",
        "psu": "/nguon-may-tinh.html",
        "case": "/vo-case-may-tinh.html",
        "cooling": "/tan-nhiet-cooling.html",
    },
}

HACOM_CONFIG = {
    "name": "hacom",
    "base_url": "https://hacom.vn",
    "categories": {
        "cpu": "/cpu-bo-vi-xu-ly",
        "mainboard": "/mainboard-bo-mach-chu",
        "ram": "/ram-bo-nho-trong",
        "vga": "/vga-card-man-hinh",
        "ssd": "/o-cung-ssd",
        "psu": "/nguon-may-tinh",
        "case": "/vo-case",
        "cooling": "/tan-nhiet-khi-cho-cpu",
    },
}


# Crawler execution settings
REQUEST_TIMEOUT = 15
REQUEST_DELAY = 1.0  # seconds between requests to be polite
MAX_RETRIES = 3
