# BÁO CÁO KIỂM TOÁN MÃ NGUỒN & ĐỘ HOÀN THIỆN THỰC TẾ — DỰ ÁN PC MALL

- **Vai trò đánh giá:** Giảng viên hướng dẫn kiêm Ủy viên Hội đồng phản biện Khóa luận Tốt nghiệp (HTTT / KTPM)
- **Phạm vi kiểm toán:** Toàn bộ mã nguồn `apps/web`, `services/api`, `services/ai-service`, `services/api/prisma/`, `docker-compose*`, `nginx/`, và các bộ kiểm thử (`services/api/tests`, `services/api/src/**/__tests__`, `apps/web/src/**/__tests__`, `e2e/`, `services/ai-service/test_rag.py`).
- **Phương pháp:** Đọc trực tiếp mã nguồn, chạy lệnh kiểm chứng tĩnh/động thực tế (typecheck, build, lint, unit/integration tests, truy vấn chỉ-đọc MySQL live trên cổng `3307` và `GET http://127.0.0.1:5001/health` của `ai-service`). Không sửa bất kỳ tệp mã nguồn nào của dự án.

---

## 1. BẢNG CHẤM ĐIỂM ĐỘ HOÀN THIỆN THỰC TẾ & ĐÁNH GIÁ SẴN SÀNG BẢO VỆ

| # | Trụ cột kiểm toán | Điểm thực tế | Đánh giá ngắn gọn (dựa trên code & kết quả chạy thật) |
|---|---|---:|---|
| 1 | Kiến trúc tổng thể, CSDL & Triển khai (MySQL/Prisma, EAV, Docker) | **58%** | EAV có dữ liệu thật (`1.357` SKU), graceful shutdown sạch; nhưng fresh migration chết hoàn toàn, dual ORM + 10 cặp file `.js`/`.ts` trùng lặp, `DECIMAL(10,2)` chạm trần 100 triệu VND, Docker prod nhiều bẫy chết. |
| 2 | Trọng tâm "SMART" của Smart PC Builder | **48%** | Khung 10 luật `COMP-001..010` và UI có đầu tư; nhưng `suggestBuild` mặc định 20tr trả về **`0/100 BLOCKED`**, 12/45 luật DB Admin bị bỏ qua 100%, PSU blocker trên FE ngược dấu, công thức 5D/FPS/Bottleneck 4K sơ sài hoặc ngược vật lý, Auto-Fix chưa thật. |
| 3 | Trợ lý AI, Python Hybrid RAG & Độ ổn định | **52%** | Có nối thông Node ↔ Python FastAPI (`:5001`) + BM25 + RRF + 2-Step Wizard; nhưng **ChromaDB collection chính đang có `0` vector**, `/v1/rag/models` trả JSON giả, default gọi model không tồn tại (`gemini-3.5-flash-lite`), có nhánh tiêm sản phẩm giả, Guardrails dễ lách, IDOR `userId` & XSS. |
| 4 | Nghiệp vụ E-Commerce cốt lõi & Chuỗi Hậu mãi | **68%** | **Mảng tốt nhất**: SePay Auto-VietQR, VNPay HMAC-SHA512, trừ kho nguyên tử, Serial 100% → e-Warranty, cô lập `INTERNAL` ticket làm nghiêm túc; nhưng MoMo IPN giả mạo 0đ, hủy đơn không idempotent/vỡ state machine, Socket.IO không auth, Guest RMA lộ PII & cướp đơn. |
| 5 | Phân quyền RBAC, Bảo mật & Toàn vẹn dữ liệu (5 vai trò) | **42%** | **Mảng rủi ro cao nhất**: Chiếm quyền `ADMIN` qua `/auth/google-mock`, Token Blacklist hỏng hoàn toàn do lệch múi giờ UTC vs `+07:00`, user bị khóa vẫn dùng được Access Token, Stored XSS upload `.svg`/`.html`, Nginx phản chiếu mọi origin + credentials, Rate Limiter tự DoS. |
| 6 | Giao diện (UI/UX), Độ khớp FE–BE & Khả năng sống sót khi Demo | **60%** | 4 cổng tách bạch, lazy-load, single-flight refresh token; nhưng Admin sửa sản phẩm thành tạo mới, xóa SKU 500, Tech gửi file ticket bị mất file, 65 lỗi ESLint Rules-of-Hooks, Dashboard bịa số liệu/trend, thiếu UI Admin Coupons, Socket leak kết nối. |
| 7 | Kiểm thử & Sức khỏe kỹ thuật (Code Quality & Tests) | **55%** | `tsc` & `vite build` pass, 193/193 test trong `npm test` pass (nhiều test thanh toán viết tốt); nhưng ESLint FE **FAIL (65 lỗi)**, 3 bộ test lõi bị bỏ quên ngoài `package.json` chạy tay **FAIL 3/26**, nhiều test làm màu/0 assertion/phá DB dev dùng chung, FE chỉ có 1 file Vitest. |
| | **TỔNG HỢP TRUNG BÌNH** | **55%** | — |

### Kết luận mức độ sẵn sàng bảo vệ KLTN: **ĐẠT CƠ BẢN — CHƯA AN TOÀN ĐỂ LÊN HỘI ĐỒNG NGAY**

- **Lý do thẳng thắn:** Dự án có quy mô bài toán rộng, nỗ lực tích hợp nhiều mảng thực tế và có một số module viết chắc tay (SePay Auto-VietQR, VNPay, xuất kho Serial → e-Warranty, cô lập ghi chú kỹ thuật `INTERNAL`). Tuy nhiên, dự án đang rơi vào bệnh điển hình của khóa luận "ôm quá nhiều tính năng nhưng thiếu khâu chốt chặt":
  1. **Điểm bán hàng trọng tâm (Smart PC Builder + Hybrid RAG)** lại gặp lỗi hỏng ngay kịch bản cơ bản nhất (`suggestBuild` 20tr ra `0/100 BLOCKED`, ChromaDB live `0` vector, luật DB Admin bị bỏ qua, công thức Bottleneck 4K ngược vật lý và FPS tính theo giá tiền).
  2. **Nhiều lỗ hổng bảo mật P0 chí mạng** có thể chứng minh chiếm quyền `ADMIN`, thanh toán 0đ hoặc nghe lén chat chỉ trong 10 giây bằng `curl`/DevTools.
  3. **Nhiều lỗi "chết demo" ngay trên màn hình quản trị** (sửa sản phẩm thành tạo mới, xóa SKU lỗi 500, đính kèm file Tech Ticket biến mất, Dashboard luôn báo 0 ticket chưa gán).
- Nếu bảo vệ ngay hiện trạng này, điểm tối đa khó vượt ngưỡng Trung bình – Khá yếu nếu hội đồng bấm kiểm tra sâu. Ngược lại, nếu xử lý dứt điểm danh sách **P0** (khoảng 3–5 ngày công tập trung) và trung thực thu hẹp phần quảng cáo quá mức ở thuật toán FPS/5D Score, dự án đủ sức đạt mức **Khá – Tốt**.

---

## 2. KẾT QUẢ CHẠY LỆNH & TRUY VẤN KIỂM CHỨNG THỰC TẾ (RAW EVIDENCE)

| Hạng mục kiểm chứng | Lệnh / Endpoint thực thi | Kết quả thô thực tế |
|---|---|---|
| Cổng dịch vụ đang mở | `Test-NetConnection 127.0.0.1` (`3307`, `5001`, `4000`, `5173`) | MySQL `:3307` **UP**, Python AI `:5001` **UP**, API `:4000` **DOWN**, Web `:5173` **DOWN**. |
| Python AI Health Live | `GET http://127.0.0.1:5001/health` | `200 OK`, `"status": "healthy"`, `"total_documents_cached": 1213`, **`"chroma_vectors_count": 0`** (chứng minh collection chính trống rỗng). |
| TypeScript API | `services/api`: `npx.cmd tsc --noEmit` | **PASS** (`EXIT=0`). |
| TypeScript Web | `apps/web`: `npx.cmd tsc --noEmit` | **PASS** (`EXIT=0`). |
| Production Build Web | `apps/web`: `npx.cmd vite build` | **PASS** (`EXIT=0`, 271 modules, 18.12s). |
| ESLint Web | `apps/web`: `npx.cmd eslint src` | **FAIL** (`EXIT=1`): **215 problems (65 errors, 150 warnings)** — toàn bộ 65 errors là `react-hooks/rules-of-hooks` (`AiChatWidget.jsx`: 19 lỗi, `AdminAiConfigPage.jsx`: 46 lỗi). |
| Frontend Vitest | `apps/web`: `npx.cmd vitest run` | **PASS** (`EXIT=0`): chỉ có **1 file** (`calculateBuilderInsights.test.js`), `11/11 passed`. |
| Python Compile Check | `services/ai-service`: `python -m compileall -q main.py reindex.py test_rag.py src` | **PASS** (`EXIT=0`). |
| API `npm test` (35 files) | `services/api`: `npm.cmd test` | **PASS** (`EXIT=0`, 114.6s): `193/193 pass`, **nhưng `auth smoke` (`tests/auth.smoke.test.ts:24`) bị `# SKIP`**; log SMTP báo lỗi Gmail `535-5.7.8 BadCredentials`. |
| 3 bộ test API bị bỏ quên ngoài `package.json` | `npx.cmd tsx --import ./tests/load-env.ts --test src/__tests__/unified-llm.test.ts src/__tests__/pc-builder.integration.test.ts src/modules/pc-builder/__tests__/compatibility.test.ts` | **FAIL** (`EXIT=1`): `23/26 pass`, **3 FAIL**: (1) `suggestBuild(20tr, gaming)` trả `score=0` (`BLOCKED`); (2) Guardrail bài thơ trả `OFF_DOMAIN` thay vì `PROHIBITED_OR_OFF_TOPIC`; (3) `unified-llm` với `apiKey: ""` vẫn gọi mạng thật mất 4.3s thay vì fallback offline. |
| Truy vấn chỉ-đọc MySQL live (`cnm_mk_hb`) | `product_skus`, `compatibility_rules`, `tickets`, `warranty_requests`, `warranties`, `audit_logs`, `users`, `token_blacklist` | `1.357` SKUs (`maxP = 99999000.00`), `45` active rules trong đó **`12` rules có `attribute_value_1/2 = NULL`**, `3` unassigned open tickets (Dashboard hiển thị `0`), `1` RMA `INSPECTING` (Dashboard hiển thị `0`), `audit_logs` có `SALES_STAFF: 5`, `TECH_STAFF: 5`, `ADMIN: 54`, `SYSTEM: 212`; `users` có `89` CUSTOMER + **`23` user `role = null`** và `81` dòng `token_blacklist` (ô nhiễm từ test). |

---

## 3. DANH SÁCH VẤN ĐỀ PHÁT HIỆN (PHÂN CẤP P0 / P1 / P2)

### NHÓM `[P0]` — NGHIÊM TRỌNG / DỄ CHẾT DEMO HOẶC SAI NGHIỆP VỤ LÕI / LỖ HỔNG BẢO MẬT CHÍ MẠNG

#### `[P0-01]` Chiếm quyền `ADMIN` không cần mật khẩu qua `POST /api/auth/google-mock`
- **(a) Vị trí:** `services/api/src/modules/auth/auth.route.ts:27`, `services/api/src/modules/auth/auth.controller.ts:198-239`.
- **(b) Thực trạng trong code:** Route `POST /api/auth/google-mock` được gắn không điều kiện, không có kiểm tra `NODE_ENV !== "production"`, không xác thực Google ID Token/OAuth. Chỉ cần gửi `{ "email": "admin@cnm.local" }`, controller truy vấn user có sẵn rồi cấp thẳng `accessToken` + `refreshToken` với đúng quyền `ADMIN`. Khi tạo user mới (`auth.controller.ts:206-210`), mật khẩu còn được lưu dạng chuỗi thô chưa băm (`"google-mock-password-..."`).
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Bất kỳ ai biết email quản trị viên đều chiếm toàn quyền hệ thống bằng 1 lệnh `curl`. Hội đồng chỉ cần mở Swagger `/api-docs` gọi thử là "đánh rớt" phần bảo mật ngay tại chỗ.
- **(d) Hướng sửa:** Xóa hẳn route này hoặc khóa cứng `if (env.nodeEnv === "production" || !env.enableMockGoogleAuth) return 403`, chỉ cho phép đăng nhập tài khoản `CUSTOMER` test trong dev; nếu giữ Google Login thật thì bắt buộc verify `id_token` bằng `google-auth-library` và băm mật khẩu ngẫu nhiên bằng `bcrypt`.

#### `[P0-02]` Giả mạo thanh toán 0đ cho mọi đơn hàng qua MoMo IPN với khóa bí mật công khai
- **(a) Vị trí:** `services/api/src/utils/momo.ts:19-30, 96-123`, `services/api/src/modules/orders/orders.controller.ts:1115-1179`, `docker-compose.prod.yml:50-77`.
- **(b) Thực trạng trong code:** `momo.ts:19-28` gán mặc định `DEFAULT_SECRET_KEY = "K951B6PE1waDMi680xqZrqH3fi6WrStj"` (khóa sandbox công khai của MoMo) khi thiếu biến `MOMO_SECRET_KEY` — và `docker-compose.prod.yml` không truyền biến này. Hàm `handleMomoIpn` (`orders.controller.ts:1115-1145`) so sánh chữ ký bằng `===` (không constant-time), và **hoàn toàn không kiểm tra** `payload.amount === order.final_amount`, không kiểm tra `order.payment_method === "MOMO"`, không kiểm tra `order.status !== "CANCELED"`.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Kẻ tấn công tự ký payload IPN bằng khóa công khai với `amount=1`, gửi vào `POST /api/orders/momo/ipn` để chuyển bất kỳ đơn hàng nào (kể cả đơn COD 100 triệu hoặc đơn đã hủy) sang `PAID` + `PROCESSING`.
- **(d) Hướng sửa:** Áp dụng đúng chuẩn đã làm tốt ở `vnpay.ts` và `sepay.service.js`: fail-closed (`503`) nếu thiếu `MOMO_SECRET_KEY` ở production, so sánh chữ ký bằng `crypto.timingSafeEqual`, khóa dòng `SELECT ... FOR UPDATE`, đối chiếu chặt `amount`, `payment_method === "MOMO"`, từ chối đơn `CANCELED`/`PAID`.

#### `[P0-03]` Token Blacklist vô hiệu hóa hoàn toàn do lệch múi giờ UTC vs `+07:00`
- **(a) Vị trí:** `services/api/src/config/database.js:54-56`, `services/api/src/services/token-blacklist.service.ts:9-44`, `services/api/src/modules/auth/auth.controller.ts:126-144`.
- **(b) Thực trạng trong code:** `database.js:55` chạy `SET time_zone = '+07:00'` trên mỗi kết nối MySQL nên `NOW()` là giờ Việt Nam. Ngược lại, `token-blacklist.service.ts:11-12` chuyển `exp * 1000` qua `.toISOString().slice(0, 19).replace("T", " ")` (chuỗi giờ **UTC**, chậm hơn 7 tiếng) rồi chèn trực tiếp vào cột `expires_at`. MySQL lưu chuỗi đó theo session `+07:00`, làm `expires_at` bị lùi về quá khứ 7 tiếng! Do đó `isTokenBlacklisted()` (`WHERE token = ? AND expires_at > NOW()`) trả về **`false` ngay lập tức** với mọi Access Token (TTL 15 phút < 7 giờ). Ngoài ra `POST /api/auth/logout` chỉ blacklist `req.body.refreshToken`, không blacklist `Authorization: Bearer` access token và không kiểm tra chữ ký trước khi insert.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Đăng xuất hoặc thu hồi Access Token hoàn toàn không có tác dụng. Hội đồng hỏi *"Tại sao em viết bảng `token_blacklist` mà Access Token vẫn sống sau khi logout?"* sẽ chạm đúng lỗi này.
- **(d) Hướng sửa:** Lưu và so sánh thống nhất theo UTC (`UTC_TIMESTAMP()` hoặc `FROM_UNIXTIME(?)` truyền Unix epoch `exp` trực tiếp cho MySQL); trong `logout`, trích và blacklist cả Access Token hợp lệ từ header `Authorization`.

#### `[P0-04]` Smart PC Builder `suggestBuild` mặc định 20 triệu trả về `0/100 BLOCKED` ngay khi chạy thật
- **(a) Vị trí:** `services/api/src/modules/pc-builder/pc-builder.service.ts:577-585` (chuẩn hóa `FCLGA1851` → `LGA1851` khi chấm điểm chọn linh kiện) vs `pc-builder.service.ts:2174-2240` (`checkRawCompatibility`), `apps/web/src/pages/public/PcBuilderPage.jsx:179`, `apps/web/src/utils/calculateBuilderInsights.js:226`.
- **(b) Thực trạng trong code:** Chạy thực tế `src/__tests__/pc-builder.integration.test.ts:61` với `suggestBuild({ budget: 20000000, useCase: "gaming" })` bị **FAIL**: hệ thống chọn `Intel Core Ultra 5 225F` (DB lưu socket `FCLGA1851`) ghép với `Mainboard Gigabyte B860M` (DB lưu socket `LGA1851`) vì bộ scorer đã bỏ tiền tố `FC`. Nhưng ngay sau đó, hàm kiểm tra tương thích (`checkRawCompatibility` trên BE và `PcBuilderPage.jsx:179` trên FE) lại so sánh chuỗi thô `"fclga1851" !== "lga1851"`, kích hoạt `COMP-001 [BLOCKER]` khiến toàn bộ cấu hình gợi ý nhận điểm **`0/100 (READINESS: BLOCKED)`** và còn gán nhầm Core Ultra 5 225F là `CPU Tier 1`.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Hội đồng chỉ cần bấm nút **"Gợi ý cấu hình 20 triệu Gaming"** ngay buổi demo là thấy chính AI/Engine của hệ thống tự đề xuất một bộ PC bị báo đỏ "Không tương thích Socket — 0 điểm — Bị chặn mua hàng"!
- **(d) Hướng sửa:** Tách hàm `normalizeSocket(raw)` duy nhất dùng chung ở cả Scorer, `checkRawCompatibility` (BE) và `calculateBuilderInsights` (FE) (bỏ tiền tố `FC`/`SOCKET`, chuẩn hóa `FCLGA1851` → `LGA1851`, `AM5`, `AM4`...); đồng thời bổ sung nhận diện dòng Intel Core Ultra 5/7/9 vào bảng phân hạng CPU Tier.

#### `[P0-05]` 100% luật tương thích tạo từ trang Admin (và 12/45 luật DB live) bị PC Builder bỏ qua hoàn toàn
- **(a) Vị trí:** `services/api/src/modules/admin/admin.service.js:813-826, 880-883`, `services/api/src/modules/pc-builder/pc-builder.service.ts:2270-2285`.
- **(b) Thực trạng trong code:** Admin UI tạo luật động dạng `source_attribute_key + operator + target_attribute_key` và lưu `attribute_value_1 = NULL, attribute_value_2 = NULL` (`admin.service.js:813-826`). Trong DB live hiện có `12/45` luật đang `is_active = 1` ở dạng này. Thế nhưng vòng lặp chấm luật động duy nhất đang chạy trong `pc-builder.service.ts:2279` viết: `if (!rule.attributeValue1 || !rule.attributeValue2) continue;` — **bỏ qua toàn bộ 100% luật tạo từ Admin UI**! Thêm vào đó, `PATCH` luật ở `admin.service.js:880-883` không cập nhật cột `is_compatible`, còn module `compatibility-rule.evaluator.ts` là dead code không ai gọi (và tự nó chứa lỗi phủ định kép ở toán tử `NEQ` + lỗi `includes()` ở `EQ`).
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Hội đồng yêu cầu demo tính năng "Luật tương thích động trong CSDL": Admin thêm 1 luật mới, quay sang PC Builder kiểm tra → **luật hoàn toàn không có tác dụng**, làm mất sạch giá trị thuyết minh về "Rule Engine động".
- **(d) Hướng sửa:** Bổ sung nhánh đánh giá theo `source_attribute_key` / `target_attribute_key` + `operator` (`EQ`, `NEQ`, `GTE`, `LTE`, `CONTAINS`) trực tiếp trong `checkRawCompatibility` khi `attributeValue1/2` là `NULL`, sửa `PATCH` cập nhật đủ `is_compatible`, và xóa file dead code `compatibility-rule.evaluator.ts`.

#### `[P0-06]` Logic chặn thiếu công suất nguồn (PSU Blocker) trên Frontend bị đảo ngược dấu
- **(a) Vị trí:** `apps/web/src/pages/public/PcBuilderPage.jsx:222-229` (và bản trùng lặp `apps/web/src/utils/builderInsightsCalculator.js:187-194`).
- **(b) Thực trạng trong code:** Khi `psuWatt < power` (ví dụ PSU 300W kéo dàn PC 600W), `psuMarginPercent = ((300 - 600) / 600) * 100 = -50%`. Điều kiện `const isPsuMarginWarning = psuWatt > 0 && psuMarginPercent < 20` đánh giá thành **`true`** (vì `-50 < 20`). Dòng tiếp theo viết `ok: psuWatt === 0 || isPsuMarginWarning || psuWatt >= power` → kết quả **`ok: true`** và `severity: "WARNING"` thay vì `"BLOCKER"`!
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Hội đồng cố tình chọn RTX 4090 + nguồn 400W để kiểm tra độ thông minh của PC Builder → giao diện vẫn chấm PASS xanh/vàng và cho bấm Mua ngay, mâu thuẫn hoàn toàn với backend `COMP-007`.
- **(d) Hướng sửa:** Sửa điều kiện thành `const isPsuSufficient = psuWatt >= power; const isPsuMarginWarning = isPsuSufficient && psuMarginPercent < 20;`, đặt `ok: psuWatt === 0 || isPsuSufficient` và `severity: !isPsuSufficient ? "BLOCKER" : isPsuMarginWarning ? "WARNING" : "PASS"`. Hợp nhất 1 bộ calculator duy nhất thay vì nhân bản code ở 3 file.

#### `[P0-07]` ChromaDB Collection chính trên `ai-service` đang có `0` vector dù báo `"healthy"` & Endpoint `/v1/rag/models` trả JSON giả
- **(a) Vị trí:** `services/ai-service/src/vector_store/chroma_manager.py:70, 81`, `services/ai-service/main.py:130-143, 498-567`.
- **(b) Thực trạng trong code:** Gọi thực tế `GET http://127.0.0.1:5001/health` trả về `"total_documents_cached": 1213` nhưng **`"chroma_vectors_count": 0`**. Nguyên nhân trực tiếp ở `chroma_manager.py:70, 81`: `is_indexed()` trả về `self.collection.count() > 0 or self.local_collection.count() > 0`. Khi khởi động, `local_collection` cũ có sẵn vector khiến `main.py` tưởng đã index xong và bỏ qua việc index `pcmall_gemini_knowledge` (`self.collection`, 0 vector). Tệ hơn, `GET /v1/rag/models` (`main.py:498-567`) không đọc trạng thái thật mà trả cứng 100% mảng JSON giả khẳng định `models/gemini-embedding-001 (3072d) Active`!
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Khi hội đồng xem Admin AI Studio hoặc kiểm tra `/health`, thấy `chroma_vectors_count: 0` sẽ bóc trần ngay việc Hybrid RAG thực tế đang mất nhánh Vector Search chính (hoặc chạy bằng bản local cũ) trong khi UI báo xanh Gemini Embedding 3072d.
- **(d) Hướng sửa:** Sửa `is_indexed()` kiểm tra đúng collection đang active (`self.collection.count() > 0` khi dùng Gemini, hoặc tự động fallback tường minh); sửa `/v1/rag/models` đọc số vector thực từ `chroma_manager` và trạng thái thực từ `GEMINI_API_KEY`.

#### `[P0-08]` Socket.IO hoàn toàn không có xác thực & phân quyền Room (Nghe lén & Cướp luồng Human Handoff)
- **(a) Vị trí:** `services/api/src/socket/socket.service.ts:104-189`, `services/api/src/modules/chat/chat.controller.ts:95, 451`.
- **(b) Thực trạng trong code:** Server Socket.IO không cài `io.use()` xác thực JWT và không kiểm tra vai trò ở bất kỳ sự kiện `join_*` nào. Bất kỳ client ẩn danh nào đều có thể phát `join_user(<id>)` để đọc thông báo đơn hàng/thanh toán của người khác, phát `join_ticket(<id>)` / `join_chat(<id>)` để nghe lén, hoặc phát `join_staff_queue` để tự ghi tên vào `onlineStaffRegistry` khiến hệ thống **tự động điều tuyến phiên chat khách hàng (kèm hồ sơ PC Build, giỏ hàng, đơn hàng)** về máy kẻ tấn công! Ngoài ra `socket.service.ts:107` hardcode origin `localhost` ngay cả trên production.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Vi phạm nghiêm trọng tính bảo mật dữ liệu thời gian thực và phân quyền 5 vai trò.
- **(d) Hướng sửa:** Thêm `io.use()` verify JWT từ `socket.handshake.auth.token` (cho phép guest chỉ với `sessionToken` riêng của phiên chat đó); chặn `join_staff_queue`/`join_tech_queue` nếu `role` không phải `SALES_STAFF`/`TECH_STAFF`/`ADMIN`; chỉ cho `join_user` với chính `socket.data.userId`; verify quyền sở hữu ticket/chat trước khi `socket.join()`.

#### `[P0-09]` IDOR không cần đăng nhập qua `req.body.userId` (5 endpoint AI/Chat) & Giả mạo nhân viên trong Live Chat
- **(a) Vị trí:** `services/api/src/modules/ai/ai.controller.js:37, 59, 66-68`, `services/api/src/modules/chat/chat.controller.ts:91, 230, 430, 559`, `services/api/src/modules/ai-advisor/ai-advisor.controller.ts:459-467`.
- **(b) Thực trạng trong code:** Cả 5 endpoint đều lấy `userId = req.user?.id || req.body?.userId`. Khách chưa đăng nhập chỉ cần truyền `userId: 2` là ép `AiContextService.aggregateUserContext(2)` đọc toàn bộ cấu hình PC, giỏ hàng, đơn hàng, bảo hành của nạn nhân đưa vào ngữ cảnh AI/briefing — đồng thời ghi đè lịch sử `ai_chats` của nạn nhân. Ở `POST /api/chat/session/:id/message` (`chat.controller.ts:230`), hệ thống tin thẳng `req.body.sender`, cho phép khách gửi tin nhắn giả danh `"staff"` hoặc `"system"`.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Rò rỉ toàn bộ dữ liệu cá nhân khách hàng chỉ bằng 1 tham số JSON và cho phép giả mạo tư vấn viên trong khung chat.
- **(d) Hướng sửa:** Tuyệt đối chỉ lấy `userId` từ `req.user?.userId` sau khi xác thực JWT (cấm fallback `req.body.userId` / `req.query.userId`); trên `chat/message`, chỉ cho phép `sender = "staff"` nếu `req.user.role` thuộc `[SALES_STAFF, TECH_STAFF, ADMIN]`.

#### `[P0-10]` Stored XSS trên cùng Origin qua Upload `.svg`/`.html` & Chat `dangerouslySetInnerHTML` + Disk-Fill ẩn danh 50MB
- **(a) Vị trí:** `services/api/src/modules/warranties/warranties.route.ts:34, 42, 131-138`, `services/api/src/modules/payments/payments.route.js:24, 34`, `services/api/src/modules/orders/orders.route.ts:43, 51`, `services/api/src/modules/tickets/tickets.route.ts:46-56`, `services/api/src/app.ts:32, 92`, `apps/web/src/pages/public/AiChatPage.jsx:70-74, 563, 679`.
- **(b) Thực trạng trong code:**
  1. Cả 4 route upload chỉ kiểm tra `file.mimetype` (trong đó `payments` và `warranties` chấp nhận cả `image/svg+xml`) và giữ nguyên đuôi `path.extname(file.originalname)`. File được phục vụ thẳng tại `/uploads/...` trên cùng domain với `contentSecurityPolicy: false` (`app.ts:32`) → mở link ảnh `.svg` hay `.html` sẽ chạy JavaScript đánh cắp `localStorage` JWT. Trên `POST /api/warranties/request` (`warranties.route.ts:131-138`), Multer (5×10MB = 50MB) chạy **trước** cả rate limit và anti-spam, ghi rác đầy ổ đĩa mà không dọn khi bị chặn `429`/`400`.
  2. `AiChatPage.jsx:70-74` biến đổi markdown sơ sài không escape `<script>`/`<img onerror>` rồi bơm thẳng vào `dangerouslySetInnerHTML` (dòng 563, 679) cho cả tin nhắn AI lẫn live chat.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Khách hàng gửi `<img src=x onerror=...>` hoặc đính kèm file `.svg` vào yêu cầu bảo hành → nhân viên/Admin mở lên bị chiếm ngay JWT từ `localStorage`.
- **(d) Hướng sửa:** Chặn tuyệt đối `image/svg+xml`, chỉ cho phép allowlist đuôi file tĩnh (`.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`, `.mp4`), kiểm tra magic bytes, gửi header `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment` cho `/uploads`, đảo `createGuestRateLimit` lên trước Multer; ở `AiChatPage.jsx`, escape toàn bộ `& < > " '` trước khi format markdown hoặc dùng `react-markdown` không bật raw HTML.

#### `[P0-11]` Hủy đơn hàng không Idempotent, vỡ State Machine & `restoreOrderInventory` phá vỡ Transaction
- **(a) Vị trí:** `services/api/src/modules/orders/orders.controller.ts:411-487, 1189-1253`, `services/api/src/modules/orders/order-inventory.service.js:3-22`, `services/api/src/modules/orders/orders.controller.ts:171-188, 228-233`.
- **(b) Thực trạng trong code:**
  1. `PATCH /api/orders/:id/status` (`orders.controller.ts:411-487`) **không có bảng kiểm tra chuyển trạng thái** và bỏ qua kiểm tra 100% Serial Number/mã vận đơn: có thể chuyển `CANCELED → PENDING → CANCELED` lặp lại vô hạn để nhân đôi tồn kho và giảm `coupons.used_count` về số âm!
  2. Cả `cancelMyOrder` (`:1189-1253`) và `patchOrderStatus` không khóa dòng `SELECT ... FOR UPDATE` và không update điều kiện (`WHERE status != 'CANCELED'`), nên 2 request hủy gửi song song sẽ hoàn tồn kho 2 lần.
  3. `restoreOrderInventory` (`order-inventory.service.js:3-22` — dùng bởi worker quá hạn thanh toán và `/api/staff/orders`) nhận tham số `connection` nhưng **không dùng**, gọi `prisma.productSku.update` toàn cục (tự commit ngoài transaction) và nuốt mọi lỗi trong `catch`.
  4. Coupon khi tạo đơn (`orders.controller.ts:171-188`) kiểm tra `usage_limit` ngoài transaction không `FOR UPDATE`, dễ bị race condition dùng vượt số lượt.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Sai lệch tồn kho và doanh thu — lỗi tối kỵ trong bài toán E-Commerce/HTTT.
- **(d) Hướng sửa:** Gom về 1 state machine duy nhất (`ORDER_STATUS_TRANSITIONS`) cho cả `/api/orders/:id/status` và `/api/staff/orders/:id/status`; dùng `SELECT ... FOR UPDATE` hoặc `UPDATE orders SET status='CANCELED' WHERE id=? AND status IN (...)` và chỉ hoàn kho khi `affectedRows === 1`; truyền `tx` (Prisma) hoặc `connection` (mysql2) đồng nhất vào `restoreOrderInventory` và `coupons`.

#### `[P0-12]` Guest Warranty lộ PII qua tìm kiếm substring, cướp quyền tạo RMA & lỗi `LAST_INSERT_ID()` ngoài Transaction
- **(a) Vị trí:** `services/api/src/modules/warranties/warranties.controller.ts:140-146, 342-357, 704-878`.
- **(b) Thực trạng trong code:** `assertWarrantyOwnership` (`:140-146`) bỏ qua hoàn toàn khi chưa đăng nhập (`if (!userId) return;`). `buildLookupWhere` (`:342-357`) tìm bằng `contains` trên mã bảo hành, serial, số điện thoại và `order_id` tuần tự → gọi ẩn danh `GET /api/warranties/lookup/1` lộ họ tên, SĐT, email, ghi chú kỹ thuật viên của khách khác. Tương tự, khách lạ gửi `POST /api/warranties/request` kèm `warrantyId` tuần tự có thể tạo đơn RMA giả làm khóa chủ thật (lỗi `409` ở dòng 841). Dòng `873` chạy `SELECT LAST_INSERT_ID()` ngoài `$transaction` trên connection pool → có thể trả về ID của request khác khi có tải đồng thời.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Lộ thông tin khách hàng (PII) và phá hỏng quy trình hậu mãi.
- **(d) Hướng sửa:** Tra cứu công khai bắt buộc khớp chính xác (`equals`) đồng thời `warranty_code`/`serial_number` **VÀ** 4 số cuối SĐT/email (ẩn bớt PII trả về như `090***1234`); tạo RMA bắt buộc xác thực chủ sở hữu hoặc khớp cặp `(serial_number + phone)`; bọc toàn bộ `INSERT warranty_requests` + `LAST_INSERT_ID()` + attachments/events vào chung 1 `prisma.$transaction`.

#### `[P0-13]` Fresh Database Migration thất bại hoàn toàn (Không thể khởi động từ DB trống)
- **(a) Vị trí:** `services/api/docker-entrypoint.sh:8-9`, `services/api/scripts/migrate.js:66-128`, `services/api/prisma/migrations/*/migration.sql`.
- **(b) Thực trạng trong code:** Hai migration đầu (`20260316*`) tạo bảng PascalCase cũ (`User`, `Order`), migration 3–4 chạy `ALTER TABLE orders`/`ticket_messages` không tồn tại → `npx prisma migrate deploy` chắc chắn lỗi. Còn `docker-entrypoint.sh:9` chạy `node scripts/migrate.js` chỉ thực thi đúng 1 file `20261022170000_canonical_schema_consolidation/migration.sql` (chứa FK trỏ tới `orders`, `users`, `order_items` chưa hề được tạo trên DB trống!) và bỏ qua luôn 2 file tạo `audit_logs` và `warranty_requests`.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Hội đồng yêu cầu `docker compose up` trên máy sạch để kiểm chứng triển khai → container API crash vòng lặp ngay bước entrypoint.
- **(d) Hướng sửa:** Tạo 1 baseline migration duy nhất từ `schema.prisma` hiện tại (`prisma migrate diff --from-empty --to-schema-datamodel`), hoặc chạy `npx prisma db push --accept-data-loss=false` (chỉ áp dụng khi khởi tạo sạch) đồng bộ với `seed-canonical.js`, rồi xóa các file migration PascalCase xung đột.

#### `[P0-14]` Chuỗi lỗi "Chết Demo" trực tiếp trên 3 cổng Admin / Tech / Public
- **(a) Vị trí:**
  1. `apps/web/src/pages/admin/AdminProductsPage.jsx:285-297, 337-339` vs `services/api/src/modules/products/products.service.js:992-1008`
  2. `services/api/src/modules/admin/admin-skus.service.js:402-420`
  3. `apps/web/src/pages/tech/TechTicketsPage.jsx:650-655` vs `apps/web/src/services/ticket.service.js:3-13` & `services/api/src/modules/tickets/tickets.route.ts:63`
  4. `apps/web/src/pages/public/CompareProductsPage.jsx:246-249, 427` vs `products.service.js:934, 959`
  5. `apps/web/src/services/socket.service.js:18-44` & `apps/web/src/hooks/useSocket.js:16`
- **(b) Thực trạng trong code:**
  1. **Sửa sản phẩm ở Admin luôn biến thành Tạo mới:** `AdminProductsPage.jsx:297` gán `setEditingProductId(detail.id)`, nhưng `GET /api/products/:id` trả về `{ product_id, ... }` (không có field `id`) → `editingProductId` luôn `undefined` → bấm Lưu gọi `POST /admin/products` báo lỗi 409 trùng slug hoặc nhân đôi sản phẩm!
  2. **Xóa SKU ở Admin chắc chắn HTTP 500:** `admin-skus.service.js:404-405` gọi `prisma.warranty.count` & `prisma.inventorySerial.count` (2 model không tồn tại trong `schema.prisma`, ném `TypeError` đồng bộ), và dòng 416 gọi `prisma.cartItem.deleteMany({ where: { sku_id } })` sai tên cột (cột thật là `product_variant_id`).
  3. **Tech đính kèm ảnh/video khi trả lời Ticket bị mất sạch:** `TechTicketsPage.jsx:650-655` gửi object JSON `{ message, attachments: replyFiles, visibility }` thay vì `FormData` nên Multer (`tickets.route.ts:63`) bỏ qua hoàn toàn `req.files`.
  4. **Trang So sánh sản phẩm thêm sai SKU vào giỏ:** `CompareProductsPage.jsx:248` tìm `variant?.id || variant?.sku_id` nhưng API trả `variant_id` → luôn fallback sang `productId` gây thêm nhầm SKU hoặc lỗi 404.
  5. **Socket.IO client rò rỉ kết nối:** `getSocket()` kiểm tra `if (!socket || !socket.connected)` và được gọi thẳng trong thân render của `useSocket()` → khi đang kết nối (`connected === false`), mỗi lần re-render tạo thêm 1 kết nối `io()` mới không đóng kết nối cũ.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Bất kỳ thao tác demo CRUD cơ bản nào của Admin (Sửa sản phẩm, Xóa SKU) hoặc Tech (Trả lời ticket kèm ảnh) đều hỏng ngay trước mắt hội đồng.
- **(d) Hướng sửa:** Sửa `detail.id ?? detail.product_id ?? productId` ở `AdminProductsPage.jsx:297`; sửa tên model/cột (`warrantyItem`, `orderItemSerial`, `product_variant_id`) ở `admin-skus.service.js:403-416`; đóng gói `FormData` ở `TechTicketsPage.jsx:650` giống `TicketDetailPage.jsx:271`; thêm `variant?.variant_id` ở `CompareProductsPage.jsx:248`; sửa singleton `if (!socket)` (bỏ `!socket.connected`) ở `socket.service.js:19`.

#### `[P0-15]` Cấu hình CORS Production của Nginx phản chiếu mọi Origin kèm Credentials
- **(a) Vị trí:** `nginx/nginx.conf:80-83`, `nginx/nginx.http.conf:55-58`.
- **(b) Thực trạng trong code:** Cả 2 file Nginx đều cấu hình cứng `add_header Access-Control-Allow-Origin $http_origin always;` đi cùng `Access-Control-Allow-Credentials "true" always;`, vô hiệu hóa hoàn toàn whitelist CORS của Express (`app.ts:49-70`) và làm trùng header CORS.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Bất kỳ website độc hại nào cũng gửi được request kèm cookie/credentials sang API production.
- **(d) Hướng sửa:** Xóa 4 dòng `add_header Access-Control-*` khỏi Nginx để Express xử lý CORS theo `CORS_ORIGIN` allowlist (hoặc dùng `map $http_origin` whitelist cụ thể trong Nginx).

---

### NHÓM `[P1]` — LỆCH FE–BE / THIẾU SÓT LOGIC / RỦI RO BẢO MẬT CAO

#### `[P1-01]` Tài khoản bị khóa / hạ quyền vẫn sử dụng được Access Token cũ & Refresh Token không xoay vòng
- **(a) Vị trí:** `services/api/src/middlewares/auth.middleware.ts:10-34, 69-86`, `services/api/src/modules/admin/admin.service.js:637-693`, `services/api/src/modules/auth/auth.controller.ts:101-124, 353-387`.
- **(b) Thực trạng trong code:** `authenticate()` chỉ verify chữ ký JWT, không kiểm tra `users.status` hay `role_id` trong DB; Admin khóa hoặc hạ quyền user không thu hồi token đang hoạt động nên tài khoản bị khóa vẫn thao tác bình thường trong 15 phút (kể cả `GET /auth/me`). `POST /auth/refresh` có kiểm tra `status === "ACTIVE"` nhưng không xoay vòng/blacklist refresh token cũ; `changePassword` không hủy các phiên cũ; `optionalAuthenticate` và `streamOrderEvents` bỏ qua hoàn toàn `isTokenBlacklisted()`.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Đây là câu hỏi kiểm tra bảo mật kinh điển: *"Nếu Admin bấm khóa nhân viên đang ăn cắp dữ liệu, nhân viên đó có bị đá ra ngay không?"* — hiện tại là **Không**.
- **(d) Hướng sửa:** Lưu `token_version` (hoặc truy vấn cache ngắn `status, role_id`) trong `users`, tăng `token_version` khi khóa/hạ quyền/đổi mật khẩu và đối chiếu trong `authenticate()`; blacklist refresh token cũ khi gọi `/auth/refresh`.

#### `[P1-02]` Các công thức "SMART" (5D Score, Dynamic Bottleneck 4K, FPS, What-If, Auto-Fix, COMP-008) sơ sài hoặc ngược vật lý
- **(a) Vị trí:**
  - 5D Health Score: `services/api/src/modules/pc-builder/xai-explanation.service.ts:563-604`, `apps/web/src/components/pc-builder/BuildSummarySidebar.jsx:240`.
  - Dynamic Bottleneck: `services/api/src/modules/pc-builder/pc-builder.service.ts:764-784, 1253`, `apps/web/src/components/pc-builder/AiBuildProposalModal.jsx:242-246`.
  - FPS & What-If: `apps/web/src/components/pc-builder/WhatIfComparisonPanel.jsx:30-36`, `apps/web/src/pages/public/PcBuilderPage.jsx:1940-2016`, `pc-builder.service.ts:1921-1923`.
  - 1-Click Auto Fix & `COMP-008` & XAI Drawer: `apps/web/src/utils/pcBuilderUtils.js:223-311`, `pc-builder.service.ts:3166`, `apps/web/src/components/pc-builder/XAIExplanationDrawer.jsx:350, 401`, `xai-explanation.service.ts:383-384`, `pc-builder.service.ts:2231`.
- **(b) Thực trạng trong code:**
  1. **5D Score thiếu cơ sở dữ liệu:** `valueScore` không hề đọc giá hay ngân sách; `upgradeScore` không kiểm tra khe RAM trống/khe M.2/socket/dư công suất PSU; `estimatePerformance` chỉ có 10 mẫu GPU (RTX 50xx/3080/3090 rơi vào mặc định 50 điểm < GTX 1650 được 55 điểm). Trên UI, `BuildSummarySidebar.jsx:240` viết `compatibilityScore || 90` làm cấu hình **0 điểm bị hiển thị thành 90%**, và chỉ vẽ 4/5 chiều.
  2. **Bottleneck 4K ngược vật lý:** `pc-builder.service.ts:764-784` nhân `gpuScore * 1.35` ở độ phân giải 4K → làm `cpuScore < weightedGpuScore` → kết luận **CPU bị nghẽn nặng hơn ở 4K gấp 3 lần 1080p** (thực tế vật lý gaming: lên 4K tải dồn sang GPU nên nghẽn CPU phải *giảm*, nghẽn GPU phải *tăng*!). Dòng `1253` còn truyền nhầm `options.caseStyle` vào tham số `resolution`; `AiBuildProposalModal.jsx:242` đọc nhầm key `bottleneckPercent` thay vì `bottleneckPercentage` nên luôn hiện `4%`.
  3. **FPS & What-If làm màu:** `WhatIfComparisonPanel.jsx:30-36` tính FPS hoàn toàn bằng công thức tuyến tính theo tổng giá tiền (`round(price/100000*1.1)+120`, không nhìn GPU!) và dùng `score || 96` biến lỗi 0 điểm thành `96/100 BUILD READY`. Nếu gọi `/suggest` lỗi, nhánh fallback tự bốc đại linh kiện theo giá gần nhất không check tương thích và gán cứng `score: 96, compatible: true`. `pc-builder.service.ts:1921-1923` hardcode Wukong 65–85 FPS / Valorant 240+ FPS cho mọi máy.
  4. **Auto-Fix & COMP-008 chưa thật:** `findReplacementProducts` (`pc-builder.service.ts:3166`) bỏ qua tham số `_currentBuild`; XAI Drawer không kiểm tra `!item.ok` (`:350, 401`) nên vẽ hộp đỏ xung đột ngay cả khi check đã PASS; `COMP-008` chỉ kiểm tra `psuWatt >= 450/650` không hề đọc đầu cắm PCIe 8-pin/12VHPWR nhưng XAI tuyên bố đã kiểm tra ATX 3.0 12VHPWR; case SFF/ITX có `rawCaseClearance <= 250` bị ghi đè cứng thành `360mm` (`pc-builder.service.ts:2231`).
  5. **Lệch mã luật giữa Node và Python:** `COMP-003`/`004`/`006` có ý nghĩa khác nhau giữa Node/FE và `services/ai-service/src/data/indexer.py:20-35`.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Hội đồng ngành HTTT/KTPM cực kỳ dị ứng với công thức giả (FPS theo giá tiền, 4K ngược vật lý, `|| 90` che lỗi 0 điểm). Chỉ cần 1 câu hỏi *"Công thức tính FPS và Bottleneck 4K lấy cơ sở nào?"* là lộ hết.
- **(d) Hướng sửa:** Sửa ngay toán tử `??` (thay `|| 90`, `|| 96`); đảo hệ số độ phân giải 4K (ở 4K giảm hiệu dụng GPU so với CPU, không nhân tăng `gpuScore`); gắn bảng benchmark tier thực (CPU/GPU benchmark table theo model hoặc lưu thêm thuộc tính `benchmark_score` trong EAV) để tính FPS/Bottleneck và 5D Score theo đúng biến đầu vào; thêm guard `!item.ok` trong `XAIExplanationDrawer`; đồng bộ mã `COMP-001..010` giữa Node và Python.

#### `[P1-03]` Rủi ro AI bịa sản phẩm / bán hàng hết kho & Kiến trúc LLM Gateway / Circuit Breaker chắp vá
- **(a) Vị trí:** `services/api/src/modules/ai/ai.service.js:1171, 1602-1628`, `services/api/src/modules/ai-advisor/ai-assistant.service.ts:186-369`, `services/api/src/modules/pc-builder/pc-builder.service.ts:3040-3141`, `services/api/src/modules/ai/unified-llm.service.js:45-160, 400-520`, `services/api/src/modules/ai/ai-llm.provider.ts`, `services/api/src/modules/ai/rag-client.service.ts`, `services/ai-service/src/data/indexer.py:69-83`, `services/ai-service/src/retrieval/hybrid_engine.py:46-53`, `services/ai-service/main.py:176-180`.
- **(b) Thực trạng trong code:**
  1. **Catalog Grounding hở:** `fetchAiCatalogProducts` (`ai.service.js:1171`) không lọc `stock > 0`; `getSynthesizedBuildByBudget` (`:1602-1628`) và `ai-assistant.service.ts` chèn thẳng danh sách linh kiện giả hardcode khi DB thiếu; `ai-suggest-stream` (`pc-builder.service.ts:3040-3141`) không chạy `checkRawCompatibility` lên cấu hình AI chọn; Python `indexer.py` chỉ đọc file JSON tĩnh trên đĩa, không đồng bộ tồn kho/giá trực tiếp từ MySQL.
  2. **Model mặc định không tồn tại & 2 Gateway song song:** Mặc định trỏ `gemini-3.5-flash-lite` và blacklist model thật `gemini-2.0-flash`, `gemini-2.5-flash`. Song song `unified-llm.service.js` lại còn `ai-llm.provider.ts` (không circuit breaker, thử 6 vòng × 25s = treo tối đa 150s) và 2 bộ RAG song song (Python ChromaDB vs Node hash-vector JSON `embedding.service.ts:26-28`).
  3. **Chưa phải Circuit Breaker thực thụ:** `unified-llm.service.js` chỉ có cooldown cho Gemini stream, không có state `CLOSED/OPEN/HALF_OPEN` cho non-stream Gemini hay Groq/OpenAI/DeepSeek; dùng chung 1 `AbortController` khiến timeout ở provider 1 hủy luôn provider dự phòng; `rag-client.service.ts` không có circuit breaker nên khi `:5001` tắt vẫn chờ timeout tới 25–40s.
  4. **Lỗi trong Python Hybrid RAG:** `main.py:176-180` bỏ qua `req.target_service`; `hybrid_engine.py:46-53` cắt top `search_k` BM25 **trước** khi lọc `doc_type_filter` (làm rớt tài liệu đúng loại); cổng `:5001` phơi lộ toàn bộ API upload/xóa tài liệu RAG không cần xác thực.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Thuyết trình về "RAG chống ảo giác + Circuit Breaker chịu lỗi" nhưng thực tế có đường dẫn tiêm hàng giả, gợi ý hàng hết kho và treo khi mất mạng/hết quota.
- **(d) Hướng sửa:** Lọc `stock > 0` + `status = 'ACTIVE'` khi lấy catalog; xóa toàn bộ sản phẩm giả hardcode (khi không có hàng thì trả lời không có hàng); chạy `checkRawCompatibility` hậu kiểm trên mọi output của `ai-suggest-stream`; đặt model thật (`gemini-2.5-flash` / `gemini-2.0-flash`); gom về 1 LLM Gateway duy nhất với Circuit Breaker chuẩn (`failureThreshold`, `cooldownMs`, AbortController riêng từng provider) và thêm internal API key bảo vệ `:5001`.

#### `[P1-04]` AI Guardrails dễ bị vượt qua & Lỗi cache/rate-limit/plain-text key trong AI module
- **(a) Vị trí:** `services/api/src/modules/ai/ai-guardrail.service.js:155-165`, `services/api/src/modules/ai/ai.controller.js:42-64`, `services/api/src/modules/ai/ai-rule.service.js:408, 767`, `services/api/src/routes/index.ts:81`, `services/api/src/modules/ai/ai.route.js:27-34`.
- **(b) Thực trạng trong code:** `hasPcContext` chứa từ quá chung như `"may"`, `"mua"` (bỏ dấu trùng chữ **"mùa"** — chính nguyên nhân làm `pc-builder.integration.test.ts:194` fail với câu *"Viết bài thơ về mùa thu"*!), `"gia"`, `"hoc"`, `"dung"`, còn `DOMAIN_WHITELIST_KEYWORDS` chứa `"ai"` (trùng đại từ "ai") và `"my"` (trùng "Mỹ") → tắt luôn bộ lọc ngoài phạm vi. Mảng pattern có 23 phần tử nhưng code kiểm tra `idx >= 24` nên cờ bạc không bị gắn mức severe. `ai.controller.js:42-64` cache theo nội dung tin cuối mà bỏ qua lịch sử hội thoại và không xóa cache khi Admin sửa Rule/Prompt; `ai-rule.service.js:767` gọi đồng bộ `fs.writeFileSync` ghi file JSON (chứa API key dạng plaintext) ngay trên mỗi request `BUILDER_SUGGEST`; `aiRateLimiter` bị gắn 2 lần và bóp luôn `/api/ai/admin/*` lẫn live chat `/api/chat`.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Hội đồng gõ thử câu hỏi ngoài lề có chữ "mùa", "máy bay", "ai", "giá vàng" → AI không chặn mà trả lời lan man.
- **(d) Hướng sửa:** Dùng word-boundary chính xác hoặc cụm từ ghép có ngữ cảnh phần cứng (`"mua pc"`, `"may tinh"`, `"gia vga"`) thay vì từ đơn mơ hồ; sửa `idx` của mảng severe; bỏ `writeFileSync` khỏi luồng đọc gợi ý; tách `aiRateLimiter` ra khỏi `/admin/*` và `/chat`; mã hóa API key lưu trữ bằng AES-256-GCM hoặc giữ trong biến môi trường.

#### `[P1-05]` 65 lỗi ESLint `react-hooks/rules-of-hooks` có nguy cơ crash trắng trang
- **(a) Vị trí:** `apps/web/src/components/chat/AiChatWidget.jsx:29-101` (19 lỗi), `apps/web/src/pages/admin/AdminAiConfigPage.jsx:134-517` (46 lỗi).
- **(b) Thực trạng trong code:** Cả hai component đều viết `if (...) return ...` **trước** hàng chục `useState`/`useEffect`/`useMemo`/`useRef`. Chạy `npx.cmd eslint src` fail với 65 errors. Khi người dùng điều hướng từ trang excluded (`/ai-chat`) sang trang thường hoặc trạng thái đăng nhập thay đổi, React ném ngoại lệ `"Rendered more/fewer hooks than during the previous render"`.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Chuyển tab qua lại giữa AI Chat và Trang chủ hoặc đăng xuất ở Admin AI Config có thể làm sập giao diện ngay giữa buổi demo.
- **(d) Hướng sửa:** Đưa toàn bộ câu lệnh `if (...) return ...` xuống **sau** tất cả các lời gọi Hook (hoặc tách guard route ra component bọc ngoài).

#### `[P1-06]` Admin Dashboard bịa số liệu tăng trưởng & luôn báo `0` Ticket chưa gán / `0` RMA chờ xử lý
- **(a) Vị trí:** `services/api/src/modules/admin/admin-system.service.js:227-231`, `apps/web/src/pages/admin/AdminDashboardPage.jsx:37-78, 284-285`, `apps/web/src/pages/admin/AdminSystemPage.jsx:176-177, 595`.
- **(b) Thực trạng trong code:**
  1. `admin-system.service.js:227` truy vấn cột không tồn tại `tickets.assigned_to` (cột thật: `assigned_to_id`, DB live đang có `3` ticket chưa gán) và dòng `229` truy vấn nhầm bảng `warranties` thay vì `warranty_requests` (DB live có `1` RMA `INSPECTING`) → `.catch(() => [])` nuốt lỗi SQL khiến Dashboard luôn hiện `0`!
  2. `AdminDashboardPage.jsx:37-78` tự chế phần trăm tăng trưởng `+11%..+25%` (`calculateTrend`) từ 1 con số đơn, vẽ biểu đồ doanh thu/trạng thái đơn giả khi thiếu chuỗi thời gian, và hardcode badge xanh `"Dịch vụ AI: Sẵn sàng"` (dòng 285) không hề gọi healthcheck.
  3. `AdminSystemPage.jsx:177, 595` lọc Audit Logs theo `["ALL", "ADMIN", "STAFF", "TECH"]` bằng so sánh tuyệt đối, trong khi DB lưu `"SALES_STAFF"` (5 dòng) và `"TECH_STAFF"` (5 dòng) → bấm nút lọc `STAFF`/`TECH` luôn hiện 0 sự kiện.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Hội đồng tạo 1 ticket mới rồi mở Admin Dashboard thấy "0 Ticket chưa phân công" hoặc bấm lọc Audit Log theo `TECH` ra rỗng dù vừa thao tác.
- **(d) Hướng sửa:** Sửa SQL thành `assigned_to_id IS NULL` và `FROM warranty_requests WHERE status IN ('RECEIVED','INSPECTING','REPAIRING','WAITING_PARTS')`; bỏ các hàm chế số liệu giả trên Dashboard, gọi endpoint health thật cho trạng thái AI; sửa bộ lọc Audit Log khớp `SALES_STAFF`/`TECH_STAFF` và thêm phân trang server-side.

#### `[P1-07]` Thiếu hoàn toàn giao diện Admin quản lý Mã giảm giá (Coupon) & VNPay bị gỡ khỏi Checkout gây lệch cấu hình/E2E
- **(a) Vị trí:** `services/api/src/modules/coupons/coupons.route.ts:18-20`, `apps/web/src/services/coupon.service.js`, `apps/web/src/routes/AppRouter.jsx`, `apps/web/src/pages/public/CheckoutPage.jsx:138-157`, `apps/web/src/pages/public/PaymentResultPage.jsx:53`, `e2e/checkout-full-flow.spec.ts:181-205`.
- **(b) Thực trạng trong code:** Backend đã làm đầy đủ `GET/POST/PUT /api/coupons/admin`, nhưng Frontend có **0 route, 0 service, 0 trang quản trị Coupon** (Admin không thể tạo/sửa/tắt mã giảm giá trên UI). Đồng thời, `CheckoutPage.jsx:138-157` đã xóa lựa chọn VNPay (chỉ còn COD và VietQR) nhưng trang `AdminSystemPage` vẫn cho cấu hình VNPay mock/sandbox/live, `PaymentResultPage.jsx:53` điều hướng sai đơn VNPay bị hủy sang trang VietQR, và `e2e/checkout-full-flow.spec.ts:182` bị hỏng 100%.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Nếu báo cáo ghi có quản lý khuyến mãi/VNPay mà trên UI không thấy nút nào, hội đồng sẽ đánh giá là tính năng làm nửa vời.
- **(d) Hướng sửa:** Bổ sung trang `/admin/coupons` nối tới `/api/coupons/admin` (khoảng 150 dòng UI theo đúng mẫu `AdminUsersPage`), và quyết định dứt khoát: bật lại thẻ chọn VNPay trên `CheckoutPage` hoặc gỡ cấu hình VNPay khỏi Admin/E2E cho nhất quán.

#### `[P1-08]` Hở đường vòng qua cổng Serial 100% & Lỗi nghiệp vụ E-Commerce / Hậu mãi khác
- **(a) Vị trí:** `services/api/src/modules/shipments/shipments.service.js`, `services/api/src/modules/warranties/warranties.controller.ts:120-123, 956`, `services/api/src/modules/cart/cart.controller.ts:325-337`, `services/api/src/modules/products/products.service.js:470-650`, `services/api/src/modules/orders/orders.controller.ts:166, 800-860`, `apps/web/src/pages/tech/TechWarrantiesPage.jsx:215-241`.
- **(b) Thực trạng trong code:**
  1. Tạo/cập nhật vận đơn qua `/api/shipments` không kiểm tra cổng gán đủ 100% Serial Number như `/api/staff/orders`.
  2. RMA 6 bước không có state machine ở BE: `normalizeRequestStatus` (`warranties.controller.ts:120-123`) ép mọi chuỗi trạng thái lạ thành `RECEIVED`, cho phép nhảy ngược từ `COMPLETED` về `RECEIVED`. Trên FE, `TechWarrantiesPage.jsx:215-241` tự động poll 20 giây/lần tạo reference `selectedRequest` mới làm **xóa trắng ghi chú & ảnh kỹ thuật viên đang nhập dở**!
  3. `mergeMyCart` (`cart.controller.ts:325-337`) chỉ đọc `productVariantId`/`skuId`, làm rơi mất sản phẩm khách vãng lai thêm bằng `productId`; khách đăng nhập từ Giỏ hàng sang Checkout bị mất mã giảm giá đã áp vì `LoginPage.jsx:88-94` bỏ `from.state`.
  4. `products.service.js` không lọc `p.is_active = 1` ở truy vấn catalog và fallback `sku_id = product_id` sai ở dòng 612; `orders.controller.ts:166` tin thẳng `shippingFee` do client gửi lên; Admin từ chối chứng từ thanh toán có thể kéo đơn đã `PAID`/`SHIPPED` về `PENDING`.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Kỹ thuật viên đang gõ biên bản bảo hành trên buổi demo hơn 20 giây bỗng bị xóa sạch form; hoặc khách thử sửa `shippingFee = 0` trong request checkout.
- **(d) Hướng sửa:** Áp dụng kiểm tra Serial chung ở `shipments.service.js`; thêm map `RMA_STATUS_TRANSITIONS` ở BE và đổi dependency `useEffect` ở `TechWarrantiesPage.jsx:241` thành `[selectedRequest?.id, selectedRequest?.status]`; tính `shippingFee` phía server; bổ sung lọc `p.is_active = 1`.

#### `[P1-09]` Giới hạn `DECIMAL(10,2)` trên giá sản phẩm & Lỗ hổng `cloneBuild` IDOR & `SALES_STAFF` lấn quyền kỹ thuật
- **(a) Vị trí:** `services/api/prisma/schema.prisma:265, 288`, `services/api/src/modules/pc-builder/pc-builder.service.ts:478-504`, `services/api/src/modules/warranties/warranties.route.ts:146-152`, `services/api/src/modules/tickets/tickets.controller.ts:294`.
- **(b) Thực trạng trong code:** `Product.price` và `ProductSku.price` là `DECIMAL(10,2)` (tối đa `99.999.999,99` VND — DB live đã chạm trần `99.999.000`). Thêm 1 dàn PC hoặc GPU RTX 5090 giá ≥ 100 triệu sẽ báo lỗi MySQL 1264. `cloneBuild` (`pc-builder.service.ts:478-504`) không kiểm tra `user_id = ? OR is_public = 1` nên user bất kỳ nhân bản được cấu hình riêng tư của người khác. `SALES_STAFF` đang được cấp quyền ghi trực tiếp lên RMA kỹ thuật và Ticket kỹ thuật (bao gồm xem/viết ghi chú `INTERNAL`).
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Cửa hàng PC High-end không nhập được sản phẩm 100 triệu đồng; ranh giới 5 vai trò bị nhòe giữa `SALES_STAFF` và `TECH_STAFF`.
- **(d) Hướng sửa:** Nâng `Product.price` và `ProductSku.price` lên `DECIMAL(12,2)`; thêm điều kiện `(user_id = ? OR is_public = 1)` vào `cloneBuild`; giới hạn quyền ghi RMA và ghi chú kỹ thuật chỉ cho `TECH_STAFF` và `ADMIN` (cho `SALES_STAFF` chỉ đọc nếu cần CSKH).

#### `[P1-10]` Self-DoS Rate Limiter (thiếu `trust proxy`), rò rỉ Raw 500 Error & Bẫy Docker Production
- **(a) Vị trí:** `services/api/src/app.ts:20`, `services/api/src/middlewares/rate-limiter.middleware.ts:35, 72-90`, `services/api/src/routes/index.ts:67`, `services/api/src/middlewares/error.middleware.ts:55-58`, `services/api/src/utils/health-check.ts:23`, `docker-compose.prod.yml:10, 52, 143`, `nginx/nginx.conf:43`.
- **(b) Thực trạng trong code:**
  1. `app.ts` không gọi `app.set("trust proxy", 1)`. Sau Nginx, mọi người dùng dùng chung IP container Nginx nên quá 10 lần gọi `/api/auth/*` (kể cả `/me`, `/refresh`) sẽ khóa đăng nhập **toàn hệ thống** 15 phút.
  2. `error.middleware.ts:55-58` trả thẳng `err.message` trên lỗi 500 kể cả ở production; `GET /api/health` in thẳng lỗi kết nối DB ra ngoài.
  3. `docker-compose.prod.yml` có 4 bẫy: `MYSQL_USER=${DB_USER}` gặp `root` sẽ làm MySQL 8 từ chối khởi tạo; healthcheck Nginx gọi `http://127.0.0.1/health` bị redirect 301 sang HTTPS self-signed dẫn tới `unhealthy`; Nginx thiếu `client_max_body_size` (mặc định 1MB làm mọi upload ảnh/tài liệu >1MB chết 413); thiếu volume `./data/images` và `ai-rules-store.json`.
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Deploy production thật bằng Docker sẽ lỗi upload 413, container Nginx luôn `unhealthy` và lỗi 500 lộ cấu trúc bảng SQL.
- **(d) Hướng sửa:** Thêm `app.set("trust proxy", 1)`; chỉ gắn `authRateLimiter` vào `/login`, `/register`, `/forgot-password`; ẩn `err.message` khi `statusCode >= 500` ở production; thêm `client_max_body_size 25m;` và endpoint `/health` không redirect HTTPS trong Nginx; tách rõ `MYSQL_USER` (non-root) và mount đủ volume.

#### `[P1-11]` 3 bộ test lõi bị bỏ quên (và đang FAIL), Test giả tạo & Ô nhiễm DB dev dùng chung
- **(a) Vị trí:** `services/api/package.json:12`, `services/api/tests/route-smoke.test.ts:52-59`, `services/api/tests/chat-config.test.ts:6-20`, `services/api/tests/auth.smoke.test.ts:10, 24`, `services/api/tests/load-env.ts:4-8`, `services/api/src/modules/pc-builder/__tests__/compatibility.test.ts`, `services/api/src/modules/pc-builder/__tests__/test-ai-two-flows.mjs:194, 234`, `services/ai-service/test_rag.py:13-45`, `package.json:18`.
- **(b) Thực trạng trong code:**
  - 3 file test trong `src/` bị loại khỏi `npm test` — khi chạy tay **FAIL 3/26 test** (lộ lỗi `suggestBuild` 0 điểm, lỗi Guardrail, lỗi `unified-llm` gọi mạng thật khi `apiKey=""`).
  - Nhiều test không kiểm chứng logic thật: `compatibility.test.ts` chỉ truyền object `{ ok: false }` giả vào XAI mà không hề gọi `evaluateCompatibility`; `route-smoke.test.ts:52-59` lấy status `401` làm bằng chứng route `PATCH /api/pc-builder/1/items/cpu` tồn tại (thực tế route này **không tồn tại**, do `router.use(authenticate)` chặn trước); `chat-config.test.ts` chỉ test gán biến JS; `test_rag.py` có **0 lệnh `assert`**; `test-ai-two-flows.mjs` tự điền `?? 85` / `?? 50` và luôn exit 0; `package.json:18` (`check:all`) sai đường dẫn `cd ../apps/web`.
  - Chạy `npm test` ghi thẳng dữ liệu rác vào DB phát triển `cnm_mk_hb` (để lại 81 dòng `token_blacklist`, 23 user `role=null`, trừ tồn kho thật).
- **(c) Tác động thực tế / Hội đồng sẽ hỏi vặn:** Hội đồng kiểm tra độ tin cậy của con số "193/193 test pass" sẽ thấy test bỏ qua các ca lỗi thật và làm bẩn DB demo.
- **(d) Hướng sửa:** Đưa 3 bộ test `src/` vào `npm test` và sửa hết 3 test đang fail; dùng DB test tách biệt (`cnm_mk_hb_test`) + dọn rác trong `after()`; viết lại `compatibility.test.ts` gọi thật `checkRawCompatibility`; chuyển `test_rag.py` sang `pytest` có `assert` rõ ràng; sửa `cd ../../apps/web` trong `check:all`.

---

### NHÓM `[P2]` — CẦN ĐÁNH BÓNG THÊM ĐỂ ĐẠT ĐIỂM TỐI ĐA

#### `[P2-01]` Rác kiến trúc: 10 cặp file `.js`/`.ts` trùng lặp, Dual ORM (`Prisma` + `mysql2`) & Dead Code
- **(a) Vị trí:** `services/api/src/config/env.{js,ts}`, `services/api/src/modules/{orders,cart,tickets,users,warranties}/*.controller.{js,ts}`, `services/api/src/modules/pc-builder/{compatibility-rule.evaluator,power-rule.evaluator,heuristic-specs.parser,pc-builder.repository,pc-builder.validator}.ts`, `services/api/src/modules/admin/{test.tmp,test2.tmp}`, `services/api/src/legacy/unused_routes/`.
- **(b) Thực trạng trong code:** `tsx` ưu tiên `.ts` khiến nhiều file `.js` trở thành dead code (làm mất luôn 9 lời gọi `recordAuditLog` nằm trong `orders.controller.js` và `tickets.controller.js` cũ!), trong khi `env.ts` lỏng lẻo hơn `env.js` (cho phép JWT secret 1 ký tự ở production). Ngoài ra `pc-builder.service.ts:354-374` vẫn chạy `ALTER TABLE` lúc runtime.
- **(c) Tác động:** Gây khó bảo trì, gây nhầm lẫn khi đọc code và làm hội đồng nghi ngờ mức độ kiểm soát codebase của nhóm.
- **(d) Hướng sửa:** Xóa sạch file `.js` trùng, `*.tmp`, `legacy/unused_routes/`, đồng bộ kiểm tra độ dài secret tối thiểu 24 ký tự vào `env.ts`.

#### `[P2-02]` Thiếu ràng buộc toàn vẹn & lệch kiểu trong `schema.prisma`
- **(a) Vị trí:** `services/api/prisma/schema.prisma:80-165, 267, 293, 368-378, 492-540, 564-568`.
- **(b) Thực trạng trong code:** `WarrantyRequest.id` là `BigInt` nhưng `request_id` ở 3 bảng con là `Int` không FK, không `@@index`; thiếu `@unique` trên `ProductSku.sku`, `Product.slug`, `Cart.user_id`, `CartItem(cart_id, product_variant_id)`, `SkuAttribute(sku_id, attribute_value_id)`, `ProductReview(product_id, user_id)`; thiếu index trên `Order(status, payment_status, created_at)`; `Coupon.start_date/end_date` dùng `TIMESTAMP` (giới hạn năm 2038).
- **(c) Tác động:** Dễ phát sinh dữ liệu trùng lặp khi tải đồng thời hoặc giảm hiệu năng truy vấn khi dữ liệu lớn.
- **(d) Hướng sửa:** Chuẩn hóa kiểu khóa ngoại `WarrantyRequest`, bổ sung các `@unique` và `@@index` còn thiếu rồi chạy migration đồng bộ.

#### `[P2-03]` Thiếu phủ `audit_logs` trên nhiều hành động nhạy cảm & các tiểu tiết UI/UX gây cấn khi demo
- **(a) Vị trí:** `services/api/src/modules/{auth,orders,tickets,warranties,coupons,ai}/`, `apps/web/src/pages/public/{HomePage.jsx:22-38, ProductDetailPage.jsx:153,498, ProfilePage.jsx:85-162, AiChatPage.jsx:117, TicketListPage.jsx:21-24}`, `apps/web/src/components/ErrorBoundary.jsx:38-65`, `apps/web/src/services/{http.js:6-11, order-events.service.js:11-24}`, `apps/web/src/components/notifications/NotificationBell.jsx:100-119`.
- **(b) Thực trạng trong code:** Chưa ghi `audit_logs` khi đổi mật khẩu, đổi trạng thái đơn qua `/api/orders`, cập nhật RMA, sửa cấu hình AI/Coupon; `HomePage` tự chế % giảm giá/rating/đã bán; `ProductDetailPage` hardcode `"Tình trạng: Còn hàng"` và lặp 3 ảnh giống hệt nhau; `ProfilePage` lưu sai key `checkout_addressId` so với `CheckoutPage` (`checkout_address_id`) và bỏ rơi `birthDate`/`gender`; `AiChatPage` destructure sai `user` từ `useAuth()`; `ErrorBoundary` in raw `componentStack` và nút reset gọi `localStorage.clear()` xóa luôn phiên đăng nhập; `http.js` không cấu hình `timeout`; `NotificationBell` không cleanup listener Socket; `SSE` truyền JWT trên URL query string và đóng hẳn khi lỗi mạng lần đầu; `AdminSkusPage`/`AdminUsersPage` xin `limit: 200` bị BE cắt ngầm còn `100`.
- **(c) Tác động:** Làm giảm độ chuyên nghiệp khi hội đồng click kỹ vào các trang phụ.
- **(d) Hướng sửa:** Gỡ dữ liệu chế giả trên `HomePage`/`ProductDetailPage`, sửa đúng key `localStorage` & `useAuth()`, thêm `timeout: 30000` cho Axios, chỉ xóa key cache thay vì `localStorage.clear()` trong `ErrorBoundary`, và bổ sung `recordAuditLog` cho các route ghi quan trọng.

---

## 4. NHỮNG ĐIỂM THỰC SỰ LÀM TỐT (CÓ DẪN CHỨNG CODE — TỐI ĐA 5 ĐIỂM MẠNH)

1. **Tích hợp thanh toán SePay Auto-VietQR & VNPay đạt chuẩn an toàn giao dịch thực tế:**
   - `services/api/src/modules/payments/sepay.service.js:93-130, 338-489` dùng `crypto.timingSafeEqual` kiểm tra API key, cơ chế **fail-closed (`503`)** nếu thiếu key/dùng placeholder, khóa hàng `SELECT ... FOR UPDATE`, chống cộng tiền trùng (idempotency theo `referenceCode`/`sepayId`), chặn thanh toán thiếu tiền, kết hợp song song Webhook (push) + Pull đối soát định kỳ + SSE trên `apps/web/src/pages/public/VietQrPaymentPage.jsx`.
   - `services/api/src/utils/vnpay.ts:111-134` & `orders.controller.ts:921-1084` kiểm tra HMAC-SHA512 + `timingSafeEqual` + đối chiếu `vnp_Amount` + khóa cứng `isMockPaymentEnabled() === false` trên production (`payment-mode.service.js:69-74`), đi kèm 2 bộ test tích hợp rất chặt (`vnpay.test.ts`, `sepay-webhook.test.ts`).
2. **Chuỗi xuất kho 100% Serial Number → tự động kích hoạt e-Warranty 1:1 (nhánh Staff Portal):**
   - `services/api/src/modules/orders/order-status.service.js:84-104` bắt buộc mọi `order_item` phải được gán đủ số lượng Serial Number (`assignedCount === totalRequired`) và mã vận đơn trước khi chuyển `SHIPPED`/`DELIVERED`, sau đó `services/api/src/modules/warranties/warranty-sync.service.js` tự động sinh phiếu bảo hành điện tử theo từng serial kèm `warranty_code` riêng, nối thông mượt với modal gán/tự sinh serial ở `apps/web/src/pages/staff/StaffOrdersPage.jsx:465-609`.
3. **Cô lập tuyệt đối ghi chú nội bộ (`INTERNAL`) trong hệ thống Ticket kỹ thuật:**
   - Kiểm soát nhất quán trên cả 4 đường đọc/ghi/realtime: `tickets.repository.ts:83` lọc `visibility: "PUBLIC"` ở danh sách của khách, `tickets.controller.ts:78-89, 111` lọc bỏ `INTERNAL` ở chi tiết ticket, dòng `236` ép tin nhắn của khách luôn là `PUBLIC`, và dòng `189, 262` không phát sóng tin `INTERNAL` ra room `ticket:<id>`, được xác minh bằng integration test `tests/tickets-rma.test.ts`.
4. **Trừ tồn kho nguyên tử (Atomic Conditional Decrement) chống bán vượt kho khi Checkout:**
   - `services/api/src/modules/orders/orders.controller.ts:255-269` thực hiện cập nhật nguyên tử ngay trong `$transaction` (`UPDATE product_skus SET stock = stock - ? WHERE id = ? AND stock >= ?`) và rollback toàn bộ nếu bất kỳ SKU nào có `affectedRows === 0`, xử lý tốt cạnh tranh mua hàng đồng thời lúc tạo đơn.
5. **Tách biệt kiến trúc 4 cổng Frontend + Single-Flight Token Refresh & Che giấu khóa bí mật AI:**
   - `apps/web/src/services/http.js:13-115` xử lý gom đồng thời các lỗi `401` vào 1 `refreshPromise` duy nhất (tránh storm gọi refresh token nhiều lần) và retry có backoff chỉ cho các phương thức idempotent (`GET/HEAD/OPTIONS`).
   - `services/api/src/modules/ai/ai-rule.service.js:515-568, 606` che giấu toàn bộ khóa API LLM trước khi trả về Admin UI (`maskSecretKey`) và chặn ghi đè ngược chuỗi đã che (`••`) khi lưu cấu hình; không có file `.env` hay `ai-rules-store.json` nào bị commit vào Git.

---

## 5. DANH SÁCH CÁC MỤC `[CHƯA THỂ KIỂM CHỨNG]` & HƯỚNG DẪN TỰ KIỂM TRA THỦ CÔNG

1. **`[CHƯA THỂ KIỂM CHỨNG - API (:4000) và Web (:5173) không bật trong phiên audit]` Chạy bộ Playwright E2E và kiểm tra trực quan 4 cổng trên trình duyệt thật:**
   - *Cách tự kiểm tra:* Khởi động đủ 3 service (`npm run dev` + `python main.py` trong `services/ai-service/.venv`), sau đó chạy `npx playwright test` (lưu ý `checkout-full-flow.spec.ts` sẽ fail do nút VNPay đã gỡ) và mở DevTools tab Console + Network để rà soát lỗi React Hooks, lỗi 4xx/5xx khi bấm qua từng menu của cả 4 vai trò.
2. **`[CHƯA THỂ KIỂM CHỨNG - Thiếu giao dịch ngân hàng thật / sandbox credential hợp lệ]` Luồng chuyển khoản VietQR SePay thật & cổng thanh toán VNPay Sandbox live:**
   - *Cách tự kiểm tra:* Chuyển 2.000đ thật (hoặc gửi webhook ký bằng `SEPAY_API_KEY` thật qua Postman/ngrok) với nội dung `PCMALL<orderId>`, xác nhận màn hình `VietQrPaymentPage` tự nhảy trạng thái thành công trong 2–5 giây mà không cần F5; thử gửi lại đúng webhook đó lần 2 để xác nhận idempotency.
3. **`[CHƯA THỂ KIỂM CHỨNG - Log test ghi nhận SMTP Gmail trả lỗi 535-5.7.8 BadCredentials]` Gửi email thật (xác nhận đơn hàng, kích hoạt bảo hành, đổi trạng thái RMA):**
   - *Cách tự kiểm tra:* Tạo App Password mới trong tài khoản Google, cập nhật `SMTP_USER`/`SMTP_PASS` trong `services/api/.env`, đặt 1 đơn hàng và kiểm tra hộp thư đến.
4. **`[CHƯA THỂ KIỂM CHỨNG - Không kiểm tra khóa LLM thực tế/quota tài khoản cá nhân]` Chuyển đổi dự phòng (Multi-Provider Failover) thực tế giữa Gemini / Groq / OpenAI / DeepSeek khi hết quota `429`:**
   - *Cách tự kiểm tra:* Đặt khóa giả cho Provider 1 và khóa thật cho Provider 2 trong `/admin/ai-config`, gọi chat AI và xem log thời gian phản hồi + provider thực tế phục vụ.
5. **`[CHƯA THỂ KIỂM CHỨNG - Không chạy docker compose up trên volume trắng]` Dựng toàn bộ stack Production bằng `docker-compose.prod.yml`:**
   - *Cách tự kiểm tra:* Chạy `docker compose -f docker-compose.prod.yml up --build` với volume MySQL mới hoàn toàn (sau khi sửa `[P0-13]`, `[P0-15]`, `[P1-10]`) và kiểm tra `docker ps` đảm bảo mọi container đều `(healthy)`, tải ảnh `/data/images/...` và upload file > 2MB thành công.

---

## 6. TOP 7 CÂU HỎI PHẢN BIỆN "XOÁY" NHẤT TỪ HỘI ĐỒNG

1. **Về Smart PC Builder (`[P0-04]`, `[P0-05]`):** *"Em nói hệ thống có Rule Engine tương thích động quản trị được trong CSDL. Hãy demo ngay: vào trang Admin tạo 1 luật cấm ghép mới rồi sang PC Builder thử xem nó có chặn không? Và giải thích tại sao ngay kịch bản mặc định 'Gaming 20 triệu' hệ thống tự gợi ý CPU Core Ultra 5 225F + Main B860M mà chính engine của em lại chấm 0/100 điểm BLOCKED?"*
2. **Về cơ sở khoa học của công thức "SMART" (`[P1-02]`):** *"Em trình bày có 'Dynamic Bottleneck', 'Ước lượng FPS' và 'Build Health Score 5 chiều'. Tại sao trong code của em, khi chuyển từ 1080p lên 4K thì nghẽn cổ chai CPU lại tăng gấp 3 lần (ngược kiến thức phần cứng), còn FPS ở bảng What-If lại tính hoàn toàn bằng phép chia tổng giá tiền mà không nhìn vào card màn hình?"*
3. **Về Hybrid RAG & chống ảo giác (`[P0-07]`, `[P1-03]`):** *"Tại sao endpoint `/health` của Python AI Service đang báo `chroma_vectors_count = 0` trong khi `/v1/rag/models` lại báo xanh Gemini Embedding 3072d đang hoạt động? Và nếu AI được hỏi mua linh kiện đang hết hàng (`stock = 0`) hoặc giá vừa đổi trong MySQL, bằng chứng nào trong code đảm bảo RAG không tư vấn hàng hết kho hay tự bịa linh kiện?"*
4. **Về Bảo mật Xác thực & Phân quyền 5 vai trò (`[P0-01]`, `[P0-03]`, `[P1-01]`):** *"Nếu tôi mở Postman gửi `POST /api/auth/google-mock` với email `admin@cnm.local` thì chuyện gì xảy ra? Và nếu Admin bấm khóa một tài khoản nhân viên đang đăng nhập, tại sao Access Token cũ vẫn gọi API được bình thường — thậm chí ngay cả khi đã đưa vào `token_blacklist`?"*
5. **Về Toàn vẹn thanh toán & Tồn kho (`[P0-02]`, `[P0-11]`):** *"So sánh cơ chế xác thực webhook của SePay/VNPay với MoMo trong code của em: tại sao MoMo lại giữ `DEFAULT_SECRET_KEY` công khai và không kiểm tra số tiền? Ngoài ra, nếu hai yêu cầu hủy cùng 1 đơn hàng đến song song, hoặc nhân viên đổi trạng thái `CANCELED → PENDING → CANCELED` qua `PATCH /api/orders/:id/status`, tồn kho có bị cộng đúp không?"*
6. **Về Bảo mật Real-time & Upload File (`[P0-08]`, `[P0-09]`, `[P0-10]`):** *"Hệ thống của em có Human Handoff qua Socket.IO và upload minh chứng bảo hành/thanh toán. Hiện tại ở `socket.service.ts` không hề kiểm tra JWT: chuyện gì xảy ra nếu một khách lạ phát sự kiện `join_staff_queue`? Và nếu khách gửi file `.svg` chứa `<script>` vào form bảo hành rồi kỹ thuật viên bấm mở link `/uploads/...`, hệ thống chống XSS thế nào?"*
7. **Về Chất lượng Kiểm thử & Khả năng Triển khai (`[P0-13]`, `[P1-11]`):** *"Trong báo cáo em ghi hệ thống vượt qua 193 test case. Tại sao 3 file test quan trọng nhất về PC Builder và LLM lại bị loại khỏi `npm test` — và khi chạy riêng lại fail cả 3? Tại sao `npx eslint src` ở Frontend còn tới 65 lỗi `rules-of-hooks`, và nếu tôi xóa sạch volume MySQL chạy lại `docker compose up`, hệ thống có tự khởi tạo được bảng không?"*

---

## 7. KẾ HOẠCH KHẮC PHỤC THEO THỨ TỰ ƯU TIÊN

### Giai đoạn 1 — Cứu Demo & Vá Lỗ Hổng Chí Mạng (BẮT BUỘC làm ngay trong 2–3 ngày)
1. **Bảo mật P0 (nửa ngày):**
   - Khóa/xóa `/api/auth/google-mock` ở production (`auth.controller.ts:198`).
   - Sửa `momo.ts` fail-closed + check số tiền/trạng thái trong `handleMomoIpn` (hoặc vô hiệu hóa hẳn MoMo nếu không demo).
   - Sửa lệch múi giờ UTC vs `+07:00` ở `token-blacklist.service.ts` + thêm kiểm tra `status`/`token_version` trong `authenticate()`.
   - Bỏ fallback `req.body.userId` ở 5 endpoint AI/Chat + chặn khách gửi `sender: "staff"`.
   - Thêm xác thực JWT + kiểm tra role vào `socket.service.ts` và sửa singleton `socket.service.js` ở FE.
   - Chặn `image/svg+xml`/`.html` khi upload, đặt `Content-Disposition: attachment` cho `/uploads`, escape HTML trong `AiChatPage.jsx`.
2. **Sửa lỗi chết Demo ở Admin / Tech / Public (nửa ngày):**
   - Sửa `AdminProductsPage.jsx:297` (`detail.id ?? detail.product_id ?? productId`).
   - Sửa `admin-skus.service.js:403-416` (`warrantyItem`, `orderItemSerial`, `product_variant_id`).
   - Sửa `TechTicketsPage.jsx:650` gửi `FormData` khi có file đính kèm.
   - Sửa `CompareProductsPage.jsx:248` đọc `variant?.variant_id`.
   - Sửa 65 lỗi ESLint `rules-of-hooks` ở `AiChatWidget.jsx` và `AdminAiConfigPage.jsx`.
   - Sửa `TechWarrantiesPage.jsx:241` không reset form khi auto-poll 20s; sửa `admin-system.service.js:227-229` (`assigned_to_id`, `warranty_requests`) và bộ lọc Audit Log `SALES_STAFF`/`TECH_STAFF` ở `AdminSystemPage.jsx`.
3. **Cứu điểm trọng tâm Smart PC Builder & Hybrid RAG (1–1.5 ngày):**
   - Hợp nhất `normalizeSocket()` sửa dứt điểm `FCLGA1851 === LGA1851` để `suggestBuild(20tr, gaming)` đạt ≥ 95/100.
   - Sửa `pc-builder.service.ts:2279` chạy đủ luật DB key-only tạo từ Admin UI.
   - Sửa đảo ngược dấu PSU Blocker ở `PcBuilderPage.jsx:222-229` & bỏ `|| 90`, `|| 96` che lỗi 0 điểm.
   - Sửa ngược vật lý Bottleneck 4K ở `pc-builder.service.ts:764-784`, bỏ công thức FPS theo giá tiền (dùng bảng benchmark tier GPU+CPU rõ ràng), sửa guard `!item.ok` ở `XAIExplanationDrawer.jsx`.
   - Sửa `chroma_manager.py:70, 81` để index đầy đủ `pcmall_gemini_knowledge` (`chroma_vectors_count > 0`) và sửa `/v1/rag/models` trả dữ liệu thật; lọc `stock > 0` trong AI catalog và xóa nhánh tiêm sản phẩm giả.

### Giai đoạn 2 — Chốt Toàn vẹn Nghiệp vụ & Kiểm thử (1–2 ngày tiếp theo)
4. **Toàn vẹn đơn hàng & Hậu mãi:**
   - Gắn `ORDER_STATUS_TRANSITIONS` + `FOR UPDATE` + kiểm tra Serial vào `PATCH /api/orders/:id/status`, `cancelMyOrder`, `shipments.service.js`; sửa `restoreOrderInventory` dùng đúng transaction; thêm `RMA_STATUS_TRANSITIONS`; khóa chặt tra cứu/tạo RMA ẩn danh; tính `shippingFee` phía server.
   - Nâng `Product.price`/`ProductSku.price` lên `DECIMAL(12,2)`; sửa `cloneBuild` IDOR; thu hẹp quyền `SALES_STAFF` trên RMA/Ticket kỹ thuật.
5. **Hoàn thiện Parity & Triển khai:**
   - Làm thêm trang `/admin/coupons` (CRUD mã giảm giá) và đồng nhất lựa chọn VNPay giữa `CheckoutPage`, `AdminSystemPage` và E2E.
   - Tạo baseline migration sạch cho DB trống; sửa Nginx (`CORS`, `client_max_body_size`, `/health`), `app.set("trust proxy", 1)` và ẩn raw 500 error.
   - Đưa 3 file test `src/` vào `npm test`, chạy trên DB test riêng (`cnm_mk_hb_test`), dọn dead code `.js`/`.tmp`.

### Những hạng mục CÓ THỂ CHẤP NHẬN đưa vào mục "Hạn chế của đề tài & Hướng phát triển" (nếu thiếu thời gian)
- **Ước lượng FPS theo từng tựa game thực tế:** Thừa nhận thẳng hệ thống hiện ước lượng dựa trên điểm hiệu năng tham chiếu (tier/benchmark score của cặp CPU–GPU) thay vì dữ liệu đo đạc thực tế trên từng cấu hình phần cứng cụ thể; hướng phát triển là tích hợp bộ dữ liệu benchmark mở (3DMark/PassMark).
- **Chưa đồng bộ Vector ChromaDB theo thời gian thực (CDC/Event-driven):** Hiện đồng bộ theo tác vụ Reindex thủ công/định kỳ từ Admin; hướng phát triển là dùng message queue (Redis/RabbitMQ) đồng bộ tự động mỗi khi giá/tồn kho thay đổi.
- **Kiểm tra đầu cắm nguồn vật lý chi tiết (`COMP-008`) & khe cắm mở rộng phức tạp:** Phụ thuộc độ chi tiết của dữ liệu thông số kỹ thuật EAV do quản trị viên nhập; cần chuẩn hóa lại bộ thuộc tính EAV (`psu_pcie_8pin`, `psu_12vhpwr`, `mb_m2_slots`) ở giai đoạn mở rộng.
- **Độ phủ E2E đa vai trò & Component Unit Test trên Frontend:** Hiện mới phủ E2E các luồng khách hàng chính; hướng phát triển là mở rộng Playwright E2E cho 3 cổng nội bộ (Admin/Staff/Tech) và bổ sung Testing Library trong CI/CD.

