# 📘 HƯỚNG DẪN VẬN HÀNH & BẢO TRÌ HỆ THỐNG RAG (PC MALL)

Tài liệu này cung cấp toàn bộ hướng dẫn kỹ thuật, kiến trúc và quy trình bảo trì hệ thống **RAG (Retrieval-Augmented Generation)** cho website thương mại điện tử linh kiện máy tính và tư vấn build PC tại **PC Mall**.

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG RAG

Hệ thống kết hợp **3 trụ cột công nghệ**:
1. **Dữ liệu linh kiện thật từ MySQL:** Truy xuất thông số kỹ thuật đa chiều từ bảng `Product`, `ProductSku`, `SkuAttribute`, `AttributeValue`, `Category`, `Brand`.
2. **Kho tri thức phần cứng & chính sách (Knowledge Base):** Chứa các quy chuẩn tương thích socket, tản nhiệt, công thức tính nguồn PSU, cơ chế hạ xung RAM Downclocking và chính sách đổi mới 30 ngày.
3. **Bộ máy tìm kiếm kết hợp (Hybrid Search: Dense Vector + Metadata Filter):** Vừa hiểu ngữ nghĩa câu hỏi khách hàng, vừa lọc tuyệt đối chính xác giá tiền, danh mục, socket và tình trạng tồn kho trong thời gian dưới 20ms.

```
Khách hàng đặt câu hỏi / Tiêu chí Build PC
                  │
                  ▼
   [Trích xuất Ý định & Tiêu chí]
   - Ngân sách (Budget)
   - Mục đích (Purpose: Gaming / Render / Office)
   - Linh kiện có sẵn ở nhà (Exclusions: RAM, SSD, GPU, Case)
                  │
                  ▼
   [RetrieverService — Hybrid Search]
   ├── 1. Tra cứu Tri thức Kỹ thuật (knowledge.json)
   └── 2. Tra cứu & Lọc Linh kiện thật trong kho (products.json)
                  │
                  ▼
   [Augmented Context Prompt Injection]
   Bơm dữ liệu thật vào System Prompt của Senior Hardware Engineer
                  │
                  ▼
   [LLM Generation: Gemini 1.5 Flash / GPT-4o-mini / Fallback Synthesizer]
                  │
                  ▼
   [Phản hồi Kép (Dual Output)]:
   ├── 1. Lời tư vấn tự nhiên, giải thích chuyên môn khoa học
   └── 2. Structured JSON Payload (products & buildPayload)
                  │
                  ▼
   [Giao diện Chat Web & PC Builder Workspace]
   (Bấm 1-Click "Lắp Ráp Cấu Hình Này Ngay" là tự động nạp thẳng vào PC Builder)
```

---

## 2. BẢN ĐỒ CÁC FILE & MODULE MÃ NGUỒN

| File | Đường dẫn | Chức năng |
| :--- | :--- | :--- |
| **Tri thức Phần cứng** | `services/api/knowledge/hardware-rules.md` | Chứa quy chuẩn Socket LGA1700/AM5, tính nguồn PSU, RAM Downclocking, clearance tản nhiệt. |
| **Chính sách Cửa hàng** | `services/api/knowledge/store-policies.md` | Chứa chính sách 1 đổi 1 trong 30 ngày, bảo hành 36 tháng, miễn phí lắp ráp và stress test. |
| **Dịch vụ Embedding** | `services/api/src/modules/ai/embedding.service.ts` | Sinh vector 768 chiều qua Gemini `text-embedding-004`, OpenAI hoặc Fallback Deterministic Projection. |
| **Kho Lưu Trữ Vector** | `services/api/src/modules/ai/vector-store.service.ts` | Quản lý vector in-memory, tính Cosine Similarity siêu tốc, đọc/ghi file `data/vectors/*.json`. |
| **Script ETL Đồng Bộ** | `services/api/scripts/sync-embeddings.ts` | Quét dữ liệu từ MySQL, chunking văn bản thông số, tạo vector cho sản phẩm và bài viết tri thức. |
| **Bộ Tìm Kiếm Kết Hợp** | `services/api/src/modules/ai/retriever.service.ts` | Hybrid Search kết hợp Metadata Filter và Vector Similarity; định dạng Augmented Context. |
| **Chuyên gia AI Chat** | `services/api/src/modules/chat/ai-assistant.service.ts` | Điều phối RAG, Exclusions Engine (loại trừ đồ cũ), sinh cấu hình máy tương thích và gọi LLM. |
| **Chat API Controller** | `services/api/src/modules/chat/chat.controller.ts` | Endpoint `POST /api/chat/ai-consultation` phục vụ giao diện chat web. |
| **Frontend Widget** | `apps/web/src/components/chat/AiChatWidget.jsx` | Khung chat AI nổi bật, hiển thị Product Cards và nút nạp vào PC Builder. |

---

## 3. HƯỚNG DẪN VẬN HÀNH THƯỜNG NHẬT (MAINTENANCE GUIDE)

### 3.1. Khi thêm mới hoặc cập nhật giá / kho hàng trong MySQL
Mỗi khi bạn thêm linh kiện mới hoặc cập nhật tồn kho trong cơ sở dữ liệu MySQL, hãy chạy lệnh đồng bộ:
```bash
cd services/api
npm run rag:sync
```
Hệ thống sẽ:
1. Đọc toàn bộ sản phẩm đang `is_active: true`.
2. Trích xuất thông số kỹ thuật mới nhất.
3. Tự động cập nhật `services/api/data/vectors/products.json`.

### 3.2. Khi muốn bổ sung quy tắc kỹ thuật hoặc chính sách bán hàng mới
Bạn chỉ cần mở trực tiếp 2 file Markdown:
- `services/api/knowledge/hardware-rules.md` (nếu là kỹ thuật phần cứng, quy tắc tương thích).
- `services/api/knowledge/store-policies.md` (nếu là chính sách bảo hành, khuyến mãi, đổi trả).

Thêm tiêu đề cấp 2 `## Tên quy định mới` và viết nội dung bên dưới, sau đó chạy lại:
```bash
npm run rag:sync
```
Hệ thống sẽ tự động bóc tách thành chunk và nạp vào `services/api/data/vectors/knowledge.json` mà **hoàn toàn không cần phải sửa một dòng code nào**!

### 3.3. Cấu hình API Key (LLM & Embeddings)
Mở file `services/api/.env`:
```env
# Google Gemini API Key (Khuyên dùng: tốc độ cao, miễn phí dồi dào)
GEMINI_API_KEY="AIzaSy..."

# Hoặc OpenAI API Key
OPENAI_API_KEY="sk-proj-..."
```
> **Lưu ý an toàn:** Nếu bạn chưa nạp API key hoặc key bị hết hạn/mất mạng, hệ thống vẫn **hoạt động bình thường 100%** nhờ cơ chế *Deterministic Semantic Projection* và *High-Precision Grounded Synthesizer*. Chatbot sẽ không bao giờ bị sập hay báo lỗi 500.

---

## 4. HƯỚNG DẪN KIỂM THỬ HỆ THỐNG (TESTING GUIDE)

### Chạy toàn bộ Test Suite của RAG (Phase 1 đến Phase 4)
```bash
cd services/api
npx tsx --test tests/rag-phase1.test.ts tests/rag-phase2.test.ts tests/rag-phase3.test.ts tests/rag-phase4.test.ts
```
*(Kỳ vọng: 14/14 test cases PASS trong vòng ~1 giây).*

### Kiểm tra tính toàn vẹn của mã nguồn TypeScript
```bash
cd services/api
npm run build
```
*(Kỳ vọng: Lệnh `tsc --noEmit` hoàn tất với mã 0, không có lỗi kiểu dữ liệu).*

### Chạy kiểm tra hồi quy toàn bộ API hệ thống cũ
```bash
cd services/api
npm run test
```
*(Kỳ vọng: 12/12 test suites cũ của auth, vnpay, health, routes... đều pass 100%).*

---

## 5. CÁC ĐIỂM SÁNG NỔI BẬT CỦA GIẢI PHÁP

1. **Zero-Hallucination về Giá & Tồn Kho:** Sản phẩm được tư vấn lấy trực tiếp từ SKU thật trong database của cửa hàng, kèm `productId` chính xác để bấm vào là xem chi tiết hoặc mua ngay.
2. **Exclusions Engine (Xử lý đồ cũ):** Khách nói *"mình có sẵn RAM DDR4 16GB ở nhà"*, AI tự động gán giá RAM = 0đ, ép chọn Mainboard DDR4 tương thích, và dồn tiền mua card màn hình mạnh hơn.
3. **1-Click Apply to PC Builder:** Người dùng bấm *"Lắp Ráp Cấu Hình Này Ngay"*, giỏ PC Builder trên website tự động lấp đầy các linh kiện tương ứng.
4. **Hiệu năng cực cao:** Không cần dựng Docker VectorDB phức tạp, bộ nhớ vector JSON nhúng chạy trực tiếp trên RAM phản hồi dưới 20ms.
