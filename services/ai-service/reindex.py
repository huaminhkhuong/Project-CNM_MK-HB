"""
🔄 CLI SCRIPT: TÁI VECTOR HÓA TRI THỨC TOÀN DIỆN (RE-INDEXING ENGINE)
==============================================================================
Chạy script này bất cứ khi nào bạn:
1. Thêm sản phẩm mới vào kho hàng
2. Bổ sung hoặc chỉnh sửa quy tắc tương thích phần cứng (rules.json)
3. Thêm tài liệu hướng dẫn, cẩm nang xử lý sự cố, PDF bảo hành vào services/ai-service/data/docs/
==============================================================================
Cách chạy:
    python services/ai-service/reindex.py
"""

import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.data.indexer import HardwareDataIndexer
from src.vector_store.chroma_manager import ChromaKnowledgeStore
from src.retrieval.hybrid_engine import HybridRAGEngine

def main():
    print("=" * 70)
    print("🚀 BẮT ĐẦU QUY TRÌNH VECTOR HÓA & LẬP CHỈ MỤC TRI THỨC PC MALL")
    print("=" * 70)
    start_time = time.time()

    # 1. Thu thập dữ liệu
    indexer = HardwareDataIndexer()
    docs = indexer.load_all_documents()
    print(f"\n📥 Đã thu thập tổng cộng {len(docs)} tài liệu từ các nguồn.")

    # 2. Vector hóa vào ChromaDB (Dense Retrieval)
    store = ChromaKnowledgeStore()
    store.index_documents(docs, batch_size=150)

    # 3. Lập chỉ mục BM25 (Sparse Retrieval) với Underthesea Word Tokenize
    print("\n⚡ Kiểm tra và lập chỉ mục Hybrid BM25Okapi...")
    engine = HybridRAGEngine(store, docs, rrf_k=60)

    elapsed = time.time() - start_time
    print("\n" + "=" * 70)
    print(f"🎉 HOÀN THÀNH TÁI VECTOR HÓA TRONG {elapsed:.2f} GIÂY!")
    print(f"📊 Tổng số vector lưu trữ bền vững: {store.collection.count()} tài liệu.")
    print("=" * 70)

if __name__ == "__main__":
    main()
