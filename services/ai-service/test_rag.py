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
    assert len(docs) > 0, "Expected indexed RAG documents > 0"
    store = ChromaKnowledgeStore()
    engine = HybridRAGEngine(store, docs, rrf_k=60)

    test_queries = [
        ("tôi chọn i5 13400 cắm main b760 có tương thích socket không?", None),
        ("RAM Bus 3200 cắm main 2666 có bị cháy không hay hạ xung downclocking?", None),
        ("Chính sách bảo hành tại PC Mall như thế nào, 1 đổi 1 trong bao lâu?", "store_policy"),
        ("Card màn hình RTX 4060 chơi game Wukong giá bao nhiêu?", "product")
    ]

    for q, doc_type in test_queries:
        print("=" * 80)
        print(f"🔍 TRUY VẤN: {q} (doc_type={doc_type})")
        print("=" * 80)
        results = engine.search(q, top_k=3, doc_type_filter=doc_type)
        assert len(results) > 0, f"Expected non-empty RAG results for query: {q}"
        if doc_type:
            for doc in results:
                actual_type = (doc.get("metadata") or {}).get("doc_type")
                assert actual_type == doc_type, f"Expected doc_type={doc_type}, got {actual_type}"

        prompt = build_grounded_system_prompt(results)
        assert isinstance(prompt, str) and len(prompt) > 50, "Expected non-empty grounded system prompt"
        print(f"  ✅ PASS ({len(results)} docs, prompt={len(prompt)} chars)")

    print("✅ ALL PYTHON RAG PIPELINE ASSERTIONS PASSED!")

if __name__ == "__main__":
    test_rag_pipeline()
