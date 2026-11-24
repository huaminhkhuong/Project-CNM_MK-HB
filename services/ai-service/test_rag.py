import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.data.indexer import HardwareDataIndexer
from src.vector_store.chroma_manager import ChromaKnowledgeStore
from src.retrieval.hybrid_engine import HybridRAGEngine
from src.generation.prompt_builder import build_grounded_system_prompt

def test_rag_pipeline():
    indexer = HardwareDataIndexer()
    docs = indexer.load_all_documents()
    store = ChromaKnowledgeStore()
    engine = HybridRAGEngine(store, docs, rrf_k=60)

    test_queries = [
        "tôi chọn i5 13400 cắm main b760 có tương thích socket không?",
        "RAM Bus 3200 cắm main 2666 có bị cháy không hay hạ xung downclocking?",
        "Chính sách bảo hành tại PC Mall như thế nào, 1 đổi 1 trong bao lâu?",
        "Card màn hình RTX 4060 chơi game Wukong giá bao nhiêu?"
    ]

    for q in test_queries:
        print("=" * 80)
        print(f"🔍 TRUY VẤN: {q}")
        print("=" * 80)
        results = engine.search(q, top_k=3)
        for i, doc in enumerate(results, start=1):
            meta = doc.get("metadata", {})
            print(f"  👉 [Rank #{i}] Loại: {meta.get('doc_type', 'N/A')} | ID: {doc.get('id')}")
            # In 2 dòng đầu của văn bản
            lines = doc.get("text", "").split("\n")[:3]
            for l in lines:
                print(f"     {l}")
            print()

        prompt = build_grounded_system_prompt(results)
        print(f"📝 Kích thước Grounded Prompt tạo ra: {len(prompt)} ký tự.")
        print()

if __name__ == "__main__":
    test_rag_pipeline()
