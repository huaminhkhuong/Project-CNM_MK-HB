import os
import sys
import re
import json
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Thiết lập sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.data.indexer import HardwareDataIndexer
from src.data.document_processor import DocumentProcessor
from src.vector_store.chroma_manager import ChromaKnowledgeStore
from src.retrieval.hybrid_engine import HybridRAGEngine
from src.generation.prompt_builder import build_grounded_system_prompt
from src.generation.question_engine import generate_dynamic_questions

DOCS_DIR = BASE_DIR / "data" / "docs"
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# Biến global lưu trữ service singletons
indexer = None
chroma_store = None
hybrid_engine = None
all_cached_docs = []

reindex_status = {
    "is_running": False,
    "progress": 0,
    "message": "Sẵn sàng",
    "last_completed": None,
    "vectors_count": 0
}

def perform_reindex():
    global reindex_status, all_cached_docs, hybrid_engine, chroma_store, indexer
    reindex_status["is_running"] = True
    reindex_status["progress"] = 10
    reindex_status["message"] = "Đang thu thập dữ liệu sản phẩm và tài liệu..."
    try:
        if not indexer:
            indexer = HardwareDataIndexer()
        docs = indexer.load_all_documents()
        reindex_status["progress"] = 40
        reindex_status["message"] = f"Đang vector hóa {len(docs)} tài liệu vào ChromaDB..."
        
        if not chroma_store:
            chroma_store = ChromaKnowledgeStore()
        chroma_store.index_documents(docs, batch_size=150)
        reindex_status["progress"] = 80
        reindex_status["message"] = "Đang cập nhật chỉ mục tìm kiếm Hybrid BM25Okapi..."
        
        all_cached_docs = docs
        hybrid_engine = HybridRAGEngine(chroma_store, all_cached_docs, rrf_k=60)
        
        reindex_status["is_running"] = False
        reindex_status["progress"] = 100
        reindex_status["message"] = f"Đã hoàn tất tái lập chỉ mục thành công! Tổng cộng {chroma_store.collection.count()} vectors."
        reindex_status["last_completed"] = datetime.now().isoformat()
        reindex_status["vectors_count"] = chroma_store.collection.count()
        print(f"🎉 [Reindex] Hoàn tất tái lập chỉ mục ({chroma_store.collection.count()} vectors).")
    except Exception as ex:
        reindex_status["is_running"] = False
        reindex_status["message"] = f"Lỗi khi tái lập chỉ mục: {str(ex)}"
        print(f"❌ [Reindex Error] {ex}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global indexer, chroma_store, hybrid_engine, all_cached_docs
    print("🚀 [AI-Service] Đang khởi động RAG Microservice cho PC Mall...")
    indexer = HardwareDataIndexer()
    chroma_store = ChromaKnowledgeStore()
    
    # Load tài liệu
    all_cached_docs = indexer.load_all_documents()
    
    # Tự động index vào ChromaDB nếu chưa có bất kỳ dữ liệu nào
    if not chroma_store.is_indexed():
        print(f"📦 ChromaDB cần lập chỉ mục ban đầu...")
        chroma_store.index_documents(all_cached_docs, batch_size=150)
    else:
        print(f"✅ ChromaDB đã có sẵn vectors ({chroma_store.collection.count()} trong {chroma_store.collection_name}).")

    # Khởi tạo Hybrid RRF Engine
    hybrid_engine = HybridRAGEngine(chroma_store, all_cached_docs, rrf_k=60)
    print("🎉 [AI-Service] RAG Microservice đã sẵn sàng phục vụ tại cổng 5001!")
    yield
    print("🛑 [AI-Service] Đang tắt service...")

app = FastAPI(
    title="PC Mall AI Service - Hybrid RAG Engine",
    version="2.2.0",
    description="Microservice chuyên biệt cung cấp Hybrid Semantic Search, Quản lý tài liệu RAG, RRF Fusion và Dynamic Hardware Consultation cho Chatbot & PC Builder.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- SCHEMAS -----------------

class RetrieveRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    doc_type: Optional[str] = None # 'product', 'compatibility_rule', 'budget_rule', 'store_policy', 'custom_document'
    target_service: Optional[str] = None # 'chatbot', 'pc_builder', 'all'

class DocumentResult(BaseModel):
    id: str
    text: str
    metadata: Dict[str, Any]
    score_note: Optional[str] = None

class RetrieveResponse(BaseModel):
    query: str
    grounded_system_prompt: str
    results_count: int
    documents: List[DocumentResult]

class QuestionRequest(BaseModel):
    purpose: str = "gaming"
    budget: Optional[int] = 20000000
    step: Optional[int] = 1
    previous_answers: Optional[Dict[str, Any]] = None

class BuildRecommendRequest(BaseModel):
    purpose: str
    budget: float
    answers: Dict[str, Any]
    exclude_monitor: Optional[bool] = False

# ----------------- CORE ENDPOINTS -----------------

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "pcmall-ai-rag-service",
        "scope": "Exclusively serves Chatbot and Smart PC Builder",
        "total_documents_cached": len(all_cached_docs),
        "chroma_vectors_count": chroma_store.collection.count() if chroma_store else 0,
        "features": [
            "Admin Document Management (Upload PDF/MD/TXT, Recursive Chunking)",
            "Hybrid Search (Dense Cosine + Sparse BM25Okapi)",
            "Reciprocal Rank Fusion (RRF, k=60)",
            "Vietnamese Word Tokenization (Underthesea)",
            "Hardware Rules Vectorization (COMP-001..COMP-010)",
            "Progressive Questioning PC Builder Engine"
        ]
    }

@app.post("/v1/rag/retrieve", response_model=RetrieveResponse)
def retrieve(req: RetrieveRequest):
    if not hybrid_engine:
        raise HTTPException(status_code=503, detail="Hệ thống AI Service đang khởi tạo, vui lòng thử lại sau giây lát.")

    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống.")

    # Thực thi Hybrid Search + RRF + U-shaped
    top_docs = hybrid_engine.search(
        query=query, 
        top_k=req.top_k, 
        doc_type_filter=req.doc_type
    )

    grounded_prompt = build_grounded_system_prompt(top_docs)

    doc_results = [
        DocumentResult(
            id=d["id"],
            text=d["text"],
            metadata=d.get("metadata", {})
        )
        for d in top_docs
    ]

    return RetrieveResponse(
        query=query,
        grounded_system_prompt=grounded_prompt,
        results_count=len(doc_results),
        documents=doc_results
    )

reindex_status = {
    "is_running": False,
    "progress": 0,
    "total": 0,
    "message": "Hệ thống sẵn sàng",
    "updated_at": None
}

def do_reindex_task():
    global all_cached_docs, hybrid_engine, reindex_status
    try:
        reindex_status["is_running"] = True
        reindex_status["message"] = "Đang nạp lại dữ liệu phần cứng..."
        print("🔄 [Reindex] Bắt đầu nạp lại toàn bộ tri thức trong background...")
        all_cached_docs = indexer.load_all_documents()
        total = len(all_cached_docs)
        reindex_status["total"] = total
        reindex_status["message"] = f"Đang vector hóa {total} tài liệu vào ChromaDB..."
        
        chroma_store.index_documents(all_cached_docs, batch_size=150)
        hybrid_engine = HybridRAGEngine(chroma_store, all_cached_docs, rrf_k=60)
        
        reindex_status["is_running"] = False
        reindex_status["progress"] = total
        reindex_status["message"] = f"Hoàn tất tái lập chỉ mục {total} tài liệu vào ChromaDB & BM25."
        reindex_status["updated_at"] = datetime.now().isoformat()
        print(f"🎉 [Reindex] Hoàn tất tái vector hóa {total} tài liệu!")
    except Exception as e:
        reindex_status["is_running"] = False
        reindex_status["message"] = f"Lỗi tái lập chỉ mục: {str(e)}"
        print(f"❌ [Reindex Error] {e}")

@app.post("/v1/rag/reindex")
def trigger_reindex(background_tasks: BackgroundTasks):
    """Đồng bộ và vector hóa lại toàn bộ tài liệu trong background task để tránh timeout."""
    global reindex_status
    if reindex_status["is_running"]:
        return {
            "success": True,
            "message": "Tiến trình tái lập chỉ mục đang được xử lý ngầm trong nền...",
            "status": "running",
            "reindex_status": reindex_status
        }
    
    background_tasks.add_task(do_reindex_task)
    return {
        "success": True,
        "message": "Đã kích hoạt tái lập chỉ mục Vector DB trong nền. Quá trình diễn ra an toàn và không làm nghẽn hệ thống!",
        "status": "started",
        "total_documents": len(all_cached_docs),
        "chroma_vectors": chroma_store.collection.count() if chroma_store else 0
    }

@app.get("/v1/rag/reindex/status")
@app.get("/v1/rag/reindex-status")
def get_reindex_status():
    global reindex_status
    return {
        "success": True,
        "status": reindex_status,
        "total_documents": len(all_cached_docs),
        "chroma_vectors": chroma_store.collection.count() if chroma_store else 0
    }

# ----------------- ADMIN DOCUMENT MANAGEMENT ENDPOINTS -----------------

@app.get("/v1/rag/documents")
def list_documents():
    """Liệt kê toàn bộ tài liệu tri thức mở rộng trong thư mục data/docs/."""
    processor = DocumentProcessor(chunk_size=600, chunk_overlap=120)
    docs = []
    
    supported_extensions = [".pdf", ".md", ".txt"]
    for fpath in DOCS_DIR.iterdir():
        if fpath.is_file() and fpath.suffix.lower() in supported_extensions:
            file_stat = fpath.stat()
            file_size_kb = round(file_stat.st_size / 1024, 2)
            
            # Đọc metadata sidecar nếu có
            meta_path = fpath.with_suffix(".json")
            target_service = "all"
            uploaded_at = datetime.fromtimestamp(file_stat.st_mtime).isoformat()
            chunk_count = None
            if meta_path.exists():
                try:
                    with open(meta_path, "r", encoding="utf-8") as mf:
                        mdata = json.load(mf)
                        target_service = mdata.get("target_service", "all")
                        uploaded_at = mdata.get("uploaded_at", uploaded_at)
                        chunk_count = mdata.get("chunk_count")
                except Exception:
                    pass

            # Chỉ đọc lại file nếu chưa có chunk_count trong metadata cache
            if chunk_count is None:
                try:
                    chunks = processor.process_file(fpath, target_service=target_service)
                    chunk_count = len(chunks)
                    with open(meta_path, "w", encoding="utf-8") as mf:
                        json.dump({
                            "file_name": fpath.name,
                            "target_service": target_service,
                            "chunk_count": chunk_count,
                            "uploaded_at": uploaded_at
                        }, mf, ensure_ascii=False, indent=2)
                except Exception:
                    chunk_count = 0

            docs.append({
                "fileName": fpath.name,
                "title": fpath.stem.replace("-", " ").replace("_", " ").title(),
                "format": fpath.suffix.lower().replace(".", "").upper(),
                "fileSizeKb": file_size_kb,
                "targetService": target_service,
                "chunkCount": chunk_count,
                "uploadedAt": uploaded_at
            })

    return {
        "success": True,
        "total": len(docs),
        "documents": sorted(docs, key=lambda x: x["uploadedAt"], reverse=True)
    }

@app.post("/v1/rag/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    target_service: str = Form("all") # 'chatbot', 'pc_builder', 'all'
):
    """
    Tiếp nhận file tài liệu tải lên từ Admin, lưu vào data/docs/,
    tiền xử lý, chuẩn hóa Unicode NFC, cắt chunk và lập chỉ mục tức thì.
    """
    filename = file.filename
    if not filename:
        raise HTTPException(status_code=400, detail="Tên file không hợp lệ.")

    suffix = Path(filename).suffix.lower()
    if suffix not in [".pdf", ".md", ".txt"]:
        raise HTTPException(
            status_code=400, 
            detail="Định dạng file không được hỗ trợ. Chỉ chấp nhận các file: .pdf, .md, .txt"
        )

    # Đảm bảo tên file an toàn
    safe_name = re.sub(r"[^\w\.-]", "_", filename)
    target_path = DOCS_DIR / safe_name

    # Ghi nội dung file
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Ghi sidecar metadata
    meta_path = target_path.with_suffix(".json")
    meta_data = {
        "file_name": safe_name,
        "target_service": target_service,
        "uploaded_at": datetime.now().isoformat(),
        "original_name": filename
    }
    with open(meta_path, "w", encoding="utf-8") as mf:
        json.dump(meta_data, mf, ensure_ascii=False, indent=2)

    # Xử lý cắt chunk
    processor = DocumentProcessor(chunk_size=600, chunk_overlap=120)
    try:
        new_chunks = processor.process_file(target_path, target_service=target_service)
    except Exception as e:
        # Nếu lỗi thì xóa file và báo về
        target_path.unlink(missing_ok=True)
        meta_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Lỗi khi trích xuất và tiền xử lý tài liệu: {str(e)}")

    if not new_chunks:
        target_path.unlink(missing_ok=True)
        meta_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Tài liệu không chứa văn bản hợp lệ hoặc không trích xuất được nội dung.")

    meta_data["chunk_count"] = len(new_chunks)
    with open(meta_path, "w", encoding="utf-8") as mf:
        json.dump(meta_data, mf, ensure_ascii=False, indent=2)

    # Nạp Vector hóa tức thì cho các chunk mới (Chỉ nạp tài liệu vừa tải lên, không re-index toàn bộ kho)
    global all_cached_docs, hybrid_engine
    try:
        chroma_store.upsert_chunks(new_chunks)
        # Cập nhật danh sách tài liệu cached trong RAM
        all_cached_docs = [d for d in all_cached_docs if d.get("metadata", {}).get("file_name") != safe_name]
        all_cached_docs.extend(new_chunks)
        hybrid_engine = HybridRAGEngine(chroma_store, all_cached_docs, rrf_k=60)
    except Exception as e:
        print(f"⚠️ [Upload Vectorize Warning] {e}")

    return {
        "success": True,
        "message": f"Tải lên và xử lý thành công tài liệu '{safe_name}'. Đã trích xuất {len(new_chunks)} chunks vào Vector DB.",
        "file": {
            "fileName": safe_name,
            "format": suffix.replace(".", "").upper(),
            "targetService": target_service,
            "chunkCount": len(new_chunks),
            "totalVectorsInStore": chroma_store.collection.count()
        }
    }

@app.delete("/v1/rag/documents/{filename}")
def delete_document(filename: str):
    """Xóa tài liệu khỏi data/docs/ và cập nhật lại Vector DB."""
    safe_name = Path(filename).name
    target_path = DOCS_DIR / safe_name
    meta_path = target_path.with_suffix(".json")

    if not target_path.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu cần xóa.")

    try:
        target_path.unlink(missing_ok=True)
        meta_path.unlink(missing_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể xóa file: {str(e)}")

    # Xóa các vector tương ứng trong ChromaDB và cập nhật RAM mà không làm nghẽn server
    global all_cached_docs, hybrid_engine
    try:
        chroma_store.delete_chunks_by_file(safe_name)
        all_cached_docs = [d for d in all_cached_docs if d.get("metadata", {}).get("file_name") != safe_name]
        hybrid_engine = HybridRAGEngine(chroma_store, all_cached_docs, rrf_k=60)
    except Exception as e:
        print(f"⚠️ [Delete Chunks Warning] {e}")

    return {
        "success": True,
        "message": f"Đã xóa vĩnh viễn tài liệu '{safe_name}' và đồng bộ lại Vector DB.",
        "remainingVectors": chroma_store.collection.count()
    }

@app.get("/v1/rag/documents/{filename}/chunks")
def preview_document_chunks(filename: str):
    """Xem trước các chunks đã trích xuất từ 1 tài liệu để kiểm tra chất lượng phân đoạn."""
    safe_name = Path(filename).name
    target_path = DOCS_DIR / safe_name

    if not target_path.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")

    meta_path = target_path.with_suffix(".json")
    target_service = "all"
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as mf:
                mdata = json.load(mf)
                target_service = mdata.get("target_service", "all")
        except Exception:
            pass

    chunks_cache_file = target_path.with_name(f"{safe_name}.chunks.json")
    if chunks_cache_file.exists():
        try:
            with open(chunks_cache_file, "r", encoding="utf-8") as cf:
                cached_list = json.load(cf)
                return {
                    "success": True,
                    "fileName": safe_name,
                    "totalChunks": len(cached_list),
                    "chunks": cached_list
                }
        except Exception:
            pass

    processor = DocumentProcessor(chunk_size=600, chunk_overlap=120)
    try:
        chunks = processor.process_file(target_path, target_service=target_service)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Lỗi khi trích xuất chunks: {str(e)}")

    formatted_chunks = [
        {
            "id": c["id"],
            "index": c["metadata"].get("chunk_index"),
            "length": len(c["text"]),
            "text": c["text"],
            "targetService": c["metadata"].get("target_service")
        }
        for c in chunks
    ]
    try:
        with open(chunks_cache_file, "w", encoding="utf-8") as cf:
            json.dump(formatted_chunks, cf, ensure_ascii=False, indent=2)
    except Exception:
        pass

    return {
        "success": True,
        "fileName": safe_name,
        "totalChunks": len(formatted_chunks),
        "chunks": formatted_chunks
    }

@app.get("/v1/rag/models")
def get_embedding_models_info():
    """
    Trả về thông tin chi tiết về các mô hình Vector Embedding và hồ sơ tài nguyên
    được tối ưu cho cấu hình máy chủ 4GB RAM + 2-4GB Swap.
    """
    return {
        "currentModel": {
            "name": "models/gemini-embedding-001 (Google Embedding API)",
            "dimension": 3072,
            "type": "Cloud API (Google TPU)",
            "ramUsage": "0MB trên server (Toàn bộ Cloud TPU Google tính toán)",
            "latency": "120 - 250ms / batch",
            "rateLimit": "Google Gemini API Standard",
            "status": "Active (Đang hoạt động)"
        },
        "availableModels": [
            {
                "id": "gemini_embedding_001",
                "name": "Google Gemini Embedding (models/gemini-embedding-001)",
                "dimension": 3072,
                "ramUsage": "0MB",
                "pros": "Không tốn RAM server, độ chính xác tiếng Việt đỉnh cao, 3072 chiều vector sâu sắc",
                "cons": "Phụ thuộc kết nối mạng Internet",
                "isRecommended": True,
                "suitabilityFor4GB": "Hoàn hảo nhất (0MB RAM máy chủ)"
            },
            {
                "id": "onnx_minilm_l6",
                "name": "sentence-transformers/all-MiniLM-L6-v2 (ONNX)",
                "dimension": 384,
                "ramUsage": "~150MB",
                "pros": "Chạy offline hoàn toàn, tốc độ siêu nhanh (5-15ms), dự phòng khi mất mạng",
                "cons": "Độ hiểu ngữ nghĩa tiếng Việt đa tầng kém hơn Google",
                "isRecommended": False,
                "suitabilityFor4GB": "Rất tốt (Dự phòng Offline)"
            },
            {
                "id": "fastembed_bge_small",
                "name": "BAAI/bge-small-en-v1.5 (FastEmbed)",
                "dimension": 384,
                "ramUsage": "~180MB",
                "pros": "Điểm benchmark MTEB retrieval cao, thời gian khởi động nhanh với Rust core",
                "cons": "Chủ yếu tối ưu tiếng Anh",
                "isRecommended": False,
                "suitabilityFor4GB": "Rất tốt (Chiếm < 5% RAM máy chủ)"
            },
            {
                "id": "paraphrase_multilingual_l12",
                "name": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                "dimension": 384,
                "ramUsage": "~380MB",
                "pros": "Hỗ trợ tiếng Việt tự nhiên và phong phú hơn rất nhiều",
                "cons": "Tiêu tốn gấp 2.5 lần RAM so với MiniLM-L6",
                "isRecommended": False,
                "suitabilityFor4GB": "Khả thi nếu có 2GB-4GB Swap RAM"
            },
        ],
        "serverProfileRecommendation": {
            "serverRam": "4GB Physical RAM + 2GB/4GB Swap RAM",
            "ramBreakdown": {
                "osAndBaseServices": "1.2GB (Ubuntu / Windows + System services)",
                "databaseMySql": "600MB (MySQL 8.0 buffer pool)",
                "nodeExpressApi": "180MB (Node.js runtime)",
                "pythonAiService": "280MB (FastAPI + ChromaDB + ONNX Runtime)",
                "freeRamHeadroom": "1.7GB (Dư dả, an toàn tuyệt đối)"
            },
            "bestChoiceRationale": "Chuẩn hóa sử dụng models/gemini-embedding-001 (3072 chiều) kết hợp Sparse Search BM25Okapi tiếng Việt. Mô hình chạy trên Cloud TPU Google nên tiêu tốn 0MB RAM máy chủ, hoàn toàn tối ưu cho server 4GB RAM + Swap. Khi mất kết nối Internet, hệ thống tự động fallback an toàn sang all-MiniLM-L6-v2."
        }
    }

# ----------------- DYNAMIC PC BUILDER QUESTIONNAIRE (100% LLM GENERATED) -----------------

@app.post("/v1/rag/pc-builder/questions")
def post_builder_questions(req: QuestionRequest):
    """
    Sinh câu hỏi tương tác trắc nghiệm động 100% qua Gemini 3.5 Flash-Lite (kèm fallback 3.1 Flash-Lite)
    dựa trên mục đích, ngân sách và các câu trả lời từ các vòng trước.
    """
    return generate_dynamic_questions(
        purpose=req.purpose,
        budget=req.budget,
        previous_answers=req.previous_answers,
        step=req.step or 1
    )

@app.get("/v1/rag/pc-builder/questions")
def get_builder_questions(purpose: str = "gaming", budget: int = 20000000, step: int = 1):
    """
    Endpoint tương thích ngược GET cho khảo sát nhanh.
    """
    return generate_dynamic_questions(
        purpose=purpose,
        budget=budget,
        previous_answers=None,
        step=step
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=False)
