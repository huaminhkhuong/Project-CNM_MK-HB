from typing import List, Dict, Any, Optional
from collections import defaultdict
import numpy as np
from underthesea import word_tokenize

from src.vector_store.chroma_manager import ChromaKnowledgeStore
from src.data.indexer import HardwareDataIndexer

class HybridRAGEngine:
    """
    Triển khai chuẩn thực nghiệm AIO2026:
    - Dense Search: ChromaDB HNSW Cosine Similarity
    - Sparse Search: BM25Okapi với Tokenization tiếng Việt từ Underthesea
    - RRF Fusion: Reciprocal Rank Fusion với k=60
    - U-shaped Reordering: Đưa tài liệu quan trọng nhất ra đầu và cuối prompt
    """
    def __init__(self, chroma_store: ChromaKnowledgeStore, documents: List[Dict[str, Any]], rrf_k: int = 60):
        self.chroma_store = chroma_store
        self.documents = documents
        self.rrf_k = rrf_k
        self.doc_by_id = {d["id"]: d for d in documents}

        print("⚡ Đang lập chỉ mục BM25Okapi với Underthesea Word Tokenize...")
        self.tokenized_corpus = [
            word_tokenize(d["text"].lower())
            for d in documents
        ]
        from rank_bm25 import BM25Okapi
        self.bm25 = BM25Okapi(self.tokenized_corpus)
        print(f"✅ Đã sẵn sàng Hybrid Search cho {len(documents)} tài liệu.")

    def search(self, query: str, top_k: int = 5, doc_type_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        query_clean = query.strip()
        if not query_clean:
            return []

        search_k = min(len(self.documents), top_k * 3)

        # 1. Luồng 1: Dense Retrieval (Vector Search)
        where_filter = {"doc_type": doc_type_filter} if doc_type_filter else None
        vector_results = self.chroma_store.search(query=query_clean, top_k=search_k, where=where_filter)

        # 2. Luồng 2: Sparse Retrieval (BM25 Tokenized)
        tokenized_q = word_tokenize(query_clean.lower())
        bm25_scores = self.bm25.get_scores(tokenized_q)
        top_indices = np.argsort(bm25_scores)[::-1][:search_k]
        
        bm25_results = []
        for idx in top_indices:
            if bm25_scores[idx] > 0:
                doc = self.documents[idx]
                if not doc_type_filter or doc.get("metadata", {}).get("doc_type") == doc_type_filter:
                    bm25_results.append(doc)

        # 3. Thuật toán Hợp Nhất Xếp Hạng Nghịch Đảo (Reciprocal Rank Fusion - RRF)
        # Score(d) = sum( 1 / (k + rank_i) )
        rrf_scores = defaultdict(float)
        matched_map = {}

        # Chấm điểm từ luồng Vector
        for rank, item in enumerate(vector_results, start=1):
            d_id = item["id"]
            matched_map[d_id] = self.doc_by_id.get(d_id, item)
            rrf_scores[d_id] += 1.0 / (self.rrf_k + rank)

        # Chấm điểm từ luồng BM25
        for rank, doc in enumerate(bm25_results, start=1):
            d_id = doc["id"]
            if d_id not in matched_map:
                matched_map[d_id] = doc
            rrf_scores[d_id] += 1.0 / (self.rrf_k + rank)

        # Sắp xếp kết quả theo điểm RRF
        sorted_ranks = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        top_candidates = [matched_map[d_id] for d_id, _ in sorted_ranks[:top_k]]

        # 4. Tối ưu thứ tự U-shaped (Lost in the Middle)
        final_docs = self._reorder_u_shape(top_candidates)
        return final_docs

    def _reorder_u_shape(self, docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Sắp xếp [Doc1, Doc3, Doc5, ..., Doc4, Doc2] để tận dụng độ tập trung tối đa của LLM."""
        if len(docs) <= 2:
            return docs
        left = []
        right = []
        for i, d in enumerate(docs):
            if i % 2 == 0:
                left.append(d)
            else:
                right.append(d)
        return left + right[::-1]
