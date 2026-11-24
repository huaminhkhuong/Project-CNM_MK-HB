import os
import json
import time
import urllib.request
from typing import List
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings

class GeminiEmbeddingFunction(EmbeddingFunction[Documents]):
    """
    Custom ChromaDB Embedding Function sử dụng Google Gemini REST API:
    - Model: models/gemini-embedding-001 (hoặc text-embedding-004)
    - Số chiều: 3072 (hoặc 768 tùy model)
    - Tự động chia batch 40 items/request để tối ưu tốc độ và an toàn quota
    - Tự động retry khi gặp lỗi mạng tạm thời
    """
    def __init__(self, api_key: str, model_name: str = "models/gemini-embedding-001"):
        self.api_key = api_key
        self.model_name = model_name

    def __call__(self, input: Documents) -> Embeddings:
        if not input:
            return []

        url = f"https://generativelanguage.googleapis.com/v1beta/{self.model_name}:batchEmbedContents?key={self.api_key}"
        all_embeddings: Embeddings = []
        batch_size = 40

        for i in range(0, len(input), batch_size):
            chunk = input[i:i+batch_size]
            reqs = [
                {
                    "model": self.model_name,
                    "content": {"parts": [{"text": str(text)[:3000]}]} # Tránh vượt token limit
                }
                for text in chunk
            ]
            payload = json.dumps({"requests": reqs}).encode("utf-8")
            
            # Retry logic
            for attempt in range(3):
                try:
                    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                        for e in data.get("embeddings", []):
                            all_embeddings.append(e["values"])
                        break
                except Exception as ex:
                    if attempt == 2:
                        raise RuntimeError(f"Lỗi gọi Gemini Embedding API sau 3 lần thử: {ex}")
                    time.sleep(1.5 * (attempt + 1))

        return all_embeddings
