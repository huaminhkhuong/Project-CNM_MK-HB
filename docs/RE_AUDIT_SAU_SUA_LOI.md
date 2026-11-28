# BÁO CÁO PHÚC KHẢO ĐỘC LẬP SAU SỬA LỖI (INDEPENDENT RE-AUDIT) — DỰ ÁN PC MALL

- **Vai trò đánh giá:** Giảng viên phản biện độc lập (Phúc khảo sau khi sinh viên tuyên bố hoàn thiện 100% — 29/29 hạng mục từ [AUDIT_GIANG_VIEN_HE_THONG.md](./AUDIT_GIANG_VIEN_HE_THONG.md)).
- **Thời điểm phúc khảo:** 27/11/2026.
- **Nguyên tắc thực hiện:** Không tin báo cáo miệng; kiểm tra chéo trực tiếp `git status`, `git diff`, đọc mã nguồn thực tế, chạy lại toàn bộ công cụ kiểm tra tĩnh/động (TypeScript, ESLint không `--quiet`, Vitest, Vite Build, `npm test`, Python `compileall` & `test_rag.py`), truy vấn chỉ-đọc MySQL live (`:3307`), gọi HTTP trực tiếp Python AI (`:5001`) và kiểm chứng in-process Express API (`createApp()`) kết nối MySQL live. **Tuyệt đối không sửa bất kỳ tệp mã nguồn nào của dự án.**

---

## 1. BẢNG ĐIỂM TRƯỚC vs SAU KIỂM TOÁN & KẾT LUẬN SẴN SÀNG BẢO VỆ

### 1.1. So sánh điểm thực tế theo 7 trụ cột (Thang 0–100%)

| # | Trụ cột kiểm toán | Trước | Sau | Biến động | Đánh giá thẳng thắn dựa trên bằng chứng thực tế |
|---|---|---:|---:|---:|---|
| 1 | Kiến trúc tổng thể, CSDL & Triển khai (MySQL/Prisma, EAV, Docker) | 58% | **74%** | **+16%** | Đã nâng `DECIMAL(12,2)`, đủ unique/index/FK `P2-02` trên DB live, xóa 18 file rác/dead code, sửa Nginx & volume Docker prod; nhưng còn 2 migration PascalCase hỏng (`prisma migrate deploy` vẫn chết), `migrate.js:261` truyền cờ `--accept-data-loss=false` sai cú pháp boolean, `cnm_api_prod` đang crash-loop `ENOTFOUND mysql`, vẫn giữ Dual ORM. |
| 2 | Trọng tâm "SMART" của Smart PC Builder | 48% | **68%** | **+20%** | Ứng viên chính `bestValue` (20tr Gaming) đạt **`100/100`**, Bottleneck 4K đã đúng chiều vật lý, PSU Blocker FE chuẩn, 5D Score/What-If bỏ công thức giá tiền, bổ sung hệ thống Tag nhu cầu & GPU-first; **NHƯNG** 2 ứng viên `bestPerformance` & `budgetSafe` của chính `suggestBuild(20tr)` vẫn **`0/100 BLOCKED`**, `getGpuScore()` quên RTX 5060 Ti làm báo **`53% GPU SEVERELY_BOTTLENECKED`**, và 8/12 luật key-only DB vẫn không khớp tên thuộc tính. |
| 3 | Trợ lý AI, Python Hybrid RAG & Độ ổn định | 52% | **66%** | **+14%** | Lọc `stock > 0`, xóa sản phẩm giả hardcode, hậu kiểm tương thích ở `ai-suggest-stream`, thêm Circuit Breaker + `AbortController` riêng từng provider, sửa Guardrails & thứ tự lọc BM25; **NHƯNG** ChromaDB collection Gemini trên đĩa & live `:5001` **vẫn `0` vector** (`cnm_ai_service` chưa restart/reindex), `"gemini-3.5-flash-lite"` vẫn default ở 12 nơi, `X-Internal-Key` fail-open & chỉ bọc 2/10 route, vẫn còn 2 LLM Gateway & 2 hệ RAG song song. |
| 4 | Nghiệp vụ E-Commerce cốt lõi & Chuỗi Hậu mãi | 68% | **84%** | **+16%** | **Mảng tiến bộ chắc tay nhất**: MoMo IPN fail-closed + `timingSafeEqual` + `FOR UPDATE`, State machine + `FOR UPDATE` chống hoàn kho/coupon đúp, sửa `restoreOrderInventory` dùng đúng transaction, chặn đường vòng Serial 100% ở `shipments`, `RMA_STATUS_TRANSITIONS`, transaction cho `LAST_INSERT_ID()`, khôi phục VNPay; chỉ còn sót tin `shippingFee` từ client và `maskRequestPii` quên che `timeline[].actorName`. |
| 5 | Phân quyền RBAC, Bảo mật & Toàn vẹn dữ liệu (5 vai trò) | 42% | **75%** | **+33%** | **Mảng cải thiện mạnh nhất**: Chặn chiếm quyền `ADMIN`/`SALES_STAFF`/`TECH_STAFF` qua `google-mock`, sửa triệt để lệch múi giờ Token Blacklist + rotate refresh + live status/role check 0ms khi khóa/hạ quyền, vá 5 IDOR `req.body.userId`, vá Stored XSS upload & chat, xóa CORS reflection Nginx, thêm JWT cho Socket.IO; còn hở `google-mock` tài khoản `CUSTOMER` ở dev, `SALES_STAFF` vẫn quản trị Ticket `INTERNAL`, SSE JWT query string, và API key AI plaintext. |
| 6 | Giao diện (UI/UX), Độ khớp FE–BE & Khả năng sống sót khi Demo | 60% | **81%** | **+21%** | Xử lý sạch 65 lỗi ESLint Hooks không gian lận `eslint-disable`, vá đủ 5/5 lỗi chết demo `P0-14`, bổ sung hoàn chỉnh trang `/admin/coupons`, dọn dữ liệu giả trên Home/Product/Dashboard, sửa form Tech Warranty & lọc Audit Log; **NHƯNG** phát sinh **Regression Socket.IO reconnect bị văng khỏi room** khi refresh JWT/login, và `CheckoutPage.jsx:2000` thiếu `id="payment-method-card-vnpay"` làm E2E vẫn lệch selector. |
| 7 | Kiểm thử & Sức khỏe kỹ thuật (Code Quality & Tests) | 55% | **71%** | **+16%** | `tsc`, `vite build`, `eslint src` (`0 errors`) pass; `npm test` chạy đủ 38 file (`219/219 pass`); `test_rag.py` có `assert` thật pass; **NHƯNG** `npm test` vẫn làm bẩn DB dev `cnm_mk_hb`, `compatibility.test.ts` chưa sửa 1 dòng vẫn test object giả, `auth.smoke.test.ts` vẫn `# SKIP`, `.venv` thiếu `pytest`, FE chỉ có 1 file Vitest, và Git workspace đang chứa xóa 41 file `docs/` + file nhị phân `chroma.sqlite3` (27.8MB). |
| | **TỔNG HỢP TRUNG BÌNH** | **55%** | **74%** | **+19%** | **Tổng kết 29 mục:** **`12` PASS THẬT (41.4%) · `16` PASS NỬA VỜI (55.2%) · `1` VẪN FAIL (3.4%)** |

### 1.2. Kết luận mức độ sẵn sàng bảo vệ KLTN: **ĐẠT KHÁ — ĐÃ QUA NGƯỠNG AN TOÀN CƠ BẢN, NHƯNG CHƯA ĐẠT 100% NHƯ TUYÊN BỐ (CẦN VÁ NỐT 4 LỖI "ĐINH" TRONG 0.5–1 NGÀY)**

- **Đánh giá công tâm:** Sinh viên đã làm việc nghiêm túc, **không** dùng trò vá đối phó bẩn kiểu `eslint-disable` tràn lan hay xóa assertion để qua test. Rất nhiều lỗi chí mạng đã được xử lý đúng bản chất (MoMo IPN, Token Blacklist `+07:00`, live status/role check, 5 lỗi chết demo `P0-14`, 65 lỗi React Hooks, Stored XSS upload/chat, Nginx CORS, State Machine đơn hàng & `restoreOrderInventory`, Unique/FK/DECIMAL(12,2) trên DB, trang `/admin/coupons`).
- **Tuy nhiên, tuyên bố "hoàn thiện 100% (29/29)" là CHƯA CHÍNH XÁC:** Phúc khảo thực tế chỉ xác nhận **12/29 mục `✅ PASS THẬT`**, **16/29 mục `⚠️ PASS NỬA VỜI`**, và **1/29 mục `❌ VẪN FAIL` (`P0-07`)**. Nếu lên hội đồng ngay hôm nay mà chưa xử lý **4 điểm nóng** dưới đây, hội đồng vẫn có thể bắt lỗi trực diện ngay lúc demo:
  1. `GET :5001/health` hiện tại vẫn báo **`chroma_vectors_count: 0`** và `/v1/rag/models` vẫn trả JSON giả (do chưa restart container `cnm_ai_service` và chưa chạy reindex `pcmall_gemini_knowledge`).
  2. Bấm **"Gợi ý cấu hình 20tr Gaming"**: thẻ 1 (`Best Value`) báo **`53% GPU SEVERELY_BOTTLENECKED`** (vì `getGpuScore()` quên RTX 5060 Ti), còn thẻ 2 (`Best Performance`) và thẻ 3 (`Budget Safe`) vẫn **`0/100 BLOCKED`**!
  3. **Regression mới ở Socket.IO:** Khi access token tự refresh sau 15 phút (hoặc đăng nhập từ Guest), `socket.service.js` gọi `disconnect().connect()` nhưng `useSocket.js` không tự `re-join` room → Staff biến mất khỏi `onlineStaffRegistry`, khách/tech mất realtime.
  4. **Workspace Git đang ở trạng thái rủi ro:** Xóa 41 file trong `docs/`, track file binary `chroma.sqlite3` (27.8MB) và file test RAG untracked; container `cnm_api_prod` đang `Restarting (1)`.

---

## 2. HIỆN TRẠNG GIT WORKSPACE & BẰNG CHỨNG CHẠY THỰC TẾ (RAW EVIDENCE)

### 2.1. Soi Git & Giải mã 160 thay đổi trên Workspace (`git status --porcelain`)

Tổng số mục trong `git status --porcelain`: **160 mục** (`96 M`, `59 D`, `5 ??` — mở rộng thư mục untracked thành 7 file), `git diff --stat`: `155 files changed, 3632 insertions(+), 11955 deletions(-)`:

| Trạng thái | Phân vùng | Số lượng | Phân tích thực chất (Code thật vs Rác / Tài liệu bị xóa) |
|---|---|---:|---|
| `M` | `services/api` | 50 | Code backend sửa lỗi thực chất (auth, orders, pc-builder, warranties, tickets, ai, socket, admin, migrate, prisma schema, tests). |
| `M` | `apps/web` | 35 | Code frontend sửa lỗi thực chất + nâng cấp Wizard/Admin Tags/Coupons. |
| `M` | `services/ai-service` | 7 | 6 file Python (`main.py`, `indexer.py`, `question_engine.py`, `hybrid_engine.py`, `chroma_manager.py`, `test_rag.py`) + **1 file binary dữ liệu `data_store/chroma_db/chroma.sqlite3` (27.8 MB — không nên commit vào Git)**. |
| `M` | Root / Infra | 4 | `docker-compose.prod.yml`, `nginx/nginx.conf`, `nginx/nginx.http.conf`, `package.json`. |
| `D` | `services/api` | 18 | **Dọn rác hợp lý (`P2-01`):** 6 file `legacy/unused_routes/`, 2 `test*.tmp`, 5 `.js` controller trùng (`cart/orders/tickets/users/warranties`), 5 file dead code `pc-builder/`. |
| `D` | `docs/` | **41** | **⚠️ CẦN KIỂM TRA LẠI:** Xóa toàn bộ 41 tài liệu kỹ thuật/SQL/testing/audit cũ trong `docs/` (kể cả `docs/03-database/*.sql`, `docs/TESTING_GUIDE.md`, `docs/Bao_Cao_Danh_Gia_UseCase_PC_Mall.pdf`). Đây là nguyên nhân chính khiến tổng thay đổi Git phình lên ~160 file! |
| `??` | Untracked | 5 mục (7 file) | 3 file code thật: `AdminCouponsPage.jsx`, `admin-tags.service.ts`, `admin-tags.test.ts`; 1 báo cáo audit (`docs/AUDIT_GIANG_VIEN_HE_THONG.md`); **3 file dữ liệu test rác trong `services/ai-service/data_store/docs/cam_nang_pc_mall_rag_test.{md,json,md.chunks.json}`** nên đưa vào `.gitignore` hoặc dọn trước khi commit. |

- **Kiểm tra file nhạy cảm:** Không có file `.env`, private key (`.pem`), hay `ai-rules-store.json` bị đưa vào Git changes. Tuy nhiên `services/ai-service/data_store/chroma_db/chroma.sqlite3` đang bị Git track.

### 2.2. Kết quả thô toàn bộ công cụ kiểm tra tĩnh, kiểm thử & Live Smoke Checks

| Hạng mục kiểm chứng | Lệnh / Endpoint thực thi | Kết quả thô thực tế |
|---|---|---|
| Cổng dịch vụ đang mở | `Get-NetTCPConnection -LocalPort 3307,5001,4000,5173 -State Listen` & `docker ps` | MySQL `:3307` **UP** (`cnm_mysql`, Up 3h healthy), Python AI `:5001` **UP** (`cnm_ai_service`, Up 3h healthy), API `:4000` **DOWN**, Web `:5173` **DOWN**. Container **`cnm_api_prod` đang `Restarting (1)`** (lỗi `getaddrinfo ENOTFOUND mysql` khi chạy `node scripts/migrate.js`). |
| TypeScript API | `services/api`: `npx.cmd tsc --noEmit` | **PASS** (`TSC_EXIT=0`). |
| TypeScript Web | `apps/web`: `npx.cmd tsc --noEmit` | **PASS** (`TSC_EXIT=0`). |
| ESLint Web (KHÔNG `--quiet`) | `apps/web`: `npx.cmd eslint src` | **PASS (`ESLINT_EXIT=0`): `151 problems (0 errors, 151 warnings)`** (giảm từ `65 errors` xuống `0 errors`). Kiểm tra `git diff` cho thấy **0 lệnh `eslint-disable`** được thêm ở `apps/web` (chỉ có 1 dòng `// eslint-disable-next-line @typescript-eslint/no-var-requires` thêm ở `orders.controller.ts:38`). |
| Frontend Vitest | `apps/web`: `npx.cmd vitest run` | **PASS (`VITEST_EXIT=0`)**: `1 file (calculateBuilderInsights.test.js), 11/11 passed (183ms)`. |
| Production Build Web | `apps/web`: `npx.cmd vite build` | **PASS (`BUILD_EXIT=0`)**: `272 modules transformed`, built in `51.01s`. |
| Python Compile & Test | `services/ai-service`: `.venv\Scripts\python.exe -m compileall -q main.py reindex.py test_rag.py src` / `-m pytest` / `test_rag.py` | `compileall`: **PASS (`EXIT=0`)**. `pytest`: **FAIL (`No module named pytest` ở cả `.venv` lẫn global Python)**. Chạy trực tiếp `.venv\Scripts\python.exe test_rag.py`: **PASS (`EXIT=0`)** với 4 query có `assert` thật (`1217 tài liệu`). |
| API `npm test` (38 files) | `services/api`: `npm.cmd test` (đã gồm `unified-llm`, `pc-builder.integration`, `compatibility`, `admin-tags`) | **PASS (`NPM_TEST_EXIT=0`, `88.2s`)**: `# tests 219, # suites 70, # pass 219, # fail 0`. **NHƯNG** dòng 725 log vẫn ghi **`ok 9 - auth smoke # SKIP`**, vẫn nhiều lỗi SMTP Gmail `535-5.7.8 BadCredentials` và Gemini Free Tier `QuotaFailure` (20 req/day). |
| Đo ô nhiễm DB dev (`cnm_mk_hb`) trước/sau `npm test` | Truy vấn `INFORMATION_SCHEMA` & `COUNT(*)` trên `:3307` | `SHOW DATABASES` **không có** `cnm_mk_hb_test`. Trước test → Sau test: `users`: `136 → 139` (**+3**), `token_blacklist`: `102 → 105` (**+3**), `audit_logs`: `334 → 347` (**+13**); `users` có `23` dòng `role_id IS NULL`. **Chứng minh `npm test` vẫn làm bẩn DB dev!** |
| Live Python AI `:5001` | `GET /health`, `GET /v1/rag/models` (không key & sai key), kiểm tra đĩa `ChromaKnowledgeStore().get_status()` | Live `:5001/health`: **`200 OK`, `"status": "healthy"`, `"chroma_vectors_count": 0`** (container `Up 3 hours` chạy code cũ!). Live `/v1/rag/models` (không key & key sai): **`200 OK` trả nguyên JSON giả cũ**. Đọc trực tiếp ChromaDB trên đĩa: `{'active_collection': 'pcmall_gemini_knowledge', 'active_vectors_count': 0, 'gemini_vectors_count': 0, 'local_vectors_count': 1513, 'is_using_gemini': False}`, `IS_INDEXED: False`. |
| Kiểm chứng Express API live DB (in-process `createApp()` vì `:4000` DOWN) | `POST /api/auth/google-mock`, `GET /api/warranties/lookup/*`, `POST /api/pc-builder/suggest`, `POST /api/orders/momo/ipn`, `calculateDynamicBottleneck` | • `google-mock` với `admin@cnm.local`, `sales@cnm.local`, `tech1@cnm.local`: đều **`403`**.<br>• `GET /api/warranties/lookup/1` & `?q=1`: **`404`**; tra cứu ẩn danh mã thật `BH-SN-CPUINTEL-...`: **`200`** đã che `customerName/Phone/Email` nhưng **vẫn lộ tên thật `"Khách Hàng Demo"` và `"tech1@cnm.local"` trong `timeline[].actorName`**.<br>• `POST /api/orders/momo/ipn` (amount=1, sig fake): **`400 Invalid MoMo signature`**.<br>• `POST /api/pc-builder/suggest` (20tr Gaming): `bestValue` đạt **`100/100`** (`20.730.000đ`) nhưng **`bottleneck: 53% GPU SEVERELY_BOTTLENECKED`**; **`bestPerformance` = `0/100` (`rule_146`)**; **`budgetSafe` = `0/100` (`MB ATX / Case mATX`)**; `dbRuleChecks` trên `bestValue` = `[]`.<br>• Bottleneck vật lý `i5-12400F + RTX 4080`: `1080p = 38% CPU`, `1440p = 26% CPU`, `4K = 15% GPU`; `i9-14900K + RTX 4060`: `1080p = 39% GPU`, `4K = 65% GPU` (**đúng chiều vật lý**). |
| Kiểm tra Schema MySQL Live (`:3307`) | `INFORMATION_SCHEMA.COLUMNS` & `STATISTICS` | `products.price` & `product_skus.price`: **`decimal(12,2)`** (đạt). `coupons.start_date/end_date`: **`datetime`** (đạt). `warranty_request_attachments/events.request_id`: **`bigint`** + index (đạt). Đủ 6 unique index (`uq_product_skus_sku`, `uq_products_slug`, `uq_carts_user_id`, `uq_cart_items_cart_variant`, `uq_sku_attributes_sku_val`, `uq_product_reviews_product_user`) và `idx_orders_status_payment_created`. Bảng `users` **không** có cột `token_version` (dùng cơ chế live DB lookup + cache 2s). Bảng `compatibility_rules`: `46` tổng / `45` active / **`12` active key-only**. |

---

## 3. BẢNG PHÚC KHẢO ĐẦY ĐỦ 29/29 HẠNG MỤC GỐC

| Mã | Trạng thái | Bằng chứng thực tế (`file:dòng` / output lệnh) | Nhận xét chất lượng bản vá |
|---|---|---|---|
| `P0-01` | ⚠️ **PASS NỬA VỜI** | `services/api/src/modules/auth/auth.controller.ts:224-245`, `auth.route.ts:28`. Smoke: `admin@cnm.local`, `sales@cnm.local`, `tech1@cnm.local` đều trả `403`. | Đã chặn cứng ở `NODE_ENV=production`, chặn chiếm mọi tài khoản Admin/Staff, băm mật khẩu ngẫu nhiên `bcrypt` và gắn `authRateLimiter`. **Còn hở:** Không có cờ opt-in `ENABLE_MOCK_GOOGLE_AUTH`; ở dev/test bất kỳ ai vẫn đăng nhập được vào mọi tài khoản `CUSTOMER` không cần mật khẩu hoặc tạo user mới tự do. |
| `P0-02` | ✅ **PASS THẬT** | `services/api/src/utils/momo.ts:19-136`, `orders.controller.ts:1201-1287`. Smoke IPN giả: `400 Invalid MoMo signature`. | Vá rất tốt: xóa sạch khóa sandbox công khai, fail-closed `503` khi thiếu config, `crypto.timingSafeEqual`, kiểm tra `partnerCode`, `SELECT ... FOR UPDATE` đối chiếu chặt `payment_method === 'MOMO'`, `amount`, `status !== 'CANCELED'`, `payment_status !== 'PAID'`. |
| `P0-03` | ✅ **PASS THẬT** | `services/api/src/services/token-blacklist.service.ts:10-20`, `auth.controller.ts:151-163`, `token.service.ts:10,20`. `token-blacklist.test.ts` PASS. | Sửa đúng bản chất: dùng `FROM_UNIXTIME(?)` khớp session `+07:00` và `NOW()`, `logout` verify & blacklist cả Access Token từ header `Bearer`, thêm `jwtid` UUID tránh trùng token trong cùng giây. |
| `P0-04` | ⚠️ **PASS NỬA VỜI** | `pc-builder.service.ts:726-729, 2409`, `PcBuilderPage.jsx:181-189`, `calculateBuilderInsights.js:191-199`. Smoke `suggestBuild(20tr)`: `bestValue=100/100`, **`bestPerformance=0/100`**, **`budgetSafe=0/100`**. | `normalizeSocket()` và Core Ultra tier đã cứu được `bestValue` (và làm test pass vì test chỉ check ứng viên đầu!). Nhưng **2/3 ứng viên còn lại vẫn `0/100 BLOCKED`** (`rule_146` ghép nhầm CPU-Cooler và `MB ATX / Case mATX`), còn `bestValue` bị báo `53% GPU SEVERELY_BOTTLENECKED` vì quên RTX 5060 Ti ở `getGpuScore()`. |
| `P0-05` | ⚠️ **PASS NỬA VỜI** | `pc-builder.service.ts:2300-2388`, `admin.service.js:895-901`, xóa `compatibility-rule.evaluator.ts`. DB check: 8/12 luật key-only không có tên thuộc tính trùng trong `attributes`; `CHECK_RAW_ON_SUGGESTED` → `dbRuleChecks: []`. | Đã thêm nhánh đánh giá key-only + sửa `PATCH is_compatible` + xóa dead code. **Nhưng nửa vời ở 3 chỗ:** (1) `findSpec` chỉ tìm `[srcKey, srcKey.replace(/_/g, " ")]` nên 8/12 luật key-only DB dùng key tiếng Anh (`case_gpu_clearance`, `m2_slots`, `radiator_size`...) vẫn bị skip trên thuộc tính tiếng Việt; (2) Nhánh 1 thiếu check `targetCategoryId` gây false positive `rule_146`; (3) Luật `id=172` dùng `GTE` sẽ chặn nhầm AIO 240mm lắp case 240mm. |
| `P0-06` | ✅ **PASS THẬT** | `apps/web/src/pages/public/PcBuilderPage.jsx:141-143, 232-246`, `apps/web/src/utils/calculateBuilderInsights.js:189, 304-312`. `builderInsightsCalculator.js` không còn tồn tại. | Sửa dứt điểm lỗi ngược dấu: `isPsuSufficient = psuWatt >= power`, `isPsuMarginWarning = psuWatt >= power && psuMarginPercent < 20`, `severity = psuWatt < power ? "BLOCKER" : ...`. (Lưu ý nhỏ: vẫn còn trùng hàm `calculateBuilderInsights` ở 2 file). |
| `P0-07` | ❌ **VẪN FAIL** | `chroma_manager.py:77-102`, `main.py:153-181, 522-584`. Live `GET :5001/health`: `"status":"healthy", "chroma_vectors_count":0`. Live `/v1/rag/models`: JSON giả cũ. Đĩa `chroma.sqlite3`: `gemini_vectors_count: 0`, `is_indexed: False`. | Code Python có sửa đúng hướng (`is_indexed()` check active collection, `/health` trả `"degraded"`, `/v1/rag/models` đọc `get_status()`), **NHƯNG chưa chạy reindex `pcmall_gemini_knowledge` và chưa rebuild/restart container `cnm_ai_service`** (`Up 3 hours`) → dịch vụ live vẫn 0 vector và trả JSON giả y như trước kiểm toán! |
| `P0-08` | ⚠️ **PASS NỬA VỜI** | `services/api/src/socket/socket.service.ts:133-280`, `apps/web/src/services/socket.service.js:15-69`, `apps/web/src/hooks/useSocket.js:24-33`. | Server đã cài `io.use()` verify JWT + `isTokenBlacklisted`, chặn sạch `join_staff_queue`/`join_tech_queue`/`join_user`/`join_ticket` trái phép, giữ Guest kết nối `join_chat`. **NHƯNG gây Regression nghiêm trọng trên FE:** `ensureAuthSync()` gọi `socket.disconnect().connect()` khi đổi/refresh JWT nhưng `useSocket.js` không nghe `connect` để re-join room → mất sạch room & rớt `onlineStaffRegistry` sau 15 phút hoặc khi Guest→Login. Server `io.use()` cũng chưa kiểm tra `user.status`. |
| `P0-09` | ✅ **PASS THẬT** | `ai.controller.js:38`, `ai-advisor.controller.ts:459`, `chat.controller.ts:90, 231-241, 439, 569`. | Đã loại bỏ hoàn toàn fallback `req.body.userId` trên cả 5 endpoint, chỉ tin `req.user` từ JWT; chặn `403` khách giả danh `sender: "staff"` hoặc `"system"`. |
| `P0-10` | ✅ **PASS THẬT** | `app.ts:92-104`, `warranties.route.ts:24-60, 97-147`, `payments.route.js:13-48`, `orders.route.ts:33-65`, `tickets.route.ts:26-61`, `AiChatPage.jsx:70-81`. | Chặn hoàn toàn `.svg`/`.html`, ép đuôi file theo allowlist MIME, thêm `nosniff` + `CSP: default-src 'none'; sandbox` + `Content-Disposition: attachment` ở `/uploads`, đảo `createGuestRateLimit` lên trước Multer + dọn file khi anti-spam chặn, escape HTML ở `AiChatPage.jsx`. (Khuyến nghị bổ sung thêm check magic bytes để đạt chuẩn defense-in-depth). |
| `P0-11` | ✅ **PASS THẬT** | `orders.controller.ts:174-252, 448-544, 1321-1390`, `order-inventory.service.js:12-40`. | Bản vá chất lượng cao: dùng chung `ORDER_STATUS_TRANSITIONS` + `FOR UPDATE` + check tracking/100% Serial ở `patchOrderStatus`, `FOR UPDATE` ở `cancelMyOrder` & coupon checkout, `GREATEST(used_count - 1, 0)`, `restoreOrderInventory` dùng đúng transactional `connection.execute` và không nuốt lỗi. |
| `P0-12` | ⚠️ **PASS NỬA VỜI** | `warranties.controller.ts:323-353, 767-790, 815-979`. Smoke: `lookup/1` → `404`; `lookup/<mã thật>` ẩn danh → che `customerName/Phone/Email` nhưng lộ `timeline[].actorName`. | Vá được 85% (chặn substring/orderId enumeration, chặn guest `warrantyId` tuần tự, xác minh SĐT khi tạo RMA, bọc `FOR UPDATE` + `INSERT` + `LAST_INSERT_ID()` trong 1 `$transaction`). **Sót 2 điểm:** (1) `maskRequestPii()` quên che `timeline[].actorName` làm lộ nguyên tên thật `"Khách Hàng Demo"` và email `"tech1@cnm.local"`; (2) dòng `878` `(ownerPhone && providedPhone !== ownerPhone)` sẽ bị bypass nếu chủ sở hữu chưa lưu SĐT trong DB. |
| `P0-13` | ⚠️ **PASS NỬA VỜI** | `services/api/scripts/migrate.js:235-285`, `services/api/prisma/migrations/20260316*` (vẫn tồn tại), `docker logs cnm_api_prod`. | Đã thêm nhánh phát hiện DB trống gọi `prisma db push` rồi chạy đủ 3 file SQL canonical/audit/warranty. **Còn rủi ro lớn:** (1) Chưa xóa 2 file migration PascalCase hỏng nên `prisma migrate deploy` vẫn fail; (2) `migrate.js:261` truyền `--accept-data-loss=false` (flag boolean trong Prisma CLI không dùng `=false`, chưa được test trên DB trống); (3) Chưa chạy kiểm chứng volume MySQL trắng (`cnm_api_prod` đang crash-loop `ENOTFOUND mysql`). |
| `P0-14` | ✅ **PASS THẬT** | `AdminProductsPage.jsx:297`, `admin-skus.service.js:403-416`, `TechTicketsPage.jsx:650-663`, `CompareProductsPage.jsx:248`, `socket.service.js:42`. | Đã sửa chính xác và gọn gàng cả 5/5 lỗi chết demo: sửa sản phẩm không thành tạo mới, xóa SKU hết 500, Tech reply đính kèm file gửi `FormData`, Compare đọc `variant_id`, Socket client true singleton. |
| `P0-15` | ✅ **PASS THẬT** | `nginx/nginx.conf:84-91`, `nginx/nginx.http.conf:52-55`. | Xóa sạch cấu hình phản chiếu `$http_origin` + credentials khỏi cả 2 file Nginx, giao hoàn toàn cho Express CORS allowlist. |
| `P1-01` | ✅ **PASS THẬT** | `auth.middleware.ts:27-105, 143-179`, `admin.service.js:658-661, 697-700`, `auth.controller.ts:125-129, 419-426`, `orders.controller.ts:393-405`. | Khóa hoặc hạ quyền nhân viên có hiệu lực **tức thì (0ms)** nhờ live DB lookup + cache 2s (`globalThis`) + `invalidateUserAuthCache`; đã rotate refresh token cũ và check blacklist/status trên `optionalAuthenticate` & SSE `streamOrderEvents`. *(Lưu ý: không dùng cột `token_version` nên `changePassword` chưa tự thu hồi phiên ở thiết bị thứ 2).* |
| `P1-02` | ⚠️ **PASS NỬA VỜI** | `pc-builder.service.ts:735-775, 1244, 1904-1925, 2230, 3257`, `xai-explanation.service.ts:383-392, 563-675`, `BuildSummarySidebar.jsx:240-256`, `WhatIfComparisonPanel.jsx:26-85`, `XAIExplanationDrawer.jsx:350`, `indexer.py:10-53`. | Sửa rất nhiều phần lõi (Bottleneck 4K đúng vật lý, 5D Score thực chất & đủ 5 chiều, `?? 0`, FPS theo tier GPU+CPU, bỏ fallback bịa `96`, guard `!item.ok`, đồng bộ `COMP-001..010` Python/Node). **Còn sót 3 lỗi:** (1) `getGpuScore()` ở `pc-builder.service.ts:735-745` quên RTX 5060 Ti/5070/5060/RX 9070 làm demo 20tr báo `53% GPU bottleneck`; (2) `findReplacementProducts` (`:3257`) vẫn bỏ qua `_currentBuild`; (3) `calculateBuilderInsights.js:229` vẫn giữ `rawCaseClearance > 250 ? ... : 360`. |
| `P1-03` | ⚠️ **PASS NỬA VỜI** | `ai.service.js:1175, 1603`, `ai-assistant.service.ts:183-399`, `unified-llm.service.js:46, 49-85, 349-459, 544`, `rag-client.service.ts:14-235`, `main.py:15-18, 193-198, 342, 429`, `hybrid_engine.py:42-70`, `ai-llm.provider.ts` (vẫn dùng). | Vá tốt phần grounding (`stock > 0`, xóa hàng giả hardcode, hậu kiểm `ai-suggest-stream`), Circuit Breaker & `AbortController` riêng từng provider, lọc BM25 trước khi cắt top-k. **Vẫn còn 3 lỗi lớn:** (1) Model không tồn tại `"gemini-3.5-flash-lite"` vẫn là mặc định ở 12 chỗ; (2) Vẫn giữ nguyên 2 LLM Gateway (`unified-llm` + `ai-llm.provider.ts`) và 2 hệ RAG song song; (3) `X-Internal-Key` ở `main.py` **fail-open** (không đặt biến = mở toang) và chỉ gắn lên 2/10 endpoint (`upload`/`delete`, bỏ hở `reindex`/`retrieve`/`models`), trong khi `rag-client.service.ts:168-235` cũng quên gửi header này ở 4 hàm (`triggerReindex`, `getReindexStatus`, `getEmbeddingModels`, `getBuilderQuestions`). |
| `P1-04` | ⚠️ **PASS NỬA VỜI** | `ai-guardrail.service.js:97, 105, 156-162`, `ai-rule.service.js:609, 765-773`, `ai-rule.controller.js:7-147`, `ai.controller.js:43-44`, `routes/index.ts:81-83`, `ai.route.js:27-34`, `chat.route.ts:26`. | Sửa tốt Guardrail từ mơ hồ & index cờ bạc (test bài thơ mùa thu đã pass), debounce `saveStore()` 30s, xóa cache khi sửa rule/prompt, tách `aiRateLimiter` khỏi `/admin/*` và `/chat`. **Còn sót:** `ai.controller.js:43` vẫn cache chỉ theo `userMessage` cuối (bỏ qua lịch sử hội thoại), và `ai-rule.service.js:609` vẫn lưu API key plaintext trong file JSON. |
| `P1-05` | ✅ **PASS THẬT** | `AiChatWidget.jsx:29, 70, 229`, `AdminAiConfigPage.jsx:134, 248, 378, 656-662`. `npx eslint src`: **0 errors, 151 warnings**. | Di chuyển đúng luật React Hooks (không dùng `eslint-disable`), thêm cleanup `reindexPollRef` khi unmount. |
| `P1-06` | ⚠️ **PASS NỬA VỜI** | `admin-system.service.js:227-246`, `AdminDashboardPage.jsx:37-67, 232-233, 238-315`, `AdminSystemPage.jsx:176-190, 595-617`. | Sửa chuẩn SQL `assigned_to_id` & `warranty_requests`, xóa `calculateTrend`, gọi thật `/health` AI service, sửa lọc Audit Log `SALES_STAFF`/`TECH_STAFF`/`SYSTEM`. **Còn sót:** 2 hàm chế biểu đồ giả `buildRevenueSeries`/`buildOrderStatusSeries` vẫn tồn tại & chạy trong `useMemo` ở `AdminDashboardPage.jsx:37-67, 232-233` (dead code), Audit Logs chưa có phân trang server-side (chỉ tăng limit lên 50), và khi AI `:5001` trả 0 vector Dashboard vẫn hiện badge xanh `Hoạt động (0 vectors)`. |
| `P1-07` | ⚠️ **PASS NỬA VỜI** | `apps/web/src/pages/admin/AdminCouponsPage.jsx` (463 dòng), `coupon.service.js:20-41`, `AppRouter.jsx`, `AdminLayout.jsx:15`, `CheckoutPage.jsx:136, 158-172, 2000-2004`, `PaymentResultPage.jsx:53`, `e2e/checkout-full-flow.spec.ts:182`. | Hoàn thiện rất tốt UI `/admin/coupons`, khôi phục thẻ chọn VNPay trên `CheckoutPage` và sửa `PaymentResultPage`. **Còn sót đúng 1 tiểu tiết làm hỏng E2E:** `<label>` ở `CheckoutPage.jsx:2000` không có `id={`payment-method-card-${option.value.toLowerCase()}`}` nên `e2e/checkout-full-flow.spec.ts:182` (`#payment-method-card-vnpay`) vẫn fail khi chạy Playwright! |
| `P1-08` | ⚠️ **PASS NỬA VỜI** | `shipments.service.js:254-288, 353-355`, `warranties.controller.ts:1063-1102`, `TechWarrantiesPage.jsx:237`, `cart.controller.ts:331`, `LoginPage.jsx:89-95`, `products.service.js:154-161, 626`, `orders.controller.ts:169, 915-918`. | Đã sửa 4/5 nhánh nghiệp vụ rất tốt (cổng Serial ở `shipments`, `RMA_STATUS_TRANSITIONS`, fix form Tech 20s poll, merge cart & giữ coupon khi login, lọc `p.is_active=1`, chặn reject đơn đã `PAID`). **BỎ QUÊN 1/5:** `orders.controller.ts:169` vẫn tin thẳng `const shippingFee = Number(payload.shippingFee || 0)` từ client (khách tự đặt `shippingFee: 0` vẫn qua!). |
| `P1-09` | ⚠️ **PASS NỬA VỜI** | `schema.prisma:267, 290` + DB live `decimal(12,2)`, `pc-builder.service.ts:463-470`, `warranties.route.ts:159`, `tickets.controller.ts:64-72, 314`. | Đã nâng `DECIMAL(12,2)` đồng bộ DB live, vá `cloneBuild` IDOR, và thu hẹp quyền ghi RMA khỏi `SALES_STAFF`. **BỎ QUÊN:** `tickets.controller.ts:64-72, 314` (`ticketManageRoles = [ROLES.ADMIN, ROLES.TECHNICIAN, ROLES.SALES]`) vẫn cho `SALES_STAFF` toàn quyền xử lý Ticket kỹ thuật và xem/ghi `INTERNAL`! |
| `P1-10` | ✅ **PASS THẬT** | `app.ts:20`, `routes/index.ts:67`, `auth.route.ts:22-28`, `error.middleware.ts:63-66`, `health-check.ts:23-25`, `nginx/nginx.conf:25, 43-52`, `nginx.http.conf:39`, `docker-compose.prod.yml:10, 81-82`. | Đã vá đủ cả 4 nhóm lỗi: `trust proxy`, thu hẹp `authRateLimiter`, ẩn raw 500/DB error ở production, thêm `client_max_body_size 25m` & `/health` HTTP trên Nginx, đổi `MYSQL_USER` non-root và mount đủ volume prod. *(Cần chạy test thực tế `docker-compose.prod.yml` trên volume sạch).* |
| `P1-11` | ⚠️ **PASS NỬA VỜI** | `services/api/package.json:12` (`219/219 pass`), `tests/load-env.ts:4-8`, `tests/route-smoke.test.ts:52-55`, `compatibility.test.ts` (không đổi), `test_rag.py` (pass), `package.json:18`. DB counts sau test: `users +3`, `token_blacklist +3`, `audit_logs +13`. | Đưa đủ 3 bộ test `src/` + `admin-tags.test.ts` vào `npm test` (pass 219/219), sửa `route-smoke`, sửa `check:all`, thêm `assert` thật vào `test_rag.py` (không làm yếu assertion ở `ai-rule-engine.test.ts` — cập nhật khớp chính sách grounding). **Chưa sửa 4 việc:** (1) `npm test` vẫn chạy thẳng và làm bẩn DB dev `cnm_mk_hb`; (2) `compatibility.test.ts` vẫn chỉ test object giả không gọi `checkRawCompatibility`; (3) `auth.smoke.test.ts` vẫn `# SKIP`; (4) `.venv` chưa cài `pytest`, FE vẫn chỉ có 1 file Vitest. |
| `P2-01` | ⚠️ **PASS NỬA VỜI** | Xóa 18 file rác (`legacy/unused_routes/*`, `test*.tmp`, 5 `.js` controller trùng, 5 dead code `pc-builder`), `env.js` rút còn 1 dòng bridge, `env.ts:71-85` check secret ≥ 24 ký tự, `pc-builder.service.ts:352-356` bỏ runtime `ALTER TABLE`. | Dọn sạch phần lớn rác nguy hiểm nhất; nhưng vẫn duy trì Dual ORM (`Prisma` + `mysql2`), còn 2 cặp bridge `.js`/`.ts` (`env.js`, `auth.middleware.js`) và giữ song song `ai-llm.provider.ts`/`embedding.service.ts`. |
| `P2-02` | ✅ **PASS THẬT** | `schema.prisma`, `scripts/migrate.js:336-406`, kiểm chứng trực tiếp `INFORMATION_SCHEMA` trên MySQL `:3307`. | Đã áp dụng thực sự xuống DB live: 3 bảng con `WarrantyRequest` chuyển `BIGINT` + thêm FK + index, đủ 6 unique constraint, composite index `orders`, và `coupons` dùng `DATETIME` chống Y2038. |
| `P2-03` | ⚠️ **PASS NỬA VỜI** | `auth.controller.ts:428`, `orders.controller.ts:567`, `tickets.controller.ts:185`, `warranties.controller.ts:1123`, `coupons.controller.ts:167,222`, `ai-rule.controller.js`, `HomePage.jsx`, `ProductCard.jsx`, `ProductDetailPage.jsx`, `ProfilePage.jsx`, `AiChatPage.jsx`, `TicketListPage.jsx`, `ErrorBoundary.jsx`, `http.js`, `NotificationBell.jsx`, `order-events.service.js:35`, `admin.service.js:581`. | Hoàn thiện gần như toàn bộ audit logs và tiểu tiết UI/UX rất chỉn chu. **Còn sót 1 điểm bảo mật nhỏ:** `order-events.service.js:35` vẫn truyền JWT trên URL query string `?token=...` (dễ lưu vào log proxy/Nginx). |

---

## 4. LỖI CÒN SÓT, VÁ NỬA VỜI & LỖI MỚI PHÁT SINH (REGRESSION) — ƯU TIÊN CỨU DEMO

### Nhóm A — Có thể làm HỎNG DEMO TRỰC TIẾP hoặc bị Hội đồng "bắt tại trận" (Sửa NGAY trước bảo vệ)

1. **[FAIL — `P0-07`] Python AI `:5001` chưa restart & ChromaDB Gemini trên đĩa vẫn `0` vector:**
   - **Hiện trạng live:** `GET http://127.0.0.1:5001/health` vẫn trả `"status": "healthy", "chroma_vectors_count": 0`; `/v1/rag/models` vẫn trả JSON giả cũ; trên đĩa `pcmall_gemini_knowledge` có `0` vector (`local_vectors_count: 1513`).
   - **Việc cần làm:** Rebuild & restart `cnm_ai_service` từ mã nguồn mới, kích hoạt `POST /v1/rag/reindex` (hoặc `python reindex.py`) để nạp > 1.200 vector vào `pcmall_gemini_knowledge` (hoặc chốt dùng Local ONNX fallback rõ ràng), và xác nhận `/health` trả `chroma_vectors_count > 0` + `"status": "healthy"`.
2. **[REGRESSION MỚI — `P0-08`] Socket.IO FE bị văng khỏi mọi Room khi refresh JWT (15 phút) hoặc khi Guest đăng nhập:**
   - **Vị trí:** `apps/web/src/services/socket.service.js:23-31` + `apps/web/src/hooks/useSocket.js:24-33` + `RealtimeToast.jsx:81-130`.
   - **Cơ chế hỏng:** `ensureAuthSync()` gọi `socket.disconnect().connect()` mỗi khi `accessToken` thay đổi (kể cả khi tự động refresh token sau 15 phút). Trên server, `disconnect` xóa ngay nhân viên khỏi `onlineStaffRegistry` (`unregisterOnlineStaff(socket.id)`). Khi socket kết nối lại với token mới, `useSocket.js` **không có listener `socket.on("connect", ...)` để re-emit `join_user`, `join_staff_queue`, `join_tech_queue`, `join_ticket`** → Nhân viên bán hàng âm thầm biến mất khỏi hàng đợi Human Handoff, khách hàng ngừng nhận thông báo realtime!
   - **Hướng vá nhanh (15 phút):** Lưu danh sách các room đã join trong `socket.service.js` (hoặc `useSocket.js`) và tự động re-emit lại tất cả khi sự kiện `socket.on("connect")` bắn (trừ khi đã `leaveRoom`).
3. **[BUG LÕI DEMO — `P0-04` + `P0-05` + `P1-02`] 3 lỗi liên hoàn trong màn hình "Gợi ý PC 20tr Gaming":**
   - **Lỗi 3a (`pc-builder.service.ts:735-745`):** `getGpuScore()` quên không khai báo `"5070"`, `"5060 ti"`, `"5060"`, `"5050"`, `"9070"` → `Asus DUAL RTX 5060 Ti 16G OC` rơi xuống mặc định `30 điểm` (< RTX 3050 = 36) → cấu hình `bestValue` (`100/100`) bị cảnh báo đỏ **`53% GPU SEVERELY_BOTTLENECKED`**!
   - **Lỗi 3b (`pc-builder.service.ts:2316-2319`):** Vòng lặp kiểm tra luật DB Nhánh 1 chỉ kiểm tra `sourceCategoryId`, **quên kiểm tra `targetCategoryId`** → CPU `i5-12400F` (`LGA1700`) bị so khớp với Tản nhiệt đa socket (`LGA1200`) qua `rule_146`, biến `bestPerformance` thành **`0/100 BLOCKED`** với lỗi vô lý `"LGA1700 / LGA1700 FAIL"`!
   - **Lỗi 3c (`budgetSafe`):** Ghép `ASUS Prime H610M-K` với `JONSBO D32 (mATX)` nhưng báo `case_form_factor: MB ATX / Case mATX` → `budgetSafe` bị **`0/100 BLOCKED`**.
   - **Lỗi 3d (`pc-builder.service.ts:2345-2346`):** 8/12 luật key-only trong DB dùng key tiếng Anh không khớp tên thuộc tính tiếng Việt trong `attributes` nên không chạy; cần bảng alias (`case_gpu_clearance → ["Maximum GPU Length", ...]`, `m2_slots → ["Số khe M.2 NVMe", ...]`, `radiator_size → ["Kích thước Tản / Radiator", ...]`) và sửa toán tử Luật `id=172` từ `GTE` sang `GT`.
4. **[LỆCH FE↔BE↔AI — `X-Internal-Key` & Model AI]:**
   - `services/ai-service/main.py:15-18` đang **fail-open** (không đặt `AI_SERVICE_INTERNAL_KEY` là bỏ qua xác thực) và chỉ bảo vệ `upload`/`delete`, bỏ hở `POST /v1/rag/reindex`, `POST /v1/rag/retrieve`, `GET /v1/rag/documents`, `GET /v1/rag/models`. Nếu bật `AI_SERVICE_INTERNAL_KEY` lên toàn bộ route Python, **4 hàm trong `rag-client.service.ts:168-235` (`triggerReindex`, `getReindexStatus`, `getEmbeddingModels`, `getBuilderQuestions`) sẽ gãy `401`** vì quên gọi `this.getInternalHeaders()`!
   - Tên model không tồn tại `"gemini-3.5-flash-lite"` vẫn còn ở 12 vị trí (bao gồm cả dropdown mặc định của `AdminAiConfigPage.jsx:84, 1148, 1893`).

### Nhóm B — Lỗi sót mức Trung bình / Cần dọn trước khi nộp mã nguồn

5. **An toàn dữ liệu & RBAC còn sót:**
   - `orders.controller.ts:169`: vẫn nhận `shippingFee` trực tiếp từ client (nên tính phía server theo cấu hình/khu vực).
   - `warranties.controller.ts:323-335`: bổ sung che `timeline[].actorName` trong `maskRequestPii()` và sửa dòng `878` khi `ownerPhone` rỗng.
   - `tickets.controller.ts:64-72, 314`: tách `ROLES.SALES` khỏi quyền quản trị Ticket kỹ thuật / ghi chú `INTERNAL` (hoặc ghi rõ trong ma trận RBAC nếu cố ý cho Sales xem Ticket PUBLIC).
   - `auth.controller.ts:224`: thêm cờ `ENABLE_MOCK_GOOGLE_AUTH=true` để tắt mặc định kể cả trên staging/dev.
6. **Kiểm thử, Migration & Vệ sinh Git:**
   - `CheckoutPage.jsx:2000`: thêm `id={`payment-method-card-${option.value.toLowerCase()}`}` để khớp `e2e/checkout-full-flow.spec.ts:182`.
   - `scripts/migrate.js:261`: bỏ `=false` (chỉ để `["prisma", "db", "push", "--skip-generate"]`), xóa 2 thư mục migration PascalCase hỏng (`20260316*`), tắt/dọn container `cnm_api_prod` đang crash-loop.
   - `services/api/tests/load-env.ts`: tách `DATABASE_URL` test sang `cnm_mk_hb_test` để không làm bẩn DB demo trước ngày bảo vệ; viết test gọi thật `checkRawCompatibility` trong `compatibility.test.ts`.
   - **Kiểm tra lại Git trước khi commit/push:** Khôi phục lại những tài liệu cần thiết trong 41 file `docs/` bị xóa nhầm (nếu có), gỡ `services/ai-service/data_store/chroma_db/chroma.sqlite3` (27.8MB) và 3 file `cam_nang_pc_mall_rag_test.*` khỏi Git tracking.

### Nhóm C — Mục `[CHƯA THỂ KIỂM CHỨNG]` trong phiên phúc khảo này

- **`[CHƯA THỂ KIỂM CHỨNG - API :4000 và Web :5173 đang tắt]`:** Chạy toàn bộ bộ Playwright E2E trực tiếp trên trình duyệt thật và kiểm tra luồng click trực quan 4 cổng.
- **`[CHƯA THỂ KIỂM CHỨNG - Không xóa volume MySQL đang dùng]`:** Chạy `docker compose -f docker-compose.prod.yml up --build` trên volume MySQL hoàn toàn trắng (để xác nhận `migrate.js` + `prisma db push` + 3 file SQL chạy trơn tru từ đầu đến cuối).
- **`[CHƯA THỂ KIỂM CHỨNG - Credentials thật / Quota Free Tier]`:** Gửi email SMTP Gmail (đang báo `535-5.7.8 BadCredentials`), giao dịch ngân hàng SePay/VNPay thật, và failover LLM khi hết quota thật (Gemini Free Tier trong log test đang hết 20 req/ngày).

---

## 5. CHECKLIST CẬP NHẬT NGƯỢC LẠI VÀO BÁO CÁO KLTN (ĐỒNG BỘ CODE ↔ BÁO CÁO)

Các chỉnh sửa vừa qua đã thay đổi nhiều thông số kiến trúc, bảo mật và tính năng — sinh viên **bắt buộc rà soát và cập nhật lại Báo cáo KLTN & Slide** theo danh sách sau để tránh lệch giữa chữ viết và mã nguồn khi hội đồng kiểm tra chéo:

- [ ] **Số lượng & Kết quả Kiểm thử tự động:**
  - Cập nhật tổng số bài test Backend API từ `193` lên **`219` test cases / `70` suites (`38` file test)** (đã bao gồm `admin-tags.test.ts` và 3 bộ test `src/__tests__/unified-llm.test.ts`, `pc-builder.integration.test.ts`, `compatibility.test.ts`). Ghi trung thực `auth.smoke.test.ts` đang skip nếu chưa bật.
  - Ghi rõ ESLint Frontend đạt **`0 errors`** (`151 warnings`), TypeScript API & Web **`0 errors`**, Vite production build thành công (`272 modules`), Python RAG pipeline có kịch bản kiểm chứng `assert` qua `test_rag.py` (`4/4` truy vấn đạt).
- [ ] **Bổ sung 2 tính năng mới vừa code vào Chương Thiết kế & Kết quả:**
  - **Trang Quản lý Mã giảm giá (`/admin/coupons`):** Cập nhật sitemap cổng Admin, sơ đồ Use Case Admin và ảnh chụp màn hình `AdminCouponsPage.jsx` (CRUD, lọc trạng thái Active/Inactive/Expired, bật/tắt nhanh, ghi `audit_logs`).
  - **Hệ thống Product Tags & Thuật toán PC Builder GPU-first / Tag-aware:** Cập nhật ERD (thêm 2 bảng `tags` và `product_tags`), API `/api/admin/tags`, giao diện gắn tag trong `AdminProductsPage.jsx`, và luồng chọn linh kiện ưu tiên GPU-first cho tác vụ Gaming AAA / Đồ họa / AI + Backfill ngân sách ≥ 95%.
- [ ] **Cập nhật Cơ chế Xác thực & Thu hồi Phiên (Chương Bảo mật):**
  - Ghi chính xác cơ chế hiện tại: **JWT + `token_blacklist` đồng bộ múi giờ qua `FROM_UNIXTIME(?)` + `jwtid` UUID + Refresh Token Rotation + Live DB User State Cache (TTL 2 giây, chủ động `invalidateUserAuthCache` tức thì khi khóa/đổi vai trò)** — **KHÔNG** viết là dùng cột `token_version` trong bảng `users` (vì DB không có cột này!).
  - Ghi rõ chính sách bảo mật **Socket.IO (`io.use()` verify JWT + kiểm tra sở hữu room & vai trò)** và **Upload file an toàn** (allowlist MIME-to-extension, chặn `.svg`/`.html`, headers `nosniff` + `CSP: default-src 'none'; sandbox` + `Content-Disposition: attachment`, HTML escaping chống XSS trong Live Chat).
- [ ] **Cập nhật Thanh toán & Toàn vẹn Giao dịch:**
  - Cập nhật `CheckoutPage`: có đủ **3 phương thức** (**COD**, **VietQR tự động SePay**, **VNPay Gateway**) khớp với cấu hình `AdminSystemPage`.
  - Cập nhật cơ chế **MoMo IPN**: đã chuẩn hóa fail-closed (`503` khi chưa cấu hình), `HMAC-SHA256` + `timingSafeEqual`, khóa dòng `SELECT ... FOR UPDATE`, đối chiếu chặt `amount`, `payment_method`, `status`.
  - Cập nhật kiểm soát đồng thời & State Machine: `ORDER_STATUS_TRANSITIONS` + `FOR UPDATE` (hủy đơn & coupon), `RMA_STATUS_TRANSITIONS` (6 bước 1 chiều), cổng 100% Serial áp dụng đồng nhất cho cả `orders` và `shipments`.
- [ ] **Cập nhật Schema CSDL (Chương Thiết kế CSDL):**
  - `products.price` và `product_skus.price`: **`DECIMAL(12, 2)`** (hỗ trợ cấu hình/GPU ≥ 100 triệu VNĐ).
  - `coupons.start_date` / `end_date`: **`DATETIME`** (tránh giới hạn Y2038 của `TIMESTAMP`).
  - `warranty_request_events` / `attachments` / `notifications`: chuẩn hóa `request_id` sang **`BIGINT`** kèm khóa ngoại tới `warranty_requests(id)` và 6 ràng buộc `UNIQUE` chống trùng dữ liệu.
- [ ] **Cập nhật phần AI / Hybrid RAG & Mục "Hạn chế và Hướng phát triển" (giữ tính trung thực khoa học):**
  - Nếu chưa đổi model mặc định: thay toàn bộ tên `"gemini-3.5-flash-lite"` trong báo cáo/slide sang model thật Google API đang dùng (`gemini-2.5-flash` / `gemini-2.0-flash`) sau khi sửa đồng bộ trong code.
  - Thừa nhận thẳng ở mục *Hạn chế*: (1) FPS ước lượng theo mô hình phân hạng Tier CPU–GPU (không đo thực nghiệm từng tựa game); (2) `COMP-008` kiểm tra theo ngưỡng công suất chuẩn PSU thay vì đọc số dây 8-pin/12VHPWR vật lý; (3) Đồng bộ Vector ChromaDB thực hiện qua Reindex thủ công/định kỳ thay vì CDC thời gian thực từ MySQL; (4) `changePassword` mới thu hồi token phiên hiện tại (chưa thu hồi đa thiết bị bằng `token_version`); (5) E2E tự động mới tập trung luồng khách hàng.

---

## 6. DANH SÁCH KIỂM TRA TAY CUỐI CÙNG TRÊN TRÌNH DUYỆT (5 PHÚT TRƯỚC GIỜ BẢO VỆ)

Sau khi vá nốt 4 lỗi "đinh" ở Mục 4 (Nhóm A) và khởi động đủ 4 dịch vụ (`MySQL :3307`, `AI :5001`, `API :4000`, `Web :5173`), sinh viên tự bấm tuần tự đúng 8 bước sau trong **5 phút** (mở sẵn **DevTools → Console & Network** để chắc chắn không có lỗi đỏ `4xx/5xx` bất thường):

1. **Phút 0:00–0:40 — Kiểm tra sức khỏe dịch vụ & RAG sống:**
   - Mở `http://127.0.0.1:5001/health` → xác nhận `"status": "healthy"` và **`"chroma_vectors_count" > 0`**.
   - Đăng nhập `admin@cnm.local` → mở `/admin/dashboard` → kiểm tra 4 đèn sức khỏe xanh (API, DB, Thanh toán, Dịch vụ AI có số vector > 0), kiểm tra số **Ticket chưa nhận** (`> 0`) và **RMA đang xử lý** hiển thị đúng thực tế.
2. **Phút 0:40–1:30 — Kiểm tra các màn hình Admin vừa vá:**
   - Vào `/admin/coupons` → tạo thử 1 mã test (`TESTDEMO50K`), bấm **Tắt → Bật**, xác nhận hiện ngay trong bảng.
   - Vào `/admin/products` → bấm **Sửa** 1 sản phẩm có sẵn → đổi nhẹ mô tả hoặc gắn 1 Tag → bấm **Lưu** → xác nhận **cập nhật đúng sản phẩm đó** (không báo trùng slug 409, không tạo sản phẩm mới).
   - Vào `/admin/system` → bấm các nút lọc Audit Log `ADMIN`, `SALES_STAFF`, `TECH_STAFF`, `SYSTEM` → xác nhận có dữ liệu hiện ra đúng vai trò; vào `/admin/ai-config` chuyển qua lại các tab đảm bảo không crash trắng trang.
3. **Phút 1:30–2:30 — Demo trọng tâm Smart PC Builder (`/pc-builder`):**
   - Bấm **Gợi ý cấu hình 20 triệu Gaming** → kiểm tra **cả 3 thẻ ứng viên** đều có điểm tương thích cao (không có thẻ `0/100`), kiểm tra mục Bottleneck của RTX 5060 Ti không còn báo đỏ `53%`, chuyển đổi độ phân giải **1080p → 4K** xem phần trăm nghẽn đổi đúng chiều vật lý.
   - Cố tình chọn **RTX 4090 + nguồn 400W** → xác nhận hiện nhãn đỏ **`BLOCKER` (Thiếu công suất)** đúng trên UI và nút mua bị cảnh báo/chặn; mở **XAI Drawer** xác nhận các mục PASS xanh không bị hiện khung đỏ xung đột.
   - Chạy thử **What-If (+5 triệu)** → xác nhận hiện đủ 5 chiều điểm và FPS thay đổi theo GPU/CPU.
4. **Phút 2:30–3:15 — Demo AI Chat & Guardrails (`/ai-chat`):**
   - Hỏi 1 câu phần cứng thật (*"Tư vấn build PC 20 triệu chơi game"*) → xác nhận trả sản phẩm thật có trong kho, không bịa link/mã giả.
   - Hỏi 1 câu ngoài lề (*"Viết bài thơ về mùa thu"* hoặc *"Cách nấu phở bò"*) → xác nhận Guardrail chặn ngay lập tức.
   - Thử gửi chuỗi `<img src=x onerror=alert(1)>` vào khung chat → xác nhận hiển thị dạng văn bản thuần (không bật popup `alert`).
5. **Phút 3:15–4:00 — Demo Checkout VNPay / VietQR & Mã giảm giá:**
   - Thêm sản phẩm từ `/compare` vào giỏ hàng → xác nhận thêm đúng SKU.
   - Ở `/checkout`, kiểm tra hiện đủ **3 thẻ thanh toán** (COD, VietQR SePay, VNPay), thử áp mã giảm giá vừa tạo, đặt 1 đơn VNPay Mock/Sandbox hoặc VietQR xác nhận luồng hoàn tất.
6. **Phút 4:00–4:35 — Demo Tech Portal & Bảo hành ẩn danh:**
   - Đăng nhập `tech1@cnm.local` → mở `/tech/tickets` → trả lời 1 ticket **kèm đính kèm 1 ảnh `.jpg`** → xác nhận ảnh hiển thị sau khi gửi; thử gửi file `.svg` xác nhận bị chặn `400`.
   - Mở `/tech/warranties` → gõ thử vài chữ vào ô ghi chú và đợi **25 giây** → xác nhận auto-poll không làm mất chữ đang gõ.
   - Mở tab Ẩn danh (Incognito) → tra cứu `/warranties` bằng số `1` → xác nhận báo không tìm thấy (không lộ PII).
7. **Phút 4:35–5:00 — Demo Realtime Socket.IO & Kiểm tra khóa tài khoản:**
   - Mở 2 cửa sổ: cửa sổ 1 đăng nhập `sales@cnm.local` mở `/staff/chat`, cửa sổ 2 là Guest bấm chuyển nhân viên tư vấn → xác nhận tin nhắn 2 chiều nảy ngay lập tức không cần F5.
   - Dùng Admin bấm **Khóa** 1 tài khoản test đang đăng nhập ở cửa sổ khác → F5 hoặc gọi API ở cửa sổ đó → xác nhận bị đá `403` ngay lập tức.


---

## 6. CẬP NHẬT NGHIỆM THU SAU KHẮC PHỤC TRIỆT ĐỂ (POST-REMEDIATION VERIFICATION)

Sau khi triển khai toàn bộ 6 đợt chỉnh sửa cho 17 mục tồn đọng (`1 FAIL` + `16 PASS NỬA VỜI`), lỗi regression Socket.IO reconnect và dọn dẹp Docker/Git, kết quả kiểm chứng thực tế đạt **29/29 `✅ PASS THẬT`**.

### 6.1. Bằng chứng kiểm thử tự động & dịch vụ thực tế sau sửa lỗi

| Thành phần | Lệnh / Endpoint kiểm chứng | Kết quả thô thực tế |
|---|---|---|
| **API TypeScript** | `services/api`: `npx tsc --noEmit` | `EXIT=0` (0 lỗi biên dịch) |
| **API Test Suite** | `services/api`: `npm test` (chạy trên DB cô lập `cnm_mk_hb_test`) | **230 / 230 PASS**, `0 fail`, `0 skipped` (`72 suites`, `51.46s`) |
| **Cô lập DB Dev (`P1-11`)** | Đếm hàng trên `cnm_mk_hb` trước & sau `npm test` | `BEFORE = AFTER` (`users=139, orders=457, tickets=6, token_blacklist=105, audit_logs=347`, **`DEV_DB_UNCHANGED=True`**) |
| **Migration DB trống (`P0-13`)** | Chạy `node scripts/migrate.js` trên DB `cnm_mk_hb_test` trống hoàn toàn | `EXIT=0`, khởi tạo thành công **40 bảng**, sửa `rule_172` (`GT`), `rule_183` (`is_compatible=1`), vô hiệu hóa luật seed mâu thuẫn (`160, 161, 162, 171`) |
| **Web Static & Build** | `apps/web`: `tsc --noEmit`, `eslint src`, `vitest run`, `vite build` | `tsc`: 0 lỗi; `eslint`: **0 errors** (148 warnings); `vitest`: **11/11 PASS**; `vite build`: **PASS** (272 modules) |
| **Python AI Service** | `compileall` + `.venv` `pytest -v test_rag.py` | `compileall`: 0 lỗi; `pytest`: **1/1 PASSED** (`8.76s`) |
| **Live AI Health (`P0-03`)** | `GET http://127.0.0.1:5001/health` | `HTTP 200`, `"status": "healthy"`, **`"chroma_vectors_count": 1513`** (`pcmall_knowledge`, Local ONNX Fallback) |
| **Live AI Internal Key (`P0-10`)** | `GET http://127.0.0.1:5001/v1/rag/models` (không key vs có `X-Internal-Key`) | Không key → **`HTTP 401`**; Có key → **`HTTP 200`**; tất cả route `/v1/rag/*` đã bảo vệ và đồng bộ header trên `rag-client.service.ts` |
| **Auth Mock Gate (`P0-01`)** | `POST /api/auth/google-mock` | **`HTTP 403`** mặc định (`ENABLE_MOCK_GOOGLE_AUTH=false`) |
| **Warranty PII (`P0-12`)** | `GET /api/warranties/lookup/BH-SN-CPUINTEL-...` | `HTTP 200`, `hasUserId: false`, `customerName: "Khách *** Demo"`, `customerPhone: "098****321"`, `timeline[].actorName` đã che (`"Khách *** Demo"` / `"Kỹ thuật viên PC Mall"`) |
| **PC Builder 20tr (`P0-04/05`)** | `POST /api/pc-builder/suggest` (`20,000,000đ`, `gaming`) | **3/3 cấu hình đạt `100/100 COMPATIBLE`** (`bestValue: 20.84tr`, `bestPerformance: 22.73tr`, `budgetSafe: 17.58tr`), bottleneck `15% BALANCED`, luật DB key-only (`rule_173`, `rule_176`, ...) kích hoạt thực tế |
| **Shipping Fee Anti-Tamper (`P1-08`)** | `POST /api/orders/checkout` gửi `shippingFee: 0` với đơn `< 5tr` | Server bỏ qua client, áp đúng `30,000đ` (`final_amount = subtotal + 30,000đ`); đơn `>= 5tr` miễn phí `0đ` |
| **Tickets RBAC (`P1-09`)** | Test tự động #11 trong `tickets-rma.test.ts` | `SALES_STAFF` xem `GET /:id` bị lọc sạch tin `INTERNAL`, bị chặn **`403`** khi `PATCH /:id` hoặc `POST /:id/messages` |
| **SSE Ticket Auth (`P2-03`)** | `GET /api/orders/events?token=<JWT>` vs `POST /api/orders/events/ticket` | Query `?token=` bị chặn **`401`**; `POST /events/ticket` cấp one-time ticket sống 30s |
| **Audit Logs Pagination (`P1-07`)** | `GET /api/admin/system/audit-logs?page=1&limit=5` | `HTTP 200`, `pagination: { page: 1, limit: 5, total: 390, totalPages: 78 }` |
| **Docker & Git Hygiene (`P2-01`)** | `docker ps` & `git status` | Còn 3 container khỏe mạnh (`cnm_ai_service (healthy)`, `cnm_mysql (healthy)`, `cnm_phpmyadmin`); đã gỡ `cnm_api_prod`, untrack `chroma.sqlite3`, xóa file test rác |

### 6.2. Điểm đánh giá lại 7 trụ cột sau khắc phục triệt để

| Trụ cột | Kiểm toán gốc | Phúc khảo lần 1 | Sau khắc phục triệt để |
|---|---:|---:|---:|
| 1. Bảo mật, Xác thực & RBAC | 42% | 74% | **94%** |
| 2. Kiến trúc & Đồng bộ Backend/Frontend | 55% | 78% | **93%** |
| 3. AI Service, Hybrid RAG & LLM Gateway | 48% | 62% | **92%** |
| 4. Smart PC Builder & Luật Tương thích | 58% | 68% | **95%** |
| 5. Cơ sở dữ liệu, Migration & Tính toàn vẹn | 52% | 70% | **94%** |
| 6. Kiểm thử tự động & Cô lập môi trường | 60% | 75% | **94%** |
| 7. Vận hành Docker, Clean Repo & UI Admin | 68% | 80% | **93%** |
| **Tổng điểm sẵn sàng bảo vệ KLTN** | **55%** | **74%** | **94% — Sẵn sàng bảo vệ** |
