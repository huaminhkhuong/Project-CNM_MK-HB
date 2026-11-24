import re
import unicodedata
from pathlib import Path
from typing import List, Dict, Any


class DocumentProcessor:
    """
    Tiền xử lý tài liệu tri thức RAG (.pdf, .md, .txt):
    - Trích xuất văn bản sạch
    - Chuẩn hóa Unicode NFC cho tiếng Việt
    - Cắt phân đoạn đệ quy (Recursive Character Chunking) có chồng lấn (overlap)
    """

    def __init__(self, chunk_size: int = 600, chunk_overlap: int = 120):
        self.chunk_size = max(100, int(chunk_size))
        self.chunk_overlap = max(0, min(int(chunk_overlap), self.chunk_size // 2))

    def _extract_text(self, file_path: Path) -> str:
        suffix = file_path.suffix.lower()
        if suffix in (".txt", ".md"):
            raw = file_path.read_text(encoding="utf-8", errors="ignore")
            return self._normalize_text(raw)

        if suffix == ".pdf":
            try:
                from pypdf import PdfReader

                reader = PdfReader(str(file_path))
                pages = []
                for page in reader.pages:
                    extracted = page.extract_text() or ""
                    if extracted.strip():
                        pages.append(extracted)
                return self._normalize_text("\n\n".join(pages))
            except ImportError:
                raw_bytes = file_path.read_bytes()
                decoded = raw_bytes.decode("utf-8", errors="ignore")
                cleaned = re.sub(r"[^\w\sÀ-ỹ.,;:!?()\-/%\n]", " ", decoded)
                return self._normalize_text(cleaned)

        raise ValueError(f"Định dạng file không được hỗ trợ: {suffix}")

    def _normalize_text(self, text: str) -> str:
        text = unicodedata.normalize("NFC", text or "")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _split_recursive(self, text: str) -> List[str]:
        if not text:
            return []
        if len(text) <= self.chunk_size:
            return [text]

        separators = ["\n\n", "\n", ". ", "; ", " "]
        chunks: List[str] = []
        start = 0
        total_len = len(text)

        while start < total_len:
            end = min(total_len, start + self.chunk_size)
            if end < total_len:
                best_split = -1
                window = text[start:end]
                for sep in separators:
                    pos = window.rfind(sep)
                    if pos >= int(self.chunk_size * 0.45):
                        best_split = start + pos + len(sep)
                        break
                if best_split > start:
                    end = best_split

            piece = text[start:end].strip()
            if piece:
                chunks.append(piece)

            if end >= total_len:
                break
            next_start = max(start + 1, end - self.chunk_overlap)
            start = next_start

        return chunks

    def process_file(self, file_path: Path, target_service: str = "all") -> List[Dict[str, Any]]:
        path_obj = Path(file_path)
        full_text = self._extract_text(path_obj)
        if not full_text:
            return []

        raw_chunks = self._split_recursive(full_text)
        safe_stem = re.sub(r"[^\w\-]", "_", path_obj.stem)
        title = path_obj.stem.replace("-", " ").replace("_", " ").strip().title()

        results: List[Dict[str, Any]] = []
        for idx, chunk_text in enumerate(raw_chunks):
            results.append(
                {
                    "id": f"doc_{safe_stem}_{idx}",
                    "text": chunk_text,
                    "metadata": {
                        "doc_type": "custom_document",
                        "file_name": path_obj.name,
                        "title": title,
                        "target_service": target_service or "all",
                        "chunk_index": idx,
                    },
                }
            )
        return results

