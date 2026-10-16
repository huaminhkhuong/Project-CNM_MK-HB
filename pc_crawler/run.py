import argparse
import logging
import sys
from pathlib import Path
from typing import List, Dict, Any

from config import CSV_DIR, JSON_DIR, ANPHAT_CONFIG, HACOM_CONFIG
from crawler import AnPhatCrawler, HacomCrawler

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
logger = logging.getLogger("Main")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Standalone PC Components Web Crawler for An Phat PC and HACOM"
    )
    parser.add_argument(
        "--site",
        choices=["anphat", "hacom", "all"],
        default="all",
        help="Site to crawl: anphat, hacom, or all (default: all)",
    )
    parser.add_argument(
        "--category",
        default="cpu",
        help="Category to crawl (cpu, mainboard, ram, vga, ssd, psu, case, cooling, or all). Default: cpu",
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=1,
        help="Number of pagination pages to crawl per category (default: 1)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Limit number of products to crawl per category (default: 5). Set to 0 for unlimited.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay in seconds between requests (default: 1.0)",
    )
    parser.add_argument(
        "--no-images",
        action="store_true",
        help="Skip downloading images (by default, images are automatically downloaded to data/images/ and linked into the JSON)",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    limit = args.limit if args.limit > 0 else None
    download_images = not args.no_images

    # Determine sites to run
    sites = ["anphat", "hacom"] if args.site == "all" else [args.site]

    # Determine categories
    valid_categories = list(ANPHAT_CONFIG["categories"].keys())
    if args.category == "all":
        categories = valid_categories
    else:
        req_cat = args.category.lower()
        if req_cat not in valid_categories:
            logger.error(f"Unknown category '{req_cat}'. Valid options: {valid_categories}")
            sys.exit(1)
        categories = [req_cat]

    print("\n" + "=" * 60)
    print("  PC HARDWARE WEB CRAWLER (STANDALONE)")
    print(f"  Sites: {', '.join(sites)}")
    print(f"  Categories: {', '.join(categories)}")
    print(f"  Limit per category: {limit or 'Unlimited'}")
    print(f"  Pages per category: {args.pages}")
    print(f"  Download Images: {download_images}")
    print("=" * 60 + "\n")

    all_crawled_products: List[Dict[str, Any]] = []

    for site_name in sites:
        if site_name == "anphat":
            crawler = AnPhatCrawler(
                delay=args.delay,
                download_images=download_images,
            )
        else:
            crawler = HacomCrawler(
                delay=args.delay,
                download_images=download_images,
            )


        for cat in categories:
            logger.info(f"\n--- Starting [{site_name.upper()}] - Category: [{cat.upper()}] ---")
            cat_products = crawler.crawl_category(
                category=cat,
                max_pages=args.pages,
                limit=limit,
            )

            if cat_products:
                out_name = f"{site_name}_{cat}"
                crawler.save_outputs(
                    products=cat_products,
                    output_name=out_name,
                    json_dir=JSON_DIR,
                    csv_dir=CSV_DIR,
                )
                all_crawled_products.extend(cat_products)

    # Save aggregated files if we crawled multiple sets
    if len(all_crawled_products) > 0 and (len(sites) > 1 or len(categories) > 1):
        agg_names = ["all_pc_components"]
        if len(sites) == 1:
            agg_names.append(f"{sites[0]}_pc_components_all")

        for agg_name in agg_names:
            crawler.save_outputs(
                products=all_crawled_products,
                output_name=agg_name,
                json_dir=JSON_DIR,
                csv_dir=CSV_DIR,
            )


    print("\n" + "=" * 60)
    print("  CRAWLING COMPLETED SUCCESSFULLY!")
    print(f"  Total products extracted: {len(all_crawled_products)}")
    print(f"  JSON output directory: {JSON_DIR.resolve()}")
    print(f"  CSV output directory:  {CSV_DIR.resolve()}")
    if download_images:
        print(f"  Images directory:      {(JSON_DIR.parent / 'images').resolve()}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
