import os
import chromadb
from pathlib import Path
from typing import List, Dict, Any, Optional

from .gemini_embedding import GeminiEmbeddingFunction

def load_ai_env():
    """Tự động nạp cấu hình từ .env của ai-service hoặc api."""
    resolved_parents = Path(__file__).resolve().parents
    paths = [resolved_parents[2] / ".env"]
    if len(resolved_parents) > 4:
        paths.append(resolved_parents[4] / "services" / "api" / ".env")
        paths.append(resolved_parents[4] / ".env")
    for p in paths:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k not in os.environ:
                            os.environ[k] = v

load_ai_env()

class ChromaKnowledgeStore:
    """
    Quản lý Vector Database ChromaDB với kiến trúc Fault-Tolerant Hybrid:
    - Primary: Google Gemini Embedding API (models/gemini-embedding-001, 3072 dims)
    - Fallback: Local ONNX Runtime (all-MiniLM-L6-v2, 384 dims, 100% offline, 0 cost, 0 quota limit)
    """
    def __init__(self, persist_dir: Optional[str] = None):
        if not persist_dir:
            persist_dir = str(Path(__file__).resolve().parents[2] / "data_store" / "chroma_db")
        self.persist_dir = persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)
        
        self.client = chromadb.PersistentClient(path=self.persist_dir)
        
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("LLM_API_KEY", "")
        self.embedding_model = os.environ.get("AI_RAG_EMBEDDING_MODEL") or "models/gemini-embedding-001"
        self.embedding_provider = os.environ.get("EMBEDDING_PROVIDER", "gemini").lower()

        # Luôn chuẩn bị sẵn collection local ONNX làm lá chắn bảo vệ
        self.local_collection = self.client.get_or_create_collection(
            name="pcmall_knowledge",
            metadata={"hnsw:space": "cosine"}
        )

        self.is_using_gemini = False
        self.collection = self.local_collection
        self.collection_name = "pcmall_knowledge"

        if self.gemini_api_key and ("gemini" in self.embedding_provider or "001" in self.embedding_model):
            try:
                print(f"✨ [ChromaDB] Đang cấu hình mô hình Google Embedding: {self.embedding_model} (3072 dims)...")
                self.gemini_fn = GeminiEmbeddingFunction(
                    api_key=self.gemini_api_key,
                    model_name=self.embedding_model
                )
                self.gemini_collection = self.client.get_or_create_collection(
                    name="pcmall_gemini_knowledge",
                    embedding_function=self.gemini_fn,
                    metadata={"hnsw:space": "cosine"}
                )
                self.is_using_gemini = True
                self.collection = self.gemini_collection
                self.collection_name = "pcmall_gemini_knowledge"
                print("✅ [ChromaDB] Đã kích hoạt Google Gemini Embedding Collection!")
            except Exception as e:
                print(f"⚠️ [ChromaDB] Không thể khởi tạo Gemini collection ({e}). Tự động fallback về Local ONNX.")
                self.is_using_gemini = False
                self.collection = self.local_collection
                self.collection_name = "pcmall_knowledge"

    def is_indexed(self) -> bool:
        """Kiểm tra xem Vector Database đã có dữ liệu chưa."""
        return self.collection.count() > 0 or self.local_collection.count() > 0

    def index_documents(self, documents: List[Dict[str, Any]], batch_size: int = 40):
        """Index toàn bộ danh sách tài liệu vào ChromaDB theo batch."""
        total = len(documents)
        print(f"🔄 Đang tiến hành Vector hóa {total} tài liệu vào ChromaDB Collection '{self.collection_name}'...")
        
        # Nếu đang dùng Gemini, thử nạp vào gemini_collection; nếu bị 429 thì fallback sang local ONNX
        target_col = self.collection
        try:
            # Xóa dữ liệu cũ nếu muốn reindex
            if target_col.count() > 0:
                existing_ids = target_col.get()["ids"]
                if existing_ids:
                    for i in range(0, len(existing_ids), 200):
                        target_col.delete(ids=existing_ids[i:i+200])

            for i in range(0, total, batch_size):
                batch = documents[i:i+batch_size]
                ids = [d["id"] for d in batch]
                texts = [d["text"] for d in batch]
                metadatas = []
                for d in batch:
                    clean_meta = {}
                    for k, v in d.get("metadata", {}).items():
                        if isinstance(v, (str, int, float, bool)):
                            clean_meta[k] = v
                        elif v is None:
                            clean_meta[k] = ""
                        else:
                            clean_meta[k] = str(v)
                    metadatas.append(clean_meta)

                target_col.add(
                    ids=ids,
                    documents=texts,
                    metadatas=metadatas
                )
                print(f"  + Tiến độ nạp Vector: {min(i + batch_size, total)}/{total} tài liệu...")

            print(f"✅ Hoàn tất vector hóa! Tổng cộng trong ChromaDB '{self.collection_name}': {target_col.count()} vectors.")

        except Exception as ex:
            print(f"⚠️ [ChromaDB Indexing] Lỗi khi nạp dữ liệu với Gemini Embedding ({ex}).")
            if self.is_using_gemini:
                print("🛡️ [ChromaDB] Tự động chuyển hướng sang Collection Local ONNX (1226 vectors sẵn có) để bảo toàn dịch vụ!")
                self.collection = self.local_collection
                self.collection_name = "pcmall_knowledge"
                # Đảm bảo local_collection có dữ liệu
                if self.local_collection.count() < total:
                    print("🔄 Đang nạp vào Local ONNX...")
                    for i in range(0, total, 100):
                        batch = documents[i:i+100]
                        self.local_collection.add(
                            ids=[d["id"] for d in batch],
                            documents=[d["text"] for d in batch],
                            metadatas=[d.get("metadata", {}) for d in batch]
                        )
                print(f"✅ Collection Local ONNX đã sẵn sàng với {self.local_collection.count()} vectors!")

    def upsert_chunks(self, chunks: List[Dict[str, Any]], batch_size: int = 40) -> int:
        """Nạp các chunks tài liệu mới vào Vector DB (hỗ trợ cả Gemini và Fallback Local)."""
        if not chunks:
            return 0
        total = len(chunks)
        print(f"📥 Đang nạp thêm {total} chunks vào ChromaDB '{self.collection_name}'...")
        target_col = self.collection
        try:
            for i in range(0, total, batch_size):
                batch = chunks[i:i+batch_size]
                ids = [d["id"] for d in batch]
                texts = [d["text"] for d in batch]
                metadatas = []
                for d in batch:
                    clean_meta = {}
                    for k, v in d.get("metadata", {}).items():
                        if isinstance(v, (str, int, float, bool)):
                            clean_meta[k] = v
                        elif v is None:
                            clean_meta[k] = ""
                        else:
                            clean_meta[k] = str(v)
                    metadatas.append(clean_meta)

                target_col.upsert(
                    ids=ids,
                    documents=texts,
                    metadatas=metadatas
                )
            print(f"✅ Đã nạp thành công {total} chunks vào ChromaDB '{self.collection_name}'!")
            return total
        except Exception as ex:
            print(f"⚠️ [ChromaDB upsert_chunks] Lỗi khi nạp vào {self.collection_name} ({ex}). Thử upsert vào local ONNX...")
            for i in range(0, total, 100):
                batch = chunks[i:i+100]
                self.local_collection.upsert(
                    ids=[d["id"] for d in batch],
                    documents=[d["text"] for d in batch],
                    metadatas=[d.get("metadata", {}) for d in batch]
                )
            return total

    def delete_chunks_by_file(self, file_name: str):
        """Xóa toàn bộ các chunk thuộc file_name chỉ định trong ChromaDB."""
        try:
            self.collection.delete(where={"file_name": file_name})
            if self.is_using_gemini:
                try:
                    self.local_collection.delete(where={"file_name": file_name})
                except Exception:
                    pass
            print(f"🗑️ Đã xóa các chunks của file '{file_name}' khỏi ChromaDB.")
        except Exception as e:
            print(f"⚠️ [ChromaDB delete_chunks_by_file] Lỗi: {e}")

    def search(self, query: str, top_k: int = 5, where: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Tìm kiếm ngữ nghĩa Dense Vector Search bằng Cosine Similarity."""
        target_col = self.collection if self.collection.count() > 0 else self.local_collection
        
        try:
            results = target_col.query(
                query_texts=[query],
                n_results=top_k,
                where=where
            )
        except Exception as e:
            # Fallback sang local nếu query qua Gemini gặp lỗi mạng hoặc 429
            print(f"⚠️ [ChromaDB Search] Query với {self.collection_name} gặp lỗi ({e}). Fallback sang local ONNX...")
            results = self.local_collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where
            )

        matched_docs = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            ids = results["ids"][0]
            metadatas = results["metadatas"][0] if "metadatas" in results and results["metadatas"] else [{}] * len(docs)
            distances = results["distances"][0] if "distances" in results and results["distances"] else [0.0] * len(docs)

            for idx, text in enumerate(docs):
                matched_docs.append({
                    "id": ids[idx],
                    "text": text,
                    "metadata": metadatas[idx],
                    "distance": distances[idx],
                    "cosine_similarity": round(1.0 - distances[idx], 4)
                })

        return matched_docs
