import json
from pathlib import Path
from typing import List, Dict, Any

from .document_processor import DocumentProcessor


CORE_COMPATIBILITY_RULES = [
    {
        "id": "rule_COMP-001",
        "rule_id": "COMP-001",
        "text": "Quy tắc COMP-001 (CPU - Mainboard Socket): Socket của bộ vi xử lý (CPU) bắt buộc phải khớp tuyệt đối với socket bo mạch chủ (Mainboard), ví dụ LGA1851 đi với B860/Z890, LGA1700 đi với H610/B660/B760/Z790, AM4 đi với A520/B550/X570, AM5 đi với A620/B650/X670/X870.",
    },
    {
        "id": "rule_COMP-002",
        "rule_id": "COMP-002",
        "text": "Quy tắc COMP-002 (Mainboard - RAM Type & Slots): Chuẩn RAM DDR4 chỉ lắp trên Mainboard hỗ trợ DDR4; DDR5 chỉ lắp trên Mainboard hỗ trợ DDR5; số thanh RAM không vượt quá số khe RAM trên Mainboard (ưu tiên Dual Channel 2 thanh).",
    },
    {
        "id": "rule_COMP-003",
        "rule_id": "COMP-003",
        "text": "Quy tắc COMP-003 (Khe PCIe x16 GPU - Mainboard): Card đồ họa rời yêu cầu Mainboard có khe PCIe x16; lưu ý băng thông PCIe x8 nếu kết hợp APU đời cũ với GPU cao cấp.",
    },
    {
        "id": "rule_COMP-004",
        "rule_id": "COMP-004",
        "text": "Quy tắc COMP-004 (Chiều dài GPU - Khoảng trống Case): Chiều dài thực tế của card màn hình (GPU Length) phải nhỏ hơn hoặc bằng giới hạn không gian VGA của vỏ máy (Case GPU Clearance).",
    },
    {
        "id": "rule_COMP-005",
        "rule_id": "COMP-005",
        "text": "Quy tắc COMP-005 (Yêu cầu tản nhiệt CPU): Các CPU dòng K/KF/X/Tray hoặc không có tản stock bắt buộc phải trang bị tản nhiệt khí hoặc tản nước AIO rời.",
    },
    {
        "id": "rule_COMP-006",
        "rule_id": "COMP-006",
        "text": "Quy tắc COMP-006 (Tản nhiệt - Socket, TDP, Chiều cao & Radiator): Tản nhiệt phải hỗ trợ đúng socket CPU, có công suất tản nhiệt >= TDP CPU, chiều cao tản khí <= giới hạn Case và kích thước Radiator AIO <= giới hạn Case.",
    },
    {
        "id": "rule_COMP-007",
        "rule_id": "COMP-007",
        "text": "Quy tắc COMP-007 (Công suất nguồn PSU): Công suất thực của bộ nguồn (PSU) phải >= tổng TDP hệ thống (CPU + GPU + phụ tải), khuyến nghị dư địa an toàn tối thiểu 20-25%.",
    },
    {
        "id": "rule_COMP-008",
        "rule_id": "COMP-008",
        "text": "Quy tắc COMP-008 (Nguồn phụ GPU / CPU): Phân khúc nguồn phải đáp ứng cấp nguồn phụ PCIe 8-pin hoặc 12VHPWR ATX 3.0 tương xứng với TDP của card đồ họa rời.",
    },
    {
        "id": "rule_COMP-009",
        "rule_id": "COMP-009",
        "text": "Quy tắc COMP-009 (Khe cắm M.2 SSD - Mainboard): Số lượng ổ cứng SSD M.2 NVMe không được vượt quá tổng số khe cắm M.2 khả dụng trên bo mạch chủ.",
    },
    {
        "id": "rule_COMP-010",
        "rule_id": "COMP-010",
        "text": "Quy tắc COMP-010 (Form Factor Mainboard - Vỏ Case): Vỏ máy ATX hỗ trợ ATX/mATX/ITX; vỏ mATX chỉ hỗ trợ mATX/ITX; vỏ Mini-ITX chỉ hỗ trợ bo mạch chủ Mini-ITX.",
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

