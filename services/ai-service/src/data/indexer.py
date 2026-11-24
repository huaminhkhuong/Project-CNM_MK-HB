import json
from pathlib import Path
from typing import List, Dict, Any

from .document_processor import DocumentProcessor


CORE_COMPATIBILITY_RULES = [
    {
        "id": "rule_COMP-001",
        "rule_id": "COMP-001",
        "text": "Quy tắc COMP-001 (CPU - Mainboard Socket): Socket của bộ vi xử lý (CPU) bắt buộc phải khớp tuyệt đối với socket bo mạch chủ (Mainboard), ví dụ LGA1700 đi với Mainboard LGA1700 (H610/B660/B760/Z790), AM4 đi với AM4 (A520/B550/X570), AM5 đi với AM5 (A620/B650/X670).",
    },
    {
        "id": "rule_COMP-002",
        "rule_id": "COMP-002",
        "text": "Quy tắc COMP-002 (Mainboard - RAM Generation): Chuẩn RAM DDR4 chỉ lắp được trên Mainboard hỗ trợ DDR4; chuẩn RAM DDR5 chỉ lắp được trên Mainboard hỗ trợ DDR5. Không thể lắp lẫn DDR4 và DDR5.",
    },
    {
        "id": "rule_COMP-003",
        "rule_id": "COMP-003",
        "text": "Quy tắc COMP-003 (Công suất nguồn PSU): Công suất thực của bộ nguồn (PSU) nên đạt tối thiểu 1.25 lần tổng TDP của CPU + GPU + 120W phụ tải hệ thống, khuyến nghị chuẩn 80 Plus Bronze trở lên để máy vận hành êm và bền bỉ.",
    },
    {
        "id": "rule_COMP-004",
        "rule_id": "COMP-004",
        "text": "Quy tắc COMP-004 (Form Factor Mainboard - Vỏ Case): Vỏ máy ATX hỗ trợ bo mạch chủ ATX, mATX và ITX; vỏ mATX chỉ hỗ trợ mATX và ITX; vỏ ITX chỉ hỗ trợ bo mạch chủ Mini-ITX.",
    },
    {
        "id": "rule_COMP-005",
        "rule_id": "COMP-005",
        "text": "Quy tắc COMP-005 (Tản nhiệt - Socket CPU): Tản nhiệt khí hoặc tản nước AIO cần hỗ trợ ngàm lắp tương ứng với socket CPU đang chọn (LGA1700, AM4, AM5) và đủ năng lực tản nhiệt cho công suất tỏa nhiệt của CPU.",
    },
    {
        "id": "rule_COMP-006",
        "rule_id": "COMP-006",
        "text": "Quy tắc COMP-006 (Dual Channel RAM): Ưu tiên lắp 2 thanh RAM (Dual Channel) thay vì 1 thanh đơn để tăng 15-20% độ mượt mà khi chơi game và đa nhiệm.",
    },
]

STORE_POLICY_DOCS = [
    {
        "id": "policy_warranty_pcmall",
        "title": "Chính sách bảo hành PC Mall",
        "text": "PC Mall áp dụng bảo hành chính hãng 12 đến 60 tháng tùy linh kiện (CPU/Mainboard/GPU/RAM thường 36 tháng, SSD 36-60 tháng, Nguồn cao cấp lên đến 120 tháng). Mỗi linh kiện xuất kho đều quản lý theo mã Serial Number (S/N) điện tử.",
    },
    {
        "id": "policy_payment_shipping_pcmall",
        "title": "Chính sách thanh toán và giao hàng PC Mall",
        "text": "PC Mall hỗ trợ thanh toán COD khi nhận hàng, chuyển khoản VietQR tự động đối soát qua SePay, VNPay và MoMo. Hỗ trợ lắp ráp miễn phí trọn bộ khi đặt hàng từ Smart PC Builder và giao hàng toàn quốc.",
    },
]


class HardwareDataIndexer:
    """
    Thu thập dữ liệu tri thức PC Mall từ 3 nguồn:
    1. Danh mục sản phẩm JSON (pc_components_all.json)
    2. Quy tắc tương thích phần cứng (COMP-001..COMP-006) & chính sách cửa hàng
    3. Tài liệu mở rộng do Admin tải lên trong services/ai-service/data/docs/
    """

    def __init__(self):
        self.base_dir = Path(__file__).resolve().parents[2]
        self.repo_root = self.base_dir.parents[1] if len(self.base_dir.parents) >= 2 else self.base_dir
        self.docs_dir = self.base_dir / "data_store" / "docs"
        self.docs_dir.mkdir(parents=True, exist_ok=True)

    def _find_catalog_json(self) -> Path | None:
        candidates = [
            self.base_dir / "data" / "json" / "pc_components_all.json",
            self.repo_root / "data" / "json" / "pc_components_all.json",
            Path("/app/data/json/pc_components_all.json"),
        ]
        for candidate in candidates:
            if candidate.exists() and candidate.is_file():
                return candidate
        return None

    def _load_products(self) -> List[Dict[str, Any]]:
        json_path = self._find_catalog_json()
        if not json_path:
            return []

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
        except Exception as err:
            print(f"⚠️ [HardwareDataIndexer] Không đọc được {json_path}: {err}")
            return []

        items = raw if isinstance(raw, list) else raw.get("products", []) or raw.get("items", [])
        docs: List[Dict[str, Any]] = []
        for idx, item in enumerate(items[:1500]):
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or item.get("product_name") or "").strip()
            if not name:
                continue
            category = str(item.get("category") or item.get("category_name") or "Linh kiện").strip()
            brand = str(item.get("brand") or item.get("brand_name") or "").strip()
            price = item.get("price") or item.get("sale_price") or 0
            sku = str(item.get("sku") or item.get("code") or f"SKU-{idx + 1}")
            specs = item.get("specs") or item.get("specifications") or {}
            spec_str = ""
            if isinstance(specs, dict):
                spec_str = "; ".join(f"{k}: {v}" for k, v in list(specs.items())[:8] if v)
            elif isinstance(specs, str):
                spec_str = specs[:300]

            text = f"Sản phẩm {category}: {name}. Thương hiệu: {brand or 'Chính hãng'}. Giá tham khảo: {int(float(price or 0)):,} VNĐ. Mã: {sku}."
            if spec_str:
                text += f" Thông số: {spec_str}."

            docs.append(
                {
                    "id": f"prod_{idx}_{sku}",
                    "text": text,
                    "metadata": {
                        "doc_type": "product",
                        "name": name,
                        "category": category,
                        "brand": brand,
                        "price": int(float(price or 0)),
                        "sku": sku,
                    },
                }
            )
        return docs

    def _load_rules_and_policies(self) -> List[Dict[str, Any]]:
        docs: List[Dict[str, Any]] = []
        for r in CORE_COMPATIBILITY_RULES:
            docs.append(
                {
                    "id": r["id"],
                    "text": r["text"],
                    "metadata": {
                        "doc_type": "compatibility_rule",
                        "rule_id": r["rule_id"],
                        "title": r["rule_id"],
                    },
                }
            )
        for p in STORE_POLICY_DOCS:
            docs.append(
                {
                    "id": p["id"],
                    "text": p["text"],
                    "metadata": {
                        "doc_type": "store_policy",
                        "title": p["title"],
                    },
                }
            )
        return docs

    def _load_custom_documents(self) -> List[Dict[str, Any]]:
        processor = DocumentProcessor(chunk_size=600, chunk_overlap=120)
        docs: List[Dict[str, Any]] = []
        supported = {".pdf", ".md", ".txt"}

        for fpath in self.docs_dir.iterdir():
            if not fpath.is_file() or fpath.suffix.lower() not in supported:
                continue
            target_service = "all"
            meta_path = fpath.with_suffix(".json")
            if meta_path.exists():
                try:
                    mdata = json.loads(meta_path.read_text(encoding="utf-8"))
                    target_service = mdata.get("target_service", "all")
                except Exception:
                    pass
            try:
                docs.extend(processor.process_file(fpath, target_service=target_service))
            except Exception as err:
                print(f"⚠️ [HardwareDataIndexer] Bỏ qua file lỗi {fpath.name}: {err}")
        return docs

    def load_all_documents(self) -> List[Dict[str, Any]]:
        all_docs: List[Dict[str, Any]] = []
        all_docs.extend(self._load_rules_and_policies())
        all_docs.extend(self._load_products())
        all_docs.extend(self._load_custom_documents())
        return all_docs

