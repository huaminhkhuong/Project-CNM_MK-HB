import csv
import json
import os
import re
import shutil
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
JSON_DIR = DATA_DIR / "json"
CSV_DIR = DATA_DIR / "csv"
IMAGES_DIR = DATA_DIR / "images"

CATEGORIES = ["cpu", "mainboard", "ram", "vga", "ssd", "psu", "case", "cooling"]


def clean_text_hacom(text: str) -> str:
    """Replace occurrences of HACOM with generic/pro branding."""
    if not isinstance(text, str):
        return text
    # Replace HACOM -> PRO or remove
    res = re.sub(r"\bHACOM\b", "PRO", text)
    res = re.sub(r"\bhacom\b", "pro", res)
    return res


def sanitize_product(item: dict) -> dict:
    """Clean all branding and references to third-party sources."""
    cat = item.get("category", "")
    old_slug = item.get("slug", "")
    clean_slug = clean_text_hacom(old_slug)

    # Clean name and brand
    name = clean_text_hacom(item.get("name", ""))
    brand = item.get("brand", "")
    if brand.upper() == "HACOM":
        brand = "PRO"

    # Clean specifications
    clean_specs = {}
    for k, v in item.get("specifications", {}).items():
        ck = clean_text_hacom(str(k))
        cv = clean_text_hacom(str(v))
        clean_specs[ck] = cv

    # Clean image paths: data/images/hacom -> data/images/products
    def clean_img_path(p: str) -> str:
        if not p:
            return ""
        # replace hacom directory with products
        p = p.replace("data/images/hacom/", "data/images/products/")
        p = p.replace("data/images/hacom\\", "data/images/products/")
        p = p.replace("images/hacom/", "data/images/products/")
        # replace slug if changed
        if old_slug and old_slug != clean_slug:
            p = p.replace(old_slug, clean_slug)
        return p.replace("\\", "/")

    thumbnail = clean_img_path(item.get("thumbnail", ""))
    images = [clean_img_path(img) for img in item.get("images", [])]

    # Generate custom uniform ID
    product_id = f"pc_{cat}_{clean_slug}"

    cleaned = {
        "id": product_id,
        "sku": product_id.upper().replace("-", "_"),
        "category": cat,
        "name": name,
        "slug": clean_slug,
        "brand": brand,
        "price": item.get("price"),
        "price_formatted": item.get("price_formatted"),
        "original_price": item.get("original_price"),
        "url": f"/products/{clean_slug}",
        "thumbnail": thumbnail,
        "images": images,
        "images_count": len(images),
        "specifications": clean_specs,
        "specifications_count": len(clean_specs),
        "created_at": item.get("crawled_at"),
    }
    return cleaned


def save_csv(products, csv_path):
    """Save clean products to CSV with UTF-8 BOM."""
    promoted_spec_keys = [
        "Socket", "Hãng sản xuất", "Thương hiệu", "Model", "Dung lượng",
        "Chuẩn kết nối", "Bảo hành", "Bộ nhớ", "Tốc độ", "Công suất", "Kích thước"
    ]

    fieldnames = [
        "id", "sku", "category", "name", "slug", "brand",
        "price", "price_formatted", "original_price", "url",
        "thumbnail", "images_count", "images",
    ] + [f"spec_{k}" for k in promoted_spec_keys] + ["all_specifications_json"]

    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for p in products:
            specs = p.get("specifications", {})
            row = {
                "id": p.get("id", ""),
                "sku": p.get("sku", ""),
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
                "all_specifications_json": json.dumps(specs, ensure_ascii=False),
            }
            for k in promoted_spec_keys:
                val = ""
                for sk, sv in specs.items():
                    if k.lower() in sk.lower():
                        val = sv
                        break
                row[f"spec_{k}"] = val
            writer.writerow(row)


def main():
    print("=" * 60)
    print("  SANITIZING & PERSONALIZING PC HARDWARE DATASET")
    print("=" * 60)

    # 1. Rename images directory: data/images/hacom -> data/images/products
    hacom_img_dir = IMAGES_DIR / "hacom"
    products_img_dir = IMAGES_DIR / "products"

    if hacom_img_dir.exists():
        if products_img_dir.exists():
            shutil.rmtree(products_img_dir)
        hacom_img_dir.rename(products_img_dir)
        print(f"[OK] Renamed image directory: {hacom_img_dir.name} -> {products_img_dir.name}")

    # Remove anphat image dir if present to keep dataset purely clean
    anphat_img_dir = IMAGES_DIR / "anphat"
    if anphat_img_dir.exists():
        shutil.rmtree(anphat_img_dir)
        print("[OK] Removed old temporary test image directory")

    # Rename any subfolders in products/case with 'hacom' in name
    case_dir = products_img_dir / "case"
    if case_dir.exists():
        for d in list(case_dir.iterdir()):
            if d.is_dir() and "hacom" in d.name.lower():
                new_name = clean_text_hacom(d.name)
                new_d = case_dir / new_name
                if not new_d.exists():
                    d.rename(new_d)
                    print(f"[OK] Renamed case subfolder: {d.name} -> {new_name}")

    # 2. Process all categories
    all_clean_products = []

    for cat in CATEGORIES:
        # Load from hacom_<cat>.json or <cat>.json
        src_file = JSON_DIR / f"hacom_{cat}.json"
        if not src_file.exists():
            src_file = JSON_DIR / f"{cat}.json"

        if not src_file.exists():
            print(f"[WARN] No source file found for {cat}")
            continue

        with open(src_file, encoding="utf-8") as f:
            raw_items = json.load(f)

        clean_items = [sanitize_product(it) for it in raw_items]
        all_clean_products.extend(clean_items)

        # Save clean category JSON
        target_json = JSON_DIR / f"{cat}.json"
        with open(target_json, "w", encoding="utf-8") as f:
            json.dump(clean_items, f, ensure_ascii=False, indent=2)

        # Save clean category CSV
        target_csv = CSV_DIR / f"{cat}.csv"
        save_csv(clean_items, target_csv)

        print(f"[OK] Processed {cat:10}: {len(clean_items)} products -> {target_json.name}, {target_csv.name}")

    # 3. Save master combined files
    master_json = JSON_DIR / "pc_components_all.json"
    with open(master_json, "w", encoding="utf-8") as f:
        json.dump(all_clean_products, f, ensure_ascii=False, indent=2)

    master_csv = CSV_DIR / "pc_components_all.csv"
    save_csv(all_clean_products, master_csv)

    print(f"\n[OK] Master JSON: {master_json.name} ({len(all_clean_products)} products)")
    print(f"[OK] Master CSV:  {master_csv.name} ({len(all_clean_products)} products)")

    # 4. Remove all old files with 'hacom_' or 'anphat_'
    for folder in [JSON_DIR, CSV_DIR]:
        for f in list(folder.iterdir()):
            if f.is_file() and (f.name.startswith("hacom_") or f.name.startswith("anphat_") or f.name.startswith("all_pc_components")):
                f.unlink()
                print(f"[CLEANUP] Deleted old file: {f.name}")

    print("\n" + "=" * 60)
    print("  ALL EXTERNAL REFERENCES REMOVED! DATASET IS NOW 100% YOURS.")
    print("=" * 60)


if __name__ == "__main__":
    main()
