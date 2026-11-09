# BÁO CÁO THIẾT KẾ HỆ THỐNG & ĐẶC TẢ BIỂU ĐỒ UML
## TASK-03: UML MODELING & SYSTEM SPECIFICATION

> **Dự án**: Hệ Thống Thương Mại Điện Tử & Hệ Chuyên Gia Tư Vấn Lắp Ráp Máy Tính (PC Mall & Smart PC Builder)  
> **Cơ sở dữ liệu**: MySQL 8.0 (`cnm_mk_hb` / `cnm_ecommerce`)  
> **Kiến trúc phần mềm**: Clean Layered Architecture kết hợp Domain-Driven Design (DDD) & Knowledge-Based Expert System  
> **Tài liệu phục vụ**: Báo cáo Đồ án / Khóa luận tốt nghiệp chuyên ngành Kỹ thuật Phần mềm / Công nghệ Thông tin  
> **Ngày cập nhật**: 2026-11-04  

---

## MỤC LỤC TỔNG QUAN

1. [PHẦN 1: TỔNG QUAN HỆ THỐNG & KIẾN TRÚC PHẦN MỀM](#phần-1-tổng-quan-hệ-thống--kiến-trúc-phần-mềm)
   - 1.1. Bối cảnh & Tầm nhìn Kiến trúc Hệ thống
   - 1.2. Mô hình Kiến trúc Phân tầng (Layered Architecture)
   - 1.3. Mô hình Triển khai & Hệ Sinh thái Công nghệ (Tech Stack)
   - 1.4. Tiêu chuẩn Mô hình hóa UML 2.5 áp dụng trong Đề tài
2. [PHẦN 2: PHÂN RÃ USE CASE THEO 5 ACTOR (USE CASE MODELING)](#phần-2-phân-rã-use-case-theo-5-actor)
   - 2.1. Ma trận Tác nhân (5 Human Actors & 3 External Service Actors)
   - 2.2. Sơ đồ Use Case Toàn hệ thống (Phân rã 4 Subsystems)
   - 2.3. Sơ đồ Use Case Chi tiết cho từng Actor:
     - 2.3.1. Sơ đồ Use Case: Khách Hàng Vãng Lai (Guest)
     - 2.3.2. Sơ đồ Use Case: Khách Hàng Thành Viên (Customer)
     - 2.3.3. Sơ đồ Use Case: Nhân Viên Bán Hàng (Sales Staff)
     - 2.3.4. Sơ đồ Use Case: Nhân Viên Kỹ Thuật (Tech Staff)
     - 2.3.5. Sơ đồ Use Case: Quản Trị Viên (System Admin)
   - 2.4. Bảng Tổng hợp Danh mục Use Case Toàn Hệ Thống (Mã hóa UC-01 đến UC-32)
   - 2.5. Đặc tả Chi tiết các Use Case Trọng tâm Công nghệ (Use Case Specifications)
3. [PHẦN 3: SƠ ĐỒ HOẠT ĐỘNG (ACTIVITY DIAGRAMS)](#phần-3-sơ-đồ-hoạt-động-activity-diagrams)
   - 3.1. Sơ đồ Hoạt động 1: Luồng Build PC & Xử lý Tập luật Tương thích (Knowledge-Based Expert Engine)
   - 3.2. Sơ đồ Hoạt động 2: Luồng Tư vấn Cấu hình Trí tuệ Nhân tạo (AI Advisor & Recommendation Engine)
   - 3.3. Sơ đồ Hoạt động 3: Luồng Đặt hàng, Áp dụng Voucher & Thanh toán Cổng VNPay
4. [PHẦN 4: SƠ ĐỒ TUẦN TỰ (SEQUENCE DIAGRAMS)](#phần-4-sơ-đồ-tuần-tự-sequence-diagrams)
   - 4.1. Sequence Diagram 1: Xác thực Người dùng, Cấp JWT & Thu hồi Token khi Đăng xuất (Logout Blacklist)
   - 4.2. Sequence Diagram 2: Lắp ráp PC & Đánh giá Tương thích Thời gian Thực (Real-time Compatibility Engine)
   - 4.3. Sequence Diagram 3: Giao dịch Thanh toán Điện tử VNPay & Xử lý Webhook IPN Đối soát
   - 4.4. Sequence Diagram 4: Quản lý Số Serial Xuất kho & Tự động Kích hoạt Bảo hành Điện tử (e-Warranty Lifecycle)
   - 4.5. Sequence Diagram 5: Tiếp nhận & Xử lý Yêu cầu Bảo hành RMA Kèm Bằng chứng Hình ảnh
   - 4.6. Sequence Diagram 6: Tư vấn CSKH Trực tuyến (Live Chat Session) & Chia sẻ Dàn PC

---

<a name="phần-1-tổng-quan-hệ-thống--kiến-trúc-phần-mềm"></a>
## PHẦN 1: TỔNG QUAN HỆ THỐNG & KIẾN TRÚC PHẦN MỀM

### 1.1. Bối cảnh & Tầm nhìn Kiến trúc Hệ thống
Hệ thống **PC Mall & Smart PC Builder** là một nền tảng thương mại điện tử chuyên sâu dành cho ngành bán lẻ phần cứng máy tính và máy trạm (Workstation/PC Gaming). Khác biệt hoàn toàn với các trang TMĐT tổng hợp thông thường (chỉ quản lý mua/bán đơn thuần), ngành phần cứng máy tính đòi hỏi một hệ thống phải giải quyết được bài toán hóc búa nhất: **Tính tương thích phức tạp giữa hàng trăm chuẩn giao tiếp phần cứng** (Socket CPU, Bus RAM, Form Factor Bo mạch chủ, Chiều dài VGA, Kích thước tản nhiệt nước, Công suất nguồn tải đỉnh TDP...).

Để giải quyết bài toán này, hệ thống được thiết kế theo hướng tích hợp lai (Hybrid Intelligence):
1. **Knowledge-Based Expert System (Hệ chuyên gia dựa trên tri thức)**: Vận hành trực tiếp trên cơ sở dữ liệu 441+ luật ràng buộc phần cứng và 10 bộ quy tắc cốt lõi (COMP-001 đến COMP-010), bảo đảm tính chính xác vật lý tuyệt đối 100%, ngăn ngừa hiện tượng khách mua nhầm linh kiện không gắn vừa.
2. **Generative AI & LLM Advisor (Trí tuệ nhân tạo tạo sinh)**: Tích hợp mô hình ngôn ngữ lớn (Google Gemini 3.5 Flash-Lite / Multi-provider LLM) đóng vai trò Chuyên gia tư vấn cấu hình, phân tích sâu nhu cầu người dùng theo ngân sách, tựa game, độ phân giải và đưa ra lời khuyên tối ưu hóa hiệu năng/giá thành (Performance/Price Ratio).

### 1.2. Mô hình Kiến trúc Phân tầng (Layered Architecture)
Hệ thống tuân thủ nghiêm ngặt mô hình kiến trúc phân tầng chuẩn doanh nghiệp (Enterprise Layered Architecture) nhằm bảo đảm tính độc lập, khả năng kiểm thử cao và dễ dàng bảo trì:

```mermaid
flowchart TD
    subgraph Presentation_Layer["1. PRESENTATION LAYER (Giao diện Người dùng)"]
        direction TB
        WebClient["React 19 + Vite 6 Single Page App (SPA)"]
        ClientStore["Client State Management (Zustand / Custom Hook Store)"]
        RuleClientEval["Client-Side Fast Rule Evaluator (calculateBuilderInsights.js)"]
    end

    subgraph API_Gateway_Layer["2. API GATEWAY & ROUTING LAYER"]
        direction TB
        ExpressServer["Express.js HTTP / HTTPS Server (Port 5000)"]
        AuthMiddleware["Auth & RBAC Middleware (JWT Verification & Token Blacklist Check)"]
        ValidationMiddleware["Request Validation Middleware (Zod Schemas)"]
        LoggingMiddleware["Pino Structured Request Logger"]
    end

    subgraph Application_Domain_Layer["3. APPLICATION & DOMAIN BUSINESS LAYER"]
        direction TB
        PCBuilderService["PC Builder Service & Expert Rules Engine"]
        AIAdvisorService["AI Advisor Service (Gemini Stream & Candidate Pool 32)"]
        OrderService["Order & Atomic Inventory Reservation Service"]
        PaymentService["Payment Gateway Service (VNPay SHA512 Checksum)"]
        WarrantyService["e-Warranty & RMA Serial Tracking Service"]
        ChatTicketService["Live Chat & Technical Helpdesk Service"]
    end

    subgraph Infrastructure_Persistence_Layer["4. INFRASTRUCTURE & PERSISTENCE LAYER"]
        direction TB
        PrismaClient["Prisma ORM Singleton Client (MySQL Provider)"]
        MySQLDatabase[("MySQL 8.0 Database (cnm_mk_hb)")]
        ExternalGemini["Google Gemini AI Cloud API"]
        ExternalVNPay["VNPay Sandbox Payment Gateway"]
    end

    Presentation_Layer -->|RESTful APIs / JSON over HTTP| API_Gateway_Layer
    API_Gateway_Layer --> Application_Domain_Layer
    Application_Domain_Layer --> Infrastructure_Persistence_Layer
    Infrastructure_Persistence_Layer -.->|Query / Persist| MySQLDatabase
    Application_Domain_Layer -.->|HTTPS Call| ExternalGemini
    Application_Domain_Layer -.->|HTTPS Redirection & IPN Webhook| ExternalVNPay
```

### 1.3. Mô hình Triển khai & Hệ Sinh thái Công nghệ (Tech Stack)
- **Frontend Presentation**: React 19, React Router v7, Vite 6, Tailwind CSS, Lucide Icons, Canvas Confetti.
- **Backend API Server**: Node.js v20 LTS, TypeScript 5, Express.js 4, Zod Validation, Pino Logger.
- **Database Management & ORM**: MySQL 8.0, Prisma ORM v5 (`native` engine cho Windows phát triển và `linux-musl-openssl-3.0.x` cho môi trường Docker Alpine).
- **Trí tuệ nhân tạo**: Google Gemini API (`@google/genai`), hỗ trợ dự phòng linh hoạt qua OpenAI, Groq, DeepSeek.
- **Thanh toán & Giao vận**: VNPay Payment Gateway (thuật toán mã hóa băm SHA-512 đối soát IPN), GHN / GHTK Mock Shipping API.
- **Bảo mật**: Bcrypt mật khẩu người dùng, JSON Web Token (JWT) kết hợp Token Blacklist chống Replay Attack, Atomic Row-level Locking chống overselling kho hàng.

### 1.4. Tiêu chuẩn Mô hình hóa UML 2.5 áp dụng trong Đề tài
Toàn bộ các biểu đồ trong tài liệu này tuân theo chuẩn **Unified Modeling Language (UML) phiên bản 2.5** do Object Management Group (OMG) ban hành, bao gồm:
1. **Use Case Diagram**: Phân định ranh giới hệ thống, tác nhân và hành vi nghiệp vụ.
2. **Activity Diagram**: Mô hình hóa luồng công việc điều khiển, các điểm rẽ nhánh quyết định và xử lý ngoại lệ song song.
3. **Sequence Diagram**: Mô hình hóa sự tương tác tuần tự theo thời gian giữa các đối tượng phân lớp (UI $\leftrightarrow$ Controller $\leftrightarrow$ Service $\leftrightarrow$ Database).

---

<a name="phần-2-bảng-ánh-xạ-thực-thể"></a>
## PHẦN 2: PHÂN RÃ USE CASE THEO 5 ACTOR (USE CASE MODELING)

### 2.1. Ma trận Tác nhân (Actors Matrix)
Hệ thống xác định rõ **5 Tác nhân con người (Human Actors)** và **3 Tác nhân dịch vụ ngoài (External Service Actors)** tham gia vào các tiến trình nghiệp vụ:

| Tác nhân (Actor) | Phân loại | Vai trò & Trách nhiệm chính trong Hệ thống |
| :--- | :---: | :--- |
| **1. Khách Hàng Vãng Lai (Guest)** | Con người | Khách truy cập ẩn danh chưa đăng nhập. Được phép tìm kiếm sản phẩm, lọc thông số kỹ thuật EAV chuyên sâu, so sánh linh kiện, **tự do sử dụng PC Builder với đầy đủ tính năng kiểm tra tương thích tức thì**, lưu tạm nhiều cấu hình trên trình duyệt (LocalStorage), xuất/nhập file `.json`, tra cứu bảo hành điện tử công khai và chat thử nghiệm với AI. |
| **2. Khách Hàng Thành Viên (Customer)** | Con người | Khách hàng đã đăng ký và xác thực tài khoản. Kế thừa toàn bộ quyền của Khách vãng lai, đồng thời có quyền: Đồng bộ cấu hình từ LocalStorage lên Cloud, chia sẻ liên kết cấu hình công khai (`share_token`), thêm vào giỏ hàng, áp mã giảm giá (Coupon), đặt hàng và thanh toán trực tuyến (COD/VNPay), quản lý đơn cá nhân, hủy đơn PENDING, thanh toán lại, gửi yêu cầu bảo hành RMA, mở Ticket hỗ trợ kỹ thuật và đánh giá sản phẩm. |
| **3. Nhân Viên Bán Hàng (Sales Staff)** | Con người | Phụ trách xử lý vòng đời đơn hàng: Tiếp nhận đơn mới, chuyển trạng thái `PROCESSING`, gán đơn vị vận chuyển, tạo mã vận đơn giao vận, xác nhận giao thành công `DELIVERED`, lưu ghi chú tư vấn; trực hàng chờ Live Chat (`chat_sessions`), tiếp nhận tư vấn khách hàng trực tuyến và gửi cấu hình PC build trực tiếp qua chat. |
| **4. Nhân Viên Kỹ Thuật (Tech Staff)** | Con người | Phụ trách xử lý chuyên môn phần cứng: Tiếp nhận hàng chờ Ticket sự cố kỹ thuật (`tickets`), trao đổi xử lý lỗi với khách, đóng ticket `RESOLVED`; quản lý cơ sở tri thức luật tương thích linh kiện (`compatibility_rules`: thêm/sửa/bật/tắt luật); tiếp nhận và thẩm định yêu cầu bảo hành RMA, xác minh hình ảnh linh kiện hỏng, cập nhật nhật ký kiểm tra `warranty_request_events`; quét gán mã vạch Serial Number xuất kho (`order_item_serials`). |
| **5. Quản Trị Viên (System Admin)** | Con người | Quản trị toàn diện hệ thống: Giám sát Dashboard điều hành (KPIs, doanh thu, tăng trưởng, cảnh báo tồn kho); quản lý tài khoản và phân quyền người dùng (`users`, `roles`); quản lý danh mục sản phẩm, biến thể SKU và giá trị thuộc tính EAV; phê duyệt các giao dịch thanh toán chuyển khoản ngân hàng thủ công; cấu hình tham số vận hành hệ thống động (`system_settings`) và giám sát an ninh qua nhật ký kiểm toán (`audit_logs`). |
| **6. AI Advisor Service (External)** | Dịch vụ ngoài | Đóng vai trò Chuyên gia tư vấn trí tuệ nhân tạo (Google Gemini LLM Engine). Tiếp nhận Prompt tiêu chí và tập Candidate Pool 32 linh kiện để phân tích, lựa chọn cấu hình tối ưu và thẩm định độc lập chất lượng bộ PC. |
| **7. Cổng Thanh Toán VNPay (External)** | Dịch vụ ngoài | Cổng thanh toán tài chính trung gian. Tiếp nhận yêu cầu khởi tạo giao dịch, cung cấp giao diện thanh toán bảo mật cho khách và gửi kết quả đối soát về máy chủ qua kênh Webhook IPN. |
| **8. Đơn Vị Giao Vận GHN/GHTK (External)** | Dịch vụ ngoài | Đối tác chuyển phát hàng hóa. Tiếp nhận thông tin tạo vận đơn từ nhân viên bán hàng và cung cấp mã tra cứu vận đơn `tracking_code`. |

---

### 2.2. Sơ đồ Use Case Toàn hệ thống (Phân rã 4 Subsystems)
Sơ đồ dưới đây biểu diễn bức tranh tổng quan phân rã chức năng của hệ thống PC Mall theo 4 phân hệ con (Subsystems), làm rõ mối quan hệ tương tác của 5 Actor và các hệ thống bên ngoài:

```mermaid
flowchart TB
    %% Actors Definition
    subgraph Human_Actors ["TÁC NHÂN CON NGƯỜI (HUMAN ACTORS)"]
        direction LR
        Guest["Khách Hàng Vãng Lai (Guest)"]
        Customer["Khách Hàng Thành Viên (Customer)"]
        Sales["Nhân Viên Bán Hàng (Sales)"]
        Tech["Nhân Viên Kỹ Thuật (Tech)"]
        Admin["Quản Trị Viên (Admin)"]
    end

    Guest <|-- Customer

    %% Subsystems Definition
    subgraph Sub1 ["PHÂN HỆ 1: SMART PC BUILDER & TRÍ TUỆ NHÂN TẠO"]
        UC_BuildManual(["UC-01: Lắp ráp PC thủ công"]):::coreUC
        UC_RuleCheck(["<<Include>> Kiểm tra tương thích tức thì (10 Rules)"]):::subUC
        UC_SaveLocal(["UC-02: Lưu tạm & Xuất/Nhập file JSON"]):::coreUC
        UC_SaveCloud(["UC-03: Lưu cấu hình đám mây & Chia sẻ Link"]):::coreUC
        UC_AISuggest(["UC-04: AI Đề xuất cấu hình (Pool 32 linh kiện)"]):::aiUC
        UC_AIAudit(["UC-05: AI Thẩm định & Gợi ý linh kiện thay thế"]):::aiUC
    end

    subgraph Sub2 ["PHÂN HỆ 2: THƯƠNG MẠI ĐIỆN TỬ, GIỎ HÀNG & THANH TOÁN"]
        UC_Catalog(["UC-06: Xem danh mục, Lọc EAV & So sánh linh kiện"]):::coreUC
        UC_Cart(["UC-07: Quản lý giỏ hàng & Nạp nguyên dàn PC"]):::coreUC
        UC_Checkout(["UC-08: Đặt hàng & Áp dụng Voucher (Coupon)"]):::coreUC
        UC_VNPay(["<<Extend>> Thanh toán trực tuyến VNPay"]):::subUC
        UC_OrderMgmt(["UC-09: Quản lý, Theo dõi & Hủy đơn hàng PENDING"]):::coreUC
        UC_ProcessOrder(["UC-10: Xử lý đơn hàng, Gán vận đơn & Giao vận"]):::staffUC
        UC_ApproveBank(["UC-11: Duyệt thanh toán chuyển khoản ngân hàng"]):::adminUC
    end

    subgraph Sub3 ["PHÂN HỆ 3: HẬU MÃI, BẢO HÀNH RMA & CSKH"]
        UC_PublicWarranty(["UC-12: Tra cứu bảo hành công khai"]):::coreUC
        UC_ActivateWarranty(["UC-13: Kích hoạt e-Warranty tự động"]):::coreUC
        UC_RequestRMA(["UC-14: Gửi yêu cầu bảo hành RMA kèm ảnh lỗi"]):::coreUC
        UC_ProcessRMA(["UC-15: Tiếp nhận, Giám định RMA & Đổi mới"]):::staffUC
        UC_AssignSerial(["UC-16: Quét gán mã Serial linh kiện xuất kho"]):::staffUC
        UC_CustomerTicket(["UC-17: Mở & Trao đổi Ticket hỗ trợ kỹ thuật"]):::coreUC
        UC_TechTicket(["UC-18: Tiếp nhận & Xử lý Ticket sự cố"]):::staffUC
        UC_LiveChatCustomer(["UC-19: Chat trực tuyến với Nhân viên CSKH"]):::coreUC
        UC_LiveChatStaff(["UC-20: Trực hàng chờ chat & Gửi cấu hình PC"]):::staffUC
    end

    subgraph Sub4 ["PHÂN HỆ 4: VẬN HÀNH, QUẢN TRỊ & HỆ CHUYÊN GIA"]
        UC_ManageRules(["UC-21: Quản trị tập luật tương thích (Knowledge Base)"]):::staffUC
        UC_ManageCatalog(["UC-22: Quản lý Sản phẩm, Biến thể SKU & Thuộc tính EAV"]):::adminUC
        UC_ManageUsers(["UC-23: Quản lý Người dùng & Khóa/Mở tài khoản"]):::adminUC
        UC_SystemSettings(["UC-24: Cấu hình tham số hệ thống & Xem Audit Log"]):::adminUC
        UC_AdminDashboard(["UC-25: Dashboard giám sát KPI & Cảnh báo tồn kho"]):::adminUC
    end

    subgraph External_Actors ["HỆ THỐNG NGOÀI (EXTERNAL SERVICES)"]
        direction LR
        ExtAI["AI Advisor Service (Gemini)"]
        ExtVNPay["Cổng VNPay Gateway"]
        ExtGHN["Đơn Vị Giao Vận (GHN/GHTK)"]
    end

    %% Actor Connections
    Guest --> UC_Catalog
    Guest --> UC_BuildManual
    Guest --> UC_SaveLocal
    Guest --> UC_PublicWarranty
    Guest --> UC_AISuggest
    Guest --> UC_AIAudit

    Customer --> UC_SaveCloud
    Customer --> UC_Cart
    Customer --> UC_Checkout
    Customer --> UC_OrderMgmt
    Customer --> UC_RequestRMA
    Customer --> UC_CustomerTicket
    Customer --> UC_LiveChatCustomer

    Sales --> UC_ProcessOrder
    Sales --> UC_LiveChatStaff

    Tech --> UC_TechTicket
    Tech --> UC_ProcessRMA
    Tech --> UC_AssignSerial
    Tech --> UC_ManageRules

    Admin --> UC_ManageCatalog
    Admin --> UC_ManageUsers
    Admin --> UC_ApproveBank
    Admin --> UC_SystemSettings
    Admin --> UC_AdminDashboard
    Admin --> UC_ManageRules

    %% Relations between UCs
    UC_BuildManual -.->|<<include>>| UC_RuleCheck
    UC_Checkout -.->|<<extend>>| UC_VNPay

    %% External Connections
    UC_AISuggest --- ExtAI
    UC_AIAudit --- ExtAI
    UC_VNPay --- ExtVNPay
    UC_ProcessOrder --- ExtGHN

    classDef coreUC fill:#e0f2fe,stroke:#0284c7,stroke-width:1.5px,color:#0f172a;
    classDef subUC fill:#f1f5f9,stroke:#64748b,stroke-width:1px,stroke-dasharray: 4 2,color:#334155;
    classDef aiUC fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f;
    classDef staffUC fill:#dcfce7,stroke:#16a34a,stroke-width:1.5px,color:#14532d;
    classDef adminUC fill:#fee2e2,stroke:#dc2626,stroke-width:1.5px,color:#7f1d1d;
```

---

### 2.3. Sơ đồ Use Case Chi tiết cho từng Actor

#### 2.3.1. Phân hệ Use Case: Khách Hàng Vãng Lai (Guest)
Khách hàng vãng lai là đối tượng tiềm năng lớn nhất. Hệ thống tạo điều kiện tối đa để khách trải nghiệm các công nghệ cốt lõi của website mà không yêu cầu rào cản đăng nhập.

```mermaid
flowchart LR
    ActorGuest["fa:fa-user Khách Hàng Vãng Lai (Guest)"]

    subgraph Guest_Boundary ["Phân Vùng Chức Năng Khách Vãng Lai"]
        UC_G01(["Xem danh mục & Lọc thông số EAV chuyên sâu"])
        UC_G02(["Xem chi tiết & So sánh tối đa 4 sản phẩm"])
        UC_G03(["Lắp ráp PC thủ công (7-8 nhóm linh kiện)"])
        UC_G03A(["<<Include>> Tự động kiểm tra tương thích tức thì"]):::dashUC
        UC_G04(["Lưu tạm cấu hình trên LocalStorage trình duyệt"])
        UC_G05(["Xuất / Nhập cấu hình bằng file .json"])
        UC_G06(["AI Đề xuất cấu hình từ Pool 32 linh kiện"])
        UC_G07(["AI Thẩm định cấu hình & Gợi ý linh kiện thay thế"])
        UC_G08(["Tra cứu hạn bảo hành điện tử theo Serial"])
        UC_G09(["Đăng ký tài khoản thành viên (Register)"])
    end

    ActorGuest --> UC_G01
    ActorGuest --> UC_G02
    ActorGuest --> UC_G03
    ActorGuest --> UC_G04
    ActorGuest --> UC_G05
    ActorGuest --> UC_G06
    ActorGuest --> UC_G07
    ActorGuest --> UC_G08
    ActorGuest --> UC_G09

    UC_G03 -.-> UC_G03A

    classDef dashUC fill:#f8fafc,stroke:#64748b,stroke-dasharray: 4 2;
```

#### 2.3.2. Phân hệ Use Case: Khách Hàng Thành Viên (Member Customer)
Khách hàng thành viên kế thừa toàn bộ chức năng của Khách vãng lai, được mở rộng các tiện ích cá nhân hóa, giao dịch thương mại và dịch vụ sau bán hàng (RMA/Ticket).

```mermaid
flowchart LR
    ActorCustomer["fa:fa-user-check Khách Hàng Thành Viên (Customer)"]

    subgraph Customer_Boundary ["Phân Vùng Chức Năng Thành Viên"]
        UC_C01(["Đồng bộ cấu hình từ LocalStorage lên Cloud"])
        UC_C02(["Lưu nhiều cấu hình cá nhân & Tạo mã Share Link"])
        UC_C03(["Quản lý sổ địa chỉ giao hàng"])
        UC_C04(["Quản lý giỏ hàng & Nạp nguyên dàn PC vào Giỏ"])
        UC_C05(["Đặt hàng & Áp mã Voucher chiết khấu"])
        UC_C05A(["<<Extend>> Thanh toán trực tuyến VNPay"]):::dashUC
        UC_C06(["Theo dõi hành trình đơn & Timeline vận chuyển"])
        UC_C07(["Hủy đơn hàng (Áp dụng khi trạng thái PENDING)"])
        UC_C08(["Thanh toán lại đơn hàng chưa thanh toán"])
        UC_C09(["Đánh giá sản phẩm kèm nhãn Đã Mua Hàng"])
        UC_C10(["Gửi yêu cầu bảo hành RMA kèm hình ảnh lỗi"])
        UC_C11(["Tạo Ticket hỗ trợ & Nhắn tin trao đổi sự cố"])
        UC_C12(["Chat trực tuyến thời gian thực với Nhân viên CSKH"])
    end

    ActorCustomer --> UC_C01
    ActorCustomer --> UC_C02
    ActorCustomer --> UC_C03
    ActorCustomer --> UC_C04
    ActorCustomer --> UC_C05
    ActorCustomer --> UC_C06
    ActorCustomer --> UC_C07
    ActorCustomer --> UC_C08
    ActorCustomer --> UC_C09
    ActorCustomer --> UC_C10
    ActorCustomer --> UC_C11
    ActorCustomer --> UC_C12

    UC_C05 -.-> UC_C05A

    classDef dashUC fill:#f8fafc,stroke:#64748b,stroke-dasharray: 4 2;
```

#### 2.3.3. Phân hệ Use Case: Nhân Viên Bán Hàng (Sales Staff)
Nhân viên bán hàng chịu trách nhiệm vận hành luồng đơn hàng thương mại và tiếp nhận các yêu cầu tư vấn bán hàng trực tiếp.

```mermaid
flowchart LR
    ActorSales["fa:fa-headset Nhân Viên Bán Hàng (Sales Staff)"]

    subgraph Sales_Boundary ["Phân Vùng Chức Năng Bán Hàng & CSKH"]
        UC_S01(["Duyệt danh sách & Lọc đơn hàng theo trạng thái"])
        UC_S02(["Tiếp nhận & Chuyển trạng thái đơn PROCESSING"])
        UC_S03(["Chọn đơn vị vận chuyển (GHN/GHTK) & Tạo mã vận đơn"])
        UC_S04(["Cập nhật tiến độ giao vận SHIPPED -> DELIVERED"])
        UC_S05(["Ghi chú nhật ký tư vấn đơn hàng"])
        UC_S06(["Hủy đơn hàng có lý do nghiệp vụ"])
        UC_S07(["Trực hàng chờ Live Chat & Tiếp nhận phiên chat"])
        UC_S08(["Gửi tin nhắn mẫu / Gửi cấu hình PC trực tiếp qua Chat"])
        UC_S09(["Liên kết phiên Chat với Đơn hàng cụ thể"])
        UC_S10(["Kết thúc phiên tư vấn Live Chat"])
    end

    ActorSales --> UC_S01
    ActorSales --> UC_S02
    ActorSales --> UC_S03
    ActorSales --> UC_S04
    ActorSales --> UC_S05
    ActorSales --> UC_S06
    ActorSales --> UC_S07
    ActorSales --> UC_S08
    ActorSales --> UC_S09
    ActorSales --> UC_S10
```

#### 2.3.4. Phân hệ Use Case: Nhân Viên Kỹ Thuật (Technical Staff)
Nhân viên kỹ thuật xử lý các tác vụ chuyên môn sâu về phần cứng: khắc phục sự cố, bảo hành đổi trả, quản lý tập luật tương thích và giám sát xuất kho linh kiện chính hãng theo số Serial.

```mermaid
flowchart LR
    ActorTech["fa:fa-wrench Nhân Viên Kỹ Thuật (Tech Staff)"]

    subgraph Tech_Boundary ["Phân Vùng Kỹ Thuật & Bảo Hành RMA"]
        UC_T01(["Xem Dashboard hàng chờ Ticket & Chỉ số kỹ thuật"])
        UC_T02(["Tiếp nhận Ticket sự cố chuyển sang IN_PROGRESS"])
        UC_T03(["Gửi tin nhắn hướng dẫn kỹ thuật / Ghi chú nội bộ"])
        UC_T04(["Đánh dấu sự cố Đã Giải Quyết (RESOLVED) & Đóng Ticket"])
        UC_T05(["Quét barcode gán mã Serial linh kiện xuất kho"])
        UC_T06(["Tra cứu & Giám định hồ sơ bảo hành RMA"])
        UC_T07(["Cập nhật Timeline sự kiện kiểm tra kỹ thuật (Events)"])
        UC_T08(["Phê duyệt đổi mới / Từ chối yêu cầu bảo hành"])
        UC_T09(["Quản trị tập luật tương thích PC Builder (Thêm/Sửa/Bật/Tắt)"])
    end

    ActorTech --> UC_T01
    ActorTech --> UC_T02
    ActorTech --> UC_T03
    ActorTech --> UC_T04
    ActorTech --> UC_T05
    ActorTech --> UC_T06
    ActorTech --> UC_T07
    ActorTech --> UC_T08
    ActorTech --> UC_T09
```

#### 2.3.5. Phân hệ Use Case: Quản Trị Viên (System Admin)
Quản trị viên nắm toàn quyền điều hành hệ thống, giám sát vận hành kinh doanh, an ninh bảo mật và cấu hình môi trường.

```mermaid
flowchart LR
    ActorAdmin["fa:fa-user-shield Quản Trị Viên (System Admin)"]

    subgraph Admin_Boundary ["Phân Vùng Quản Trị Hệ Thống"]
        UC_A01(["Xem Dashboard điều hành (KPIs, Doanh thu, Tồn kho)"])
        UC_A02(["Quản lý Sản phẩm Master (Thêm, Sửa, Bật/Tắt)"])
        UC_A03(["Quản lý Biến thể SKU (Giá bán, Tồn kho, Mã vạch)"])
        UC_A04(["Quản lý Loại thuộc tính & Giá trị thông số EAV"])
        UC_A05(["Quản lý Tập luật tương thích hệ chuyên gia"])
        UC_A06(["Quản lý Tài khoản người dùng (Tìm kiếm, Khóa/Mở)"])
        UC_A07(["Phê duyệt thanh toán chuyển khoản ngân hàng thủ công"])
        UC_A08(["Cấu hình tham số hệ thống (Tên shop, Phí ship, Chế độ bảo trì)"])
        UC_A09(["Giám sát an ninh qua Nhật ký kiểm toán (Audit Logs)"])
    end

    ActorAdmin --> UC_A01
    ActorAdmin --> UC_A02
    ActorAdmin --> UC_A03
    ActorAdmin --> UC_A04
    ActorAdmin --> UC_A05
    ActorAdmin --> UC_A06
    ActorAdmin --> UC_A07
    ActorAdmin --> UC_A08
    ActorAdmin --> UC_A09
```

---

### 2.4. Bảng Tổng hợp Danh mục Use Case Toàn Hệ Thống

| Mã Use Case | Tên Use Case | Tác nhân chính (Actors) | Phân hệ (Subsystem) | Mức ưu tiên |
| :---: | :--- | :--- | :--- | :---: |
| `UC-01` | Lắp ráp PC thủ công & Kiểm tra tương thích tức thì | Guest, Customer | PC Builder & AI | 🔴 Bắt buộc |
| `UC-02` | Lưu tạm & Xuất/Nhập file JSON cấu hình | Guest, Customer | PC Builder & AI | 🔴 Bắt buộc |
| `UC-03` | Lưu cấu hình Cloud & Tạo liên kết chia sẻ công khai | Customer | PC Builder & AI | 🟡 Quan trọng |
| `UC-04` | AI Đề xuất cấu hình tối ưu từ Candidate Pool 32 | Guest, Customer, AI Service | PC Builder & AI | 🔴 Bắt buộc |
| `UC-05` | AI Thẩm định độc lập & Gợi ý linh kiện thay thế | Guest, Customer, AI Service | PC Builder & AI | 🔴 Bắt buộc |
| `UC-06` | Tra cứu danh mục, Lọc thông số EAV & So sánh | Guest, Customer | E-Commerce | 🔴 Bắt buộc |
| `UC-07` | Quản lý giỏ hàng & Nạp nguyên dàn PC vào Giỏ | Customer | E-Commerce | 🔴 Bắt buộc |
| `UC-08` | Đặt hàng & Áp dụng Voucher (Coupon) | Customer | E-Commerce | 🔴 Bắt buộc |
| `UC-09` | Thanh toán trực tuyến qua cổng VNPay Sandbox | Customer, VNPay Gateway | E-Commerce | 🔴 Bắt buộc |
| `UC-10` | Quản lý lịch sử, Theo dõi & Hủy đơn hàng PENDING | Customer | E-Commerce | 🟡 Quan trọng |
| `UC-11` | Đánh giá & Nhận xét sản phẩm (Verified Buyer) | Customer | E-Commerce | 🟢 Mở rộng |
| `UC-12` | Tiếp nhận đơn, Tạo vận đơn & Cập nhật giao vận | Sales Staff, Đơn vị GHN | E-Commerce & Staff | 🔴 Bắt buộc |
| `UC-13` | Quản lý hàng chờ Live Chat & Tư vấn cấu hình PC | Sales Staff, Customer | CSKH & Live Chat | 🟡 Quan trọng |
| `UC-14` | Quét gán mã Serial linh kiện khi xuất kho | Tech Staff | Kho & Serial | 🔴 Bắt buộc |
| `UC-15` | Tra cứu hạn bảo hành điện tử công khai theo Serial | Guest, Customer | Bảo hành & RMA | 🔴 Bắt buộc |
| `UC-16` | Gửi yêu cầu bảo hành RMA kèm hình ảnh sự cố | Customer | Bảo hành & RMA | 🔴 Bắt buộc |
| `UC-17` | Tiếp nhận, Giám định kỹ thuật & Đổi mới RMA | Tech Staff | Bảo hành & RMA | 🔴 Bắt buộc |
| `UC-18` | Mở & Trao đổi Ticket hỗ trợ kỹ thuật chuyên sâu | Customer, Tech Staff | Hỗ trợ Kỹ thuật | 🟡 Quan trọng |
| `UC-19` | Tiếp nhận & Đóng Ticket sự cố kỹ thuật | Tech Staff | Hỗ trợ Kỹ thuật | 🟡 Quan trọng |
| `UC-20` | Quản lý tập luật tương thích (Knowledge Base) | Tech Staff, Admin | Hệ Chuyên Gia | 🔴 Bắt buộc |
| `UC-21` | Quản lý Sản phẩm, Biến thể SKU & Tồn kho | Admin | Quản trị Doanh nghiệp | 🔴 Bắt buộc |
| `UC-22` | Quản lý Loại thuộc tính & Giá trị thông số EAV | Admin | Quản trị Doanh nghiệp | 🔴 Bắt buộc |
| `UC-23` | Quản lý Tài khoản người dùng & Phân quyền | Admin | Quản trị Doanh nghiệp | 🟡 Quan trọng |
| `UC-24` | Phê duyệt thanh toán chuyển khoản thủ công | Admin | Quản trị Doanh nghiệp | 🟡 Quan trọng |
| `UC-25` | Cấu hình tham số hệ thống & Xem Audit Log | Admin | Quản trị Doanh nghiệp | 🟡 Quan trọng |
| `UC-26` | Dashboard giám sát KPI & Báo cáo doanh thu | Admin | Quản trị Doanh nghiệp | 🟡 Quan trọng |

---

### 2.5. Đặc tả Chi tiết các Use Case Trọng tâm Công nghệ (Use Case Specifications)

#### Đặc tả 1: `UC-BUILD-01` - Lắp ráp PC thủ công & Kiểm tra tương thích tức thì
- **Mã Use Case**: `UC-BUILD-01`
- **Tên Use Case**: Lắp ráp cấu hình PC thủ công & Kiểm tra tương thích tức thì
- **Tác nhân**: Khách Hàng Vãng Lai (Guest), Khách Hàng Thành Viên (Customer)
- **Mục đích**: Cho phép người dùng tự do lựa chọn các linh kiện từ kho hàng thật và được hệ thống phân tích, cảnh báo xung đột phần cứng theo thời gian thực.
- **Tiền điều kiện (Pre-condition)**: Người dùng truy cập vào trang `/pc-builder`.
- **Hậu điều kiện (Post-condition)**: Cấu hình được cập nhật trên bàn lắp ráp; nhãn cảnh báo (Tương thích / Cảnh báo / Xung đột nghiêm trọng) được hiển thị chính xác.
- **Luồng sự kiện chính (Main Flow)**:
  1. Người dùng mở trang PC Builder, giao diện hiển thị 8 khe cắm linh kiện chuẩn: CPU, Bo mạch chủ, RAM, Card đồ họa, Ổ cứng, Nguồn máy tính, Vỏ Case, Tản nhiệt.
  2. Người dùng nhấp "Chọn linh kiện" tại một vị trí (ví dụ: CPU). Modal danh sách linh kiện hiện lên kèm bộ lọc thông số kỹ thuật (Socket, Thương hiệu, Phân khúc).
  3. Người dùng chọn 1 linh kiện ưng ý $ightarrow$ Hệ thống nạp linh kiện vào bàn lắp ráp.
  4. Engine kiểm tra tương thích (`calculateBuilderInsights.js` ở Client và `pc-builder.service.ts` ở Server) tự động kích hoạt:
     - So khớp Socket CPU với Bo mạch chủ.
     - So khớp chuẩn DDR4/DDR5 của RAM với khe cắm trên Bo mạch chủ.
     - So sánh chiều dài VGA với khoảng trống tối đa của Vỏ Case (`gpu_length <= case_gpu_clearance`).
     - So sánh chiều cao tản khí / kích thước Radiator nước với thông số hỗ trợ của Vỏ Case.
     - Tính tổng công suất tiêu thụ tối đa (Peak TDP) và đánh giá độ an toàn của bộ nguồn PSU (`psu_wattage >= total_power * 1.2`).
  5. Hệ thống hiển thị điểm đánh giá tổng thể (Build Score /100), tổng giá trị đơn hàng (VNĐ) và thanh công suất nguồn PSU.
  6. Nếu tất cả luật đều vượt qua: Hiển thị huy hiệu xanh `✅ Tương thích 100%`.
- **Luồng rẽ nhánh / Ngoại lệ (Alternative / Exception Flows)**:
  - *A1. Phát hiện xung đột nghiêm trọng (Blocker)*: Nếu CPU Socket LGA1700 đi cùng Mainboard AM5 $ightarrow$ Hệ thống hiển thị cảnh báo đỏ `🔴 Xung Đột Socket: CPU LGA1700 không thể lắp trên bo mạch chủ Socket AM5`. Nút "Thêm vào giỏ hàng" bị vô hiệu hóa kèm thông điệp hướng dẫn đổi linh kiện phù hợp.
  - *A2. Phát hiện nguy cơ cảnh báo (Warning)*: Nguồn PSU 500W nhưng dàn máy tiêu thụ 480W $ightarrow$ Hệ thống hiển thị cảnh báo vàng `⚠️ Cảnh Báo Thiếu Nguồn: Biên độ dự phòng an toàn < 20%, khuyến nghị nâng cấp PSU lên tối thiểu 650W`. Người dùng vẫn được phép tiếp tục nếu chấp nhận rủi ro.

---

#### Đặc tả 2: `UC-AI-01` - Đề xuất cấu hình PC thông minh từ Candidate Pool 32 linh kiện
- **Mã Use Case**: `UC-AI-01`
- **Tên Use Case**: Đề xuất cấu hình PC thông minh từ Candidate Pool 32 linh kiện
- **Tác nhân**: Khách Hàng Vãng Lai, Khách Hàng Thành Viên, AI Advisor Service (Google Gemini)
- **Mục đích**: Tự động hóa hoàn toàn việc lựa chọn cấu hình máy tính cân đối tối ưu dựa trên ngân sách và mục tiêu sử dụng cụ thể của khách hàng.
- **Tiền điều kiện (Pre-condition)**: Cơ sở dữ liệu kho hàng có tối thiểu 4 sản phẩm còn hàng (`stock > 0`) cho mỗi danh mục linh kiện.
- **Hậu điều kiện (Post-condition)**: Một bộ cấu hình hoàn chỉnh 8 món được sinh ra và nạp trực tiếp vào giao diện PC Builder.
- **Luồng sự kiện chính (Main Flow)**:
  1. Người dùng bấm nút "AI Cố Vấn Cấu Hình" tại trang PC Builder.
  2. Modal tiêu chí hiện lên, người dùng chọn các thông số:
     - Ngân sách dự kiến (ví dụ: 25.000.000 VNĐ).
     - Nhu cầu chính: Gaming AAA / Esports / Đồ họa 3D / Lập trình AI / Văn phòng.
     - Độ phân giải màn hình hướng tới: 1080p Full HD, 1440p 2K hoặc 4K.
     - Phong cách thẩm mỹ: Tone Đen huyền bí / Tone Trắng Gaming / Tản nhiệt nước AIO RGB.
  3. Người dùng nhấp "Bắt đầu phân tích & Đề xuất".
  4. Backend lọc từ cơ sở dữ liệu MySQL ra **Candidate Pool gồm 32 linh kiện tốt nhất** (4 linh kiện tiêu biểu có điểm benchmark cao nhất cho từng nhóm linh kiện).
  5. Backend đóng gói danh sách 32 linh kiện kèm các ràng buộc kỹ thuật nghiêm ngặt vào System Prompt và gọi API Google Gemini (`gemini-2.5-flash-lite`).
  6. Server truyền phát trực tiếp (Streaming SSE) bài phân tích lý do chọn lựa của AI về giao diện theo thời gian thực.
  7. Khi hoàn tất, hệ thống trả về JSON danh sách 8 linh kiện được chọn, tự động tính toán kiến trúc RAM kênh đôi Dual-Channel (ví dụ: 2 thanh 16GB thay vì 1 thanh 32GB).
  8. Người dùng xem bảng tổng kết, điểm thẩm định và bấm "Áp Dụng Vào Dàn Máy" để chuyển sang bàn lắp ráp.
- **Luồng ngoại lệ (Exception Flows)**:
  - *E1. Ngân sách quá thấp không thể build dàn máy đồng bộ*: Nếu người dùng nhập ngân sách 5.000.000 VNĐ nhưng đòi hỏi Gaming 4K $ightarrow$ AI phân tích giải thích thực tế và đưa ra cấu hình khả thi nhất trong tầm giá (APU tích hợp đồ họa) kèm lời khuyên nâng cấp sau này.

---

#### Đặc tả 3: `UC-ORDER-01` - Đặt hàng, Áp dụng Voucher & Thanh toán Điện tử VNPay
- **Mã Use Case**: `UC-ORDER-01`
- **Tên Use Case**: Đặt hàng, Áp dụng Voucher chiết khấu & Thanh toán điện tử VNPay
- **Tác nhân**: Khách Hàng Thành Viên (Customer), Cổng Thanh Toán VNPay Gateway
- **Mục đích**: Chuyển đổi các linh kiện trong giỏ hàng hoặc dàn PC thành đơn đặt hàng chính thức, xử lý giảm giá và bảo đảm an toàn thanh toán trực tuyến.
- **Tiền điều kiện (Pre-condition)**: Người dùng đã đăng nhập, giỏ hàng có ít nhất 1 sản phẩm còn tồn kho.
- **Hậu điều kiện (Post-condition)**: Đơn hàng được tạo thành công với trạng thái `PENDING` (nếu COD) hoặc `PROCESSING` (nếu VNPay thành công); tồn kho được trừ nguyên tử.
- **Luồng sự kiện chính (Main Flow)**:
  1. Người dùng bấm "Tiến hành thanh toán" từ trang Giỏ hàng `/cart` $ightarrow$ Điều hướng sang trang Checkout `/checkout`.
  2. Người dùng chọn địa chỉ nhận hàng từ sổ địa chỉ có sẵn hoặc nhập địa chỉ mới.
  3. Người dùng nhập mã giảm giá (ví dụ: `GIAM500K`) $ightarrow$ Hệ thống kiểm tra điều kiện áp dụng (`coupons`: thời hạn, đơn tối thiểu, số lượt còn lại) $ightarrow$ Khấu trừ trực tiếp vào tổng tiền thanh toán `final_amount`.
  4. Người dùng chọn phương thức "Thanh toán qua VNPAY (Thẻ ATM / QR Pay)".
  5. Người dùng bấm "Xác nhận đặt hàng".
  6. Backend khởi tạo bản ghi `orders` (trạng thái `PENDING`), tạo bản ghi `payments` (trạng thái `PENDING_GATEWAY`).
  7. Backend sinh URL thanh toán VNPay có gắn mã kiểm tra toàn vẹn dữ liệu (Secure Hash SHA-512) và chuyển hướng trình duyệt của khách sang Cổng VNPay.
  8. Khách hàng thực hiện quét mã VNPAY-QR hoặc nhập thông tin thẻ ngân hàng và xác thực mã OTP.
  9. Sau khi trừ tiền thành công, Cổng VNPay gửi tín hiệu xác nhận tức thì (Instant Payment Notification - IPN Webhook) qua kết nối Server-to-Server về Backend API.
  10. Backend kiểm tra chữ ký số SHA-512 hợp lệ $ightarrow$ Mở Transaction CSDL: Cập nhật `orders.payment_status = 'PAID'`, `orders.status = 'PROCESSING'`, ghi nhận `coupon_usages` và thực hiện **Atomic Conditional Decrement** trừ tồn kho linh kiện.
  11. Trình duyệt khách hàng được chuyển hướng về trang `/payment/result` hiển thị thông báo thành công kèm mã tra cứu đơn hàng.

---

<a name="phần-3-sơ-đồ-hoạt-động-activity-diagrams"></a>
## PHẦN 3: SƠ ĐỒ HOẠT ĐỘNG (ACTIVITY DIAGRAMS)

### 3.1. Sơ đồ Hoạt động 1: Luồng Build PC & Xử lý Tập luật Tương thích (Knowledge-Based Expert Engine)
Sơ đồ mô tả chi tiết tiến trình kiểm tra tương thích đa linh kiện theo thời gian thực mỗi khi người dùng thao tác chọn hoặc hoán đổi bất kỳ linh kiện nào trên bàn lắp ráp:

```mermaid
flowchart TD
    Start([Bắt đầu: Khách chọn hoặc đổi linh kiện trên bàn Build]) --> Step_Fetch[Hệ thống nạp thông số kỹ thuật EAV của linh kiện mới vào State]
    Step_Fetch --> Check_CPU_MB{"Đã có đủ CPU và Bo Mạch Chủ?"}

    %% RULE 1: CPU vs MAINBOARD
    Check_CPU_MB -- Có --> Rule1_Socket["Kiểm tra COMP-001: Socket CPU == Socket Mainboard"]
    Rule1_Socket --> Eval1{"Khớp Socket?"}
    Eval1 -- Không khớp --> Blocker1["Tạo lỗi BLOCKER: Xung đột chuẩn chân cắm Socket"]
    Eval1 -- Trùng khớp --> Check_RAM{"Đã có RAM và Bo Mạch Chủ?"}
    Check_CPU_MB -- Chưa đủ --> Check_RAM

    %% RULE 2: RAM vs MAINBOARD
    Check_RAM -- Có --> Rule2_RAM["Kiểm tra COMP-002: Chuẩn DDR4 / DDR5 & Số khe cắm"]
    Rule2_RAM --> Eval2{"Hợp lệ chuẩn RAM?"}
    Eval2 -- Sai thế hệ DDR --> Blocker2["Tạo lỗi BLOCKER: Chuẩn RAM không khớp khe cắm Mainboard"]
    Eval2 -- Vượt quá số khe --> Blocker2B["Tạo lỗi BLOCKER: Số thanh RAM vượt quá số khe cắm vật lý"]
    Eval2 -- Hợp lệ --> Check_VGA_Case{"Đã có Card đồ họa và Vỏ Case?"}
    Check_RAM -- Chưa đủ --> Check_VGA_Case

    %% RULE 3: GPU vs CASE
    Check_VGA_Case -- Có --> Rule3_GPU["Kiểm tra COMP-004: gpu_length <= case_gpu_clearance"]
    Rule3_GPU --> Eval3{"Card vừa khoang Case?"}
    Eval3 -- Dài hơn khoang --> Blocker3["Tạo lỗi BLOCKER: Kích thước VGA vượt quá giới hạn vỏ Case"]
    Eval3 -- Vừa vặn --> Check_Cooler{"Đã chọn Tản nhiệt?"}
    Check_VGA_Case -- Chưa đủ --> Check_Cooler

    %% RULE 4: COOLER vs CPU & CASE
    Check_Cooler -- Có --> Rule4_Cooler["Kiểm tra COMP-005/006: Chiều cao tản khí / Rad nước vs Case & TDP"]
    Rule4_Cooler --> Eval4{"Tản nhiệt lắp vừa và đủ mát?"}
    Eval4 -- Cấn nắp case / Thiếu rad --> Blocker4["Tạo lỗi BLOCKER: Chiều cao tản cấn nắp hông case hoặc rad quá lớn"]
    Eval4 -- Đạt chuẩn --> Check_Power["Tính toán tổng công suất hệ thống (Total Peak TDP)"]
    Check_Cooler -- Chưa --> Check_Power

    %% RULE 5: POWER SUPPLY (PSU)
    Check_Power --> Rule5_PSU["Kiểm tra COMP-007: So sánh công suất Nguồn PSU đã chọn vs Total TDP"]
    Rule5_PSU --> Eval5{"Đánh giá mức tải nguồn"}
    Eval5 -- "psu_watt < total_tdp" --> Blocker5["Tạo lỗi BLOCKER: Nguồn không đủ tải, nguy cơ sập máy"]
    Eval5 -- "Dự phòng < 20%" --> Warn5["Tạo cảnh báo WARNING: Nguồn chạy tải cao, khuyến nghị tăng công suất"]
    Eval5 -- "Dự phòng >= 20%" --> OK5["Nguồn đạt chuẩn an toàn lý tưởng"]

    %% MERGE EVALUATION
    Blocker1 --> Aggregate[Tổng hợp kết quả đánh giá]
    Blocker2 --> Aggregate
    Blocker2B --> Aggregate
    Blocker3 --> Aggregate
    Blocker4 --> Aggregate
    Blocker5 --> Aggregate
    Warn5 --> Aggregate
    OK5 --> Aggregate

    Aggregate --> FinalDecision{"Có lỗi BLOCKER nào không?"}
    FinalDecision -- Có --> State_Incompatible["Hiển thị Huy hiệu Đỏ 'Xung đột phần cứng'
Khóa nút Đặt hàng
Đưa ra gợi ý thay thế sửa lỗi"]
    FinalDecision -- Không có lỗi Blocker --> Check_Warning{"Có cảnh báo WARNING không?"}
    Check_Warning -- Có --> State_Warning["Hiển thị Huy hiệu Vàng 'Tương thích có lưu ý'
Mở nút Đặt hàng kèm cảnh báo"]
    Check_Warning -- Không --> State_Compatible["Hiển thị Huy hiệu Xanh 'Tương thích 100%'
Mở đầy đủ chức năng Đặt hàng & Lưu trữ"]

    State_Incompatible --> End([Kết thúc chu kỳ đánh giá])
    State_Warning --> End
    State_Compatible --> End
```

---

### 3.2. Sơ đồ Hoạt động 2: Luồng Tư vấn Cấu hình Trí tuệ Nhân tạo (AI Advisor & Recommendation Engine)
Tiến trình kết hợp chặt chẽ giữa lọc dữ liệu thô từ cơ sở dữ liệu kho hàng (Data Grounding) và suy luận logic đa tiêu chí của Google Gemini LLM:

```mermaid
flowchart TD
    Start_AI([Khách mở Wizard Tư Vấn Cấu Hình AI]) --> Step_Input[Khách nhập Tiêu chí: Ngân sách, Nhu cầu gaming/work, Độ phân giải, Tone màu]
    Step_Input --> Validate_Budget{"Ngân sách có >= 7.000.000 VNĐ?"}
    
    Validate_Budget -- Không --> Error_Budget[Thông báo lỗi: Ngân sách tối thiểu để dựng PC hoàn chỉnh là 7 triệu VNĐ]
    Error_Budget --> Step_Input

    Validate_Budget -- Hợp lệ --> Query_Pool[Backend truy vấn MySQL: Lọc 32 ứng viên linh kiện khả dụng nhất từ 8 danh mục]
    Query_Pool --> Build_Prompt[Lập System Prompt: Gắn danh sách 32 linh kiện + Yêu cầu RAM Dual-channel + Ràng buộc ngân sách]
    Build_Prompt --> Call_Gemini[Gửi Request Streaming tới Google Gemini 3.5 Flash-Lite API]

    subgraph LLM_Streaming ["Xử Lý Streaming Thời Gian Thực"]
        Call_Gemini --> Stream_Receive[Nhận các mẩu văn bản phân tích dạng Server-Sent Events - SSE]
        Stream_Receive --> Render_UI[Hiển thị bài phân tích giải trình của AI trực tiếp trên màn hình khách]
        Render_UI --> Check_Finish{"Đã nhận xong toàn bộ phản hồi?"}
        Check_Finish -- Chưa --> Stream_Receive
    end

    Check_Finish -- Hoàn tất --> Parse_JSON[Trích xuất khối cấu trúc JSON 8 mã linh kiện SKU được AI lựa chọn]
    Parse_JSON --> Verify_DB[Kiểm tra chéo lại giá bán và trạng thái tồn kho thực tế trong MySQL]
    Verify_DB --> RAM_Dual[Tính toán tự động: Nhân đôi số thanh RAM nếu linh kiện là dạng đơn chiếc]
    RAM_Dual --> Calc_Bottleneck[Chạy thuật toán Heuristic: Đo mức nghẽn cổ chai CPU/GPU và tính điểm Build Score /100]
    
    Calc_Bottleneck --> Show_Modal[Hiển thị Bảng tóm tắt Dàn Máy Hoàn Chỉnh: Danh sách 8 món, Điểm số, Tổng tiền]
    Show_Modal --> User_Action{"Khách hàng quyết định"}
    
    User_Action -- "Áp Dụng Vào Cấu Hình" --> Load_Builder[Đồng bộ toàn bộ 8 linh kiện vào Bàn lắp ráp PC Builder]
    User_Action -- "Hỏi Thêm Về Cấu Hình" --> Open_AIChat[Chuyển sang giao diện Chatbot chuyên sâu đính kèm Context dàn máy này]
    User_Action -- "Làm Lại" --> Step_Input

    Load_Builder --> End_AI([Hoàn tất quy trình tư vấn AI])
    Open_AIChat --> End_AI
```

---

### 3.3. Sơ đồ Hoạt động 3: Luồng Đặt hàng, Áp dụng Voucher & Thanh toán Cổng VNPay
Mô tả quy trình xử lý thanh toán đa kênh (COD / VNPay), kiểm tra điều kiện mã giảm giá và đảm bảo tính toàn vẹn kho hàng bằng giao dịch nguyên tử (Atomic Transaction):

```mermaid
flowchart TD
    Start_Order([Khách hàng tiến hành Checkout đơn hàng]) --> Step_Address[Chọn địa chỉ giao hàng và kiểm tra danh sách mặt hàng]
    Step_Address --> Input_Coupon{"Khách có nhập mã giảm giá?"}

    Input_Coupon -- Có --> Validate_Coupon[Backend kiểm tra bảng coupons: Ngày hiệu lực, Giá trị đơn tối thiểu, Giới hạn sử dụng]
    Validate_Coupon --> Coupon_Result{"Mã hợp lệ?"}
    Coupon_Result -- Không hợp lệ --> Show_Coupon_Error[Hiển thị lý do từ chối: Mã hết hạn, không đủ giá trị tối thiểu...]
    Show_Coupon_Error --> Select_Payment
    Coupon_Result -- Hợp lệ --> Apply_Discount[Tính số tiền chiết khấu & Khấu trừ vào final_amount]
    Apply_Discount --> Select_Payment

    Input_Coupon -- Không --> Select_Payment[Khách chọn phương thức thanh toán: COD hoặc VNPAY]

    Select_Payment --> Check_Method{"Phương thức là?"}

    %% NHÁNH COD
    Check_Method -- "COD (Tiền mặt)" --> Tx_COD[Bắt đầu Database Transaction: Tạo đơn hàng PENDING + Trừ kho nguyên tử]
    Tx_COD --> Stock_Check1{"Tồn kho đủ?"}
    Stock_Check1 -- Hết hàng --> Rollback1[Rollback Transaction & Báo lỗi sản phẩm đã hết hàng]
    Stock_Check1 -- Đủ hàng --> Commit_COD[Commit Transaction & Tạo thông báo đặt hàng thành công]
    Commit_COD --> Success_COD[Hiển thị trang hoàn tất đơn hàng & Hướng dẫn chờ giao hàng]
    Success_COD --> End_Order([Kết thúc luồng đặt hàng])

    %% NHÁNH VNPAY
    Check_Method -- "VNPAY Online" --> Create_Pending_Order[Tạo bản ghi orders PENDING & payments PENDING_GATEWAY]
    Create_Pending_Order --> Gen_VNPay_URL[Sinh URL VNPay kèm chữ ký số SHA-512 và redirect_url]
    Gen_VNPay_URL --> Redirect_VNPay[Chuyển hướng trình duyệt khách hàng sang Cổng VNPay Sandbox]
    
    Redirect_VNPay --> Customer_Pays[Khách hàng quét mã QR Pay hoặc nhập thẻ ATM nội địa + OTP]
    Customer_Pays --> VNPay_Process{"Giao dịch tại Ngân hàng thành công?"}

    %% KẾT QUẢ VNPAY
    VNPay_Process -- Thất bại / Hủy bỏ --> Return_Fail[VNPay điều hướng về /payment/result với vnp_ResponseCode != 00]
    Return_Fail --> Show_Fail[Hiển thị thông báo thanh toán thất bại & Cho phép bấm 'Thanh toán lại']
    Show_Fail --> End_Order

    VNPay_Process -- Thành công --> Dual_Channel_IPN[VNPay xử lý 2 kênh đồng thời]
    
    subgraph IPN_Handling ["Xử Lý Webhook IPN Server-to-Server"]
        Dual_Channel_IPN --> VNPay_IPN[VNPay gửi POST Webhook IPN về Backend API]
        VNPay_IPN --> Check_Checksum{"Chữ ký SHA-512 hợp lệ?"}
        Check_Checksum -- Sai chữ ký --> Return_IPN_97[Trả mã 97: Invalid Checksum & Dừng xử lý]
        Check_Checksum -- Hợp lệ --> Tx_VNPay[Mở Prisma Transaction]
        Tx_VNPay --> Atomic_Deduct[Thực thi Atomic Conditional Decrement trừ tồn kho SKU]
        Atomic_Deduct --> Update_Order_Status[Cập nhật orders: status = PROCESSING, payment_status = PAID]
        Update_Order_Status --> Record_Coupon_Usage[Ghi nhận lượt dùng coupon_usages nếu có]
        Record_Coupon_Usage --> Commit_IPN[Commit Transaction & Phản hồi VNPay mã 00: Confirm Success]
    end

    Dual_Channel_IPN --> Return_Browser[VNPay redirect trình duyệt khách về /payment/result]
    Return_Browser --> Check_Order_DB[Frontend truy vấn API kiểm tra trạng thái đơn hàng đã được IPN cập nhật]
    Check_Order_DB --> Show_Success[Hiển thị màn hình Chúc mừng thanh toán thành công & Bắn pháo hoa Confetti]
    Show_Success --> End_Order
```

---

<a name="phần-4-sơ-đồ-tuần-tự-sequence-diagrams"></a>
## PHẦN 4: SƠ ĐỒ TUẦN TỰ (SEQUENCE DIAGRAMS)

Dưới đây là 6 biểu đồ tuần tự mô hình hóa chi tiết sự tương tác động giữa các lớp đối tượng trong các ca nghiệp vụ phức tạp nhất của dự án.

---

### 4.1. Sequence Diagram 1: Xác thực Người dùng, Cấp JWT & Thu hồi Token khi Đăng xuất (Logout Blacklist)
Biểu đồ mô tả trọn vẹn vòng đời xác thực bảo mật: Đăng nhập cấp JWT Token $ightarrow$ Gửi request có đính kèm Bearer Token qua Middleware $ightarrow$ Đăng xuất chủ động đưa token vào bảng `token_blacklist` $ightarrow$ Ngăn chặn triệt để tấn công tái sử dụng Token (Replay Attack).

```mermaid
sequenceDiagram
    autonumber
    actor User as Người Dùng
    participant UI as Giao diện Web (React App)
    participant AuthMW as Auth & RBAC Middleware
    participant AuthCtrl as Auth Controller
    participant UserRepo as User Repository
    participant BlacklistDB as Token Blacklist (MySQL)
    participant MySQL as MySQL Database

    %% LUỒNG ĐĂNG NHẬP
    Note over User, MySQL: GIAI ĐOẠN 1: ĐĂNG NHẬP HỆ THỐNG & CẤP TOKEN
    User->>UI: Nhập Email & Mật khẩu -> Bấm "Đăng nhập"
    UI->>AuthCtrl: POST /api/auth/login { email, password }
    AuthCtrl->>UserRepo: findByEmail(email)
    UserRepo->>MySQL: SELECT * FROM users WHERE email = ?
    MySQL-->>UserRepo: Bản ghi User kèm password_hash, role_id
    UserRepo-->>AuthCtrl: Đối tượng User
    
    AuthCtrl->>AuthCtrl: bcrypt.compare(password, password_hash)
    alt Mật khẩu sai hoặc tài khoản bị khóa
        AuthCtrl-->>UI: 401 Unauthorized { message: "Sai thông tin đăng nhập" }
        UI-->>User: Hiển thị thông báo lỗi
    else Xác thực thông tin thành công
        AuthCtrl->>AuthCtrl: jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '7d' })
        AuthCtrl-->>UI: 200 OK { token, user: { id, email, role, full_name } }
        UI->>UI: Lưu token vào LocalStorage & Cập nhật Global AuthState
        UI-->>User: Điều hướng vào Trang chủ / Dashboard phù hợp
    end

    %% LUỒNG TRUY CẬP TÀI NGUYÊN BẢO VỆ
    Note over User, MySQL: GIAI ĐOẠN 2: TRUY CẬP API YÊU CẦU XÁC THỰC
    User->>UI: Thực hiện hành động (vd: Xem đơn hàng cá nhân)
    UI->>AuthMW: GET /api/orders (Headers: Authorization: Bearer <token>)
    AuthMW->>BlacklistDB: SELECT id FROM token_blacklist WHERE token = ?
    BlacklistDB-->>AuthMW: null (Không tồn tại trong blacklist)
    AuthMW->>AuthMW: jwt.verify(token, JWT_SECRET)
    alt Token hợp lệ và còn hạn
        AuthMW->>AuthMW: Gán req.user = decodedPayload
        AuthMW->>AuthCtrl: Chuyển tiếp next() tới Controller xử lý
        AuthCtrl-->>UI: 200 OK { danh sách đơn hàng }
    else Token hết hạn hoặc chữ ký không khớp
        AuthMW-->>UI: 401 Unauthorized { message: "Token không hợp lệ" }
        UI->>UI: Xóa token & chuyển hướng về /login
    end

    %% LUỒNG ĐĂNG XUẤT AN TOÀN
    Note over User, MySQL: GIAI ĐOẠN 3: ĐĂNG XUẤT CHỦ ĐỘNG & THU HỒI TOKEN
    User->>UI: Bấm nút "Đăng xuất"
    UI->>AuthCtrl: POST /api/auth/logout (Headers: Authorization: Bearer <token>)
    AuthCtrl->>BlacklistDB: INSERT INTO token_blacklist (token, user_id, expires_at) VALUES (...)
    BlacklistDB-->>AuthCtrl: Đã lưu bản ghi thu hồi
    AuthCtrl-->>UI: 200 OK { message: "Đăng xuất thành công" }
    UI->>UI: Xóa token khỏi LocalStorage & Reset Auth State
    UI-->>User: Điều hướng về màn hình đăng nhập

    %% KIỂM CHỨNG TOKEN ĐÃ BỊ THU HỒI
    Note over User, MySQL: GIAI ĐOẠN 4: HACKER DÙNG LẠI TOKEN ĐÃ ĐĂNG XUẤT
    UI->>AuthMW: GET /api/orders (Sử dụng lại Token cũ đã logout)
    AuthMW->>BlacklistDB: SELECT id FROM token_blacklist WHERE token = ?
    BlacklistDB-->>AuthMW: Tìm thấy bản ghi đã thu hồi!
    AuthMW-->>UI: 401 Unauthorized { message: "Token đã bị thu hồi (Blacklisted)" }
```

---

### 4.2. Sequence Diagram 2: Lắp ráp PC & Đánh giá Tương thích Thời gian Thực (Real-time Compatibility Engine)
Mô tả chi tiết luồng xử lý tương tác khi người dùng chọn linh kiện trên giao diện PC Builder, kích hoạt hai tầng đánh giá: Tầng 1 (Client Fast Engine) và Tầng 2 (Server Comprehensive Expert Verification).

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Khách Hàng
    participant BuilderUI as PC Builder UI (React)
    participant Store as Builder State Store
    participant ClientEngine as calculateBuilderInsights.js
    participant API as PC Builder API (/api/pc-builder)
    participant RuleEvaluator as CompatibilityRuleEvaluator
    participant PowerEvaluator as PowerRuleEvaluator
    participant DB as MySQL Database

    Customer->>BuilderUI: Nhấp chọn một Card đồ họa (vd: RTX 4080 Super)
    BuilderUI->>Store: dispatch(SELECT_COMPONENT, { category: 'vga', item })
    Store->>Store: Cập nhật danh sách linh kiện đã chọn trong bộ nhớ
    
    %% TẦNG 1: CLIENT ENGINE ĐÁNH GIÁ TỨC THÌ
    Note over Store, ClientEngine: TẦNG 1: CLIENT FAST EVALUATION (<10ms)
    Store->>ClientEngine: calculateBuilderInsights(selectedComponents)
    ClientEngine->>ClientEngine: Kiểm tra kích thước card vs case clearance
    ClientEngine->>ClientEngine: Ước lượng sơ bộ tổng công suất điện TDP
    ClientEngine-->>BuilderUI: Trả về kết quả hiển thị ngay: Công suất tạm tính & Cảnh báo nhanh
    BuilderUI-->>Customer: Cập nhật giao diện mượt mà không có độ trễ

    %% TẦNG 2: SERVER ENGINE XÁC MINH TOÀN VẸN
    Note over Store, DB: TẦNG 2: SERVER COMPREHENSIVE EXPERT ENGINE
    Store->>API: POST /api/pc-builder/compatibility/check { componentIds: [...] }
    API->>DB: Truy vấn đầy đủ thông số kỹ thuật EAV của các linh kiện đã chọn
    DB-->>API: Danh sách specs chi tiết (Socket, RAM Type, Form Factor, Pin Power...)
    
    API->>RuleEvaluator: evaluateAllRules(components, rulesCache)
    RuleEvaluator->>RuleEvaluator: Kiểm tra 10 bộ quy tắc cốt lõi COMP-001 -> COMP-010
    RuleEvaluator->>RuleEvaluator: So khớp đa chiều CPU-Main, Main-Case, Tản-Case
    
    API->>PowerEvaluator: evaluatePowerAdequacy(components)
    PowerEvaluator->>PowerEvaluator: Tính toán TDP đỉnh (Peak Transient Spikes 12V-2x6)
    PowerEvaluator->>PowerEvaluator: Đánh giá biên độ an toàn PSU (Safety Margin %)
    
    API-->>Store: 200 OK { isCompatible: true, buildScore: 95, rulesPassed: 10, warnings: [...] }
    Store-->>BuilderUI: Render Huy hiệu Xanh "Tương thích 100%" & Chi tiết phân tích XAI
    BuilderUI-->>Customer: Hiển thị đầy đủ thông số an toàn và mở nút "Thêm vào giỏ hàng"
```

---

### 4.3. Sequence Diagram 3: Giao dịch Thanh toán Điện tử VNPay & Xử lý Webhook IPN Đối soát
Mô tả quy trình đối soát độc lập qua 2 kênh: Kênh Webhook IPN bảo mật cao giữa máy chủ với máy chủ (Server-to-Server) và Kênh chuyển hướng trình duyệt của người dùng (Browser Return URL).

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Khách Hàng
    participant CheckoutUI as Checkout Page (Web)
    participant OrderCtrl as Orders Controller
    participant VNPayService as VNPay Payment Service
    participant VNPayServer as VNPay Gateway Sandbox
    participant IPNCtrl as Payments IPN Controller
    participant MySQL as MySQL Database (Prisma Tx)

    Customer->>CheckoutUI: Bấm "Thanh toán qua VNPAY"
    CheckoutUI->>OrderCtrl: POST /api/orders { items, address_id, payment_method: "VNPAY", coupon_code }
    OrderCtrl->>MySQL: INSERT INTO orders (status: 'PENDING', payment_status: 'UNPAID', ...)
    MySQL-->>OrderCtrl: Tạo Order ID: #10025
    
    OrderCtrl->>VNPayService: buildPaymentUrl(order, clientIp)
    VNPayService->>VNPayService: Gom các tham số: vnp_Amount, vnp_TxnRef, vnp_ReturnUrl...
    VNPayService->>VNPayService: Sinh chữ ký bảo mật hmacSHA512(queryString, VNP_HASHSECRET)
    VNPayService-->>OrderCtrl: Trả về paymentUrl hoàn chỉnh
    OrderCtrl-->>CheckoutUI: 201 Created { paymentUrl }
    
    CheckoutUI->>VNPayServer: window.location.href = paymentUrl (Chuyển hướng trình duyệt)
    Note over Customer, VNPayServer: Khách hàng quét mã VNPAY-QR hoặc nhập thẻ ATM OTP tại Cổng VNPay
    Customer->>VNPayServer: Xác nhận trừ tiền thành công
    
    %% KÊNH 1: SERVER-TO-SERVER IPN WEBHOOK
    Note over VNPayServer, MySQL: KÊNH 1: SERVER-TO-SERVER IPN WEBHOOK ĐỐI SOÁT NGẦM
    VNPayServer->>IPNCtrl: GET /api/payments/vnpay-ipn?vnp_Amount=...&vnp_SecureHash=...
    IPNCtrl->>VNPayService: verifyIpnSignature(query)
    VNPayService->>VNPayService: Tính toán lại hash SHA-512 & So sánh với vnp_SecureHash
    alt Chữ ký số không khớp
        IPNCtrl-->>VNPayServer: 200 OK { RspCode: "97", Message: "Invalid Signature" }
    else Chữ ký số khớp 100%
        IPNCtrl->>MySQL: Mở Prisma Interactive Transaction ($transaction)
        MySQL->>MySQL: UPDATE payments SET status = 'SUCCESS', transaction_code = ?
        MySQL->>MySQL: UPDATE orders SET status = 'PROCESSING', payment_status = 'PAID'
        MySQL->>MySQL: Giảm tồn kho Atomic: UPDATE product_skus SET stock = stock - qty WHERE id = ? AND stock >= qty
        MySQL->>MySQL: INSERT INTO audit_logs (action: 'PAYMENT_SUCCESS_IPN', ...)
        MySQL-->>IPNCtrl: Transaction Hoàn tất thành công
        IPNCtrl-->>VNPayServer: 200 OK { RspCode: "00", Message: "Confirm Success" }
    end

    %% KÊNH 2: TRÌNH DUYỆT KHÁCH HÀNG REDIRECT VỀ
    Note over VNPayServer, CheckoutUI: KÊNH 2: BROWSER RETURN URL CHUYỂN HƯỚNG TRÌNH DUYỆT
    VNPayServer-->>CheckoutUI: Chuyển hướng trình duyệt về /payment/result?vnp_ResponseCode=00&vnp_TxnRef=10025
    CheckoutUI->>OrderCtrl: GET /api/orders/10025
    OrderCtrl->>MySQL: SELECT * FROM orders WHERE id = 10025
    MySQL-->>OrderCtrl: Order record (status: 'PROCESSING', payment_status: 'PAID')
    OrderCtrl-->>CheckoutUI: 200 OK { order }
    CheckoutUI-->>Customer: Hiển thị giao diện "Thanh toán thành công", mã đơn hàng và nút Xem đơn
```

---

### 4.4. Sequence Diagram 4: Quản lý Số Serial Xuất kho & Tự động Kích hoạt Bảo hành Điện tử (e-Warranty Lifecycle)
Mô tả quy trình nghiệp vụ quan trọng trong ngành linh kiện điện tử: Quét mã vạch số Serial từng món hàng khi đóng gói và tự động sinh sổ bảo hành điện tử chính hãng khi đơn được giao thành công.

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Nhân Viên Bán Hàng / Kỹ Thuật
    participant StaffUI as Staff Orders Dashboard
    participant OrderCtrl as Staff Order Controller
    participant SerialService as Order Serial Service
    participant WarrantyService as Warranty Sync Service
    participant NotifService as Notification Service
    participant MySQL as MySQL Database
    actor Customer as Khách Hàng

    Staff->>StaffUI: Mở đơn hàng #10025 đang ở trạng thái PROCESSING
    StaffUI-->>Staff: Hiển thị danh sách linh kiện cần xuất (vd: CPU i7-14700K, VGA RTX 4070)
    
    %% BƯỚC QUÉT SERIAL
    Staff->>StaffUI: Dùng súng quét Barcode / Nhập số Serial vật lý (vd: SN-CPU-9948271)
    StaffUI->>OrderCtrl: POST /api/staff/orders/10025/serials { order_item_id: 401, serial_number: "SN-CPU-9948271" }
    OrderCtrl->>SerialService: assignSerialToOrderItem(orderId, itemId, serialNumber, staffId)
    SerialService->>MySQL: INSERT INTO order_item_serials (order_id, order_item_id, sku_id, serial_number, status: 'ASSIGNED')
    MySQL-->>SerialService: Lưu thành công số Serial
    SerialService-->>StaffUI: 200 OK { message: "Gán Serial thành công" }
    StaffUI-->>Staff: Hiển thị tick xanh cho linh kiện đã có Serial

    %% BƯỚC GIAO HÀNG & KÍCH HOẠT BẢO HÀNH
    Staff->>StaffUI: Bấm "Chuyển Giao Vận (SHIPPED)" -> Điền mã vận đơn GHN
    StaffUI->>OrderCtrl: PATCH /api/staff/orders/10025/status { status: "SHIPPED", tracking_code: "GHN-884910" }
    OrderCtrl->>MySQL: UPDATE orders SET status = 'SHIPPED', updated_at = NOW()
    
    Note over Staff, Customer: Đơn vị vận chuyển giao hàng thành công đến tay khách
    Staff->>StaffUI: Bấm "Xác nhận Hoàn Thành (DELIVERED)"
    StaffUI->>OrderCtrl: PATCH /api/staff/orders/10025/status { status: "DELIVERED" }
    
    OrderCtrl->>WarrantyService: triggerAutoWarrantyActivation(orderId)
    WarrantyService->>MySQL: SELECT * FROM order_items WHERE order_id = 10025
    MySQL-->>WarrantyService: Danh sách các linh kiện đã mua kèm số tháng bảo hành
    
    loop Với từng linh kiện trong đơn hàng
        WarrantyService->>WarrantyService: Sinh mã bảo hành duy nhất: "WAR-" + Date + RandomCode
        WarrantyService->>MySQL: INSERT INTO warranties (user_id, order_id, order_item_id, serial_number, warranty_code, status: 'ACTIVE', activated_at: NOW(), expires_at: DATE_ADD(NOW(), INTERVAL warranty_months MONTH))
        WarrantyService->>MySQL: UPDATE order_item_serials SET status = 'ACTIVE', warranty_id = newWarrantyId
    end

    WarrantyService->>NotifService: sendWarrantyActivatedNotification(userId, orderId)
    NotifService->>MySQL: INSERT INTO notifications (user_id, type: 'WARRANTY', title: 'Bảo hành điện tử đã được kích hoạt', ...)
    NotifService-->>Customer: Chuông thông báo trên Web: "Các linh kiện trong đơn hàng #10025 đã được kích hoạt bảo hành điện tử thành công!"
```

---

### 4.5. Sequence Diagram 5: Tiếp nhận & Xử lý Yêu cầu Bảo hành RMA Kèm Bằng chứng Hình ảnh
Mô tả quy trình xử lý khiếu nại bảo hành, kiểm tra hiện tượng cháy nổ/hỏng hóc thông qua bằng chứng hình ảnh và nhật ký giám định kỹ thuật.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Khách Hàng
    participant RMAUI as Warranty Request Portal
    participant RMACtrl as Warranty Controller
    participant Storage as File Storage Service
    participant TechUI as Tech Workspace Dashboard
    actor TechStaff as Nhân Viên Kỹ Thuật
    participant MySQL as MySQL Database

    Customer->>RMAUI: Nhập mã Serial / Mã đơn hàng -> Bấm "Gửi yêu cầu bảo hành"
    RMAUI->>RMACtrl: GET /api/warranties/lookup?value=SN-CPU-9948271
    RMACtrl->>MySQL: SELECT * FROM warranties WHERE serial_number = ?
    MySQL-->>RMACtrl: Thông tin bảo hành còn hiệu lực (Hết hạn: 2028-11-04)
    RMACtrl-->>RMAUI: 200 OK { warrantyInfo, productName: "Intel Core i7-14700K" }

    Customer->>RMAUI: Nhập mô tả lỗi (Không lên nguồn, sập máy) + Tải lên hình ảnh/clip lỗi
    RMAUI->>RMACtrl: POST /api/warranties/requests (FormData kèm file ảnh)
    RMACtrl->>Storage: saveUploadedFiles(files)
    Storage-->>RMACtrl: Trả về danh sách file_url
    
    RMACtrl->>MySQL: INSERT INTO warranty_requests (warranty_id, user_id, serial_number, issue_description, status: 'RECEIVED', ...)
    MySQL-->>RMACtrl: Tạo Request ID: #RMA-8802
    RMACtrl->>MySQL: INSERT INTO warranty_request_attachments (request_id, file_url, source: 'CUSTOMER')
    RMACtrl->>MySQL: INSERT INTO warranty_request_events (request_id, status: 'RECEIVED', note: 'Khách hàng gửi yêu cầu online')
    RMACtrl-->>RMAUI: 201 Created { message: "Yêu cầu đã được tiếp nhận" }
    RMAUI-->>Customer: Hiển thị biên nhận điện tử và hướng dẫn gửi máy về trung tâm

    %% KỸ THUẬT VIÊN XỬ LÝ
    Note over TechStaff, MySQL: KỸ THUẬT VIÊN TIẾP NHẬN & GIÁM ĐỊNH TẠI PHÒNG LAB
    TechStaff->>TechUI: Mở danh sách RMA hàng chờ -> Chọn yêu cầu #RMA-8802
    TechUI->>RMACtrl: GET /api/tech/warranty-requests/8802
    RMACtrl->>MySQL: SELECT * FROM warranty_requests JOIN attachments ... WHERE id = 8802
    MySQL-->>RMACtrl: Dữ liệu chi tiết + Link ảnh bằng chứng lỗi
    RMACtrl-->>TechUI: 200 OK { requestData, attachments }

    TechStaff->>TechStaff: Kiểm tra linh kiện thực tế: Đúng serial, không biến dạng vật lý, lỗi mạch cấp nguồn
    TechStaff->>TechUI: Chọn hành động: "CHẤP THUẬN ĐỔI MỚI (APPROVED)" + Nhập biên bản kiểm tra
    TechUI->>RMACtrl: PATCH /api/tech/warranty-requests/8802/status { status: "APPROVED", note: "Lỗi chết chip VRM, đủ điều kiện 1 đổi 1" }
    RMACtrl->>MySQL: UPDATE warranty_requests SET status = 'APPROVED', last_staff_note = ?
    RMACtrl->>MySQL: INSERT INTO warranty_request_events (request_id, status: 'APPROVED', note: 'Kỹ thuật viên đã duyệt đổi mới', actor_role: 'TECH', actor_name: 'Tech Nguyễn Văn A')
    RMACtrl->>MySQL: INSERT INTO warranty_notifications (user_id, request_id, title: 'Yêu cầu bảo hành đã được phê duyệt', ...)
    RMACtrl-->>TechUI: 200 OK { message: "Đã cập nhật trạng thái RMA" }
    TechUI-->>TechStaff: Cập nhật giao diện thành công & In phiếu đổi hàng
```

---

### 4.6. Sequence Diagram 6: Tư vấn CSKH Trực tuyến (Live Chat Session) & Chia sẻ Dàn PC
Mô tả quy trình tương tác thời gian thực giữa Khách hàng và Nhân viên bán hàng, bao gồm xếp hàng phòng chat và tính năng độc đáo: Gửi trực tiếp cấu hình PC đang build vào khung chat để nhân viên tư vấn.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Khách Hàng
    participant ChatUI as Live Chat Box (Client)
    participant ChatCtrl as Chat Controller (/api/chat)
    participant StaffUI as Staff Chat Workspace
    actor Staff as Nhân Viên Bán Hàng
    participant MySQL as MySQL Database / Chat Storage

    Customer->>ChatUI: Mở hộp chat -> Nhập tên & Bấm "Kết nối nhân viên tư vấn"
    ChatUI->>ChatCtrl: POST /api/chat/session/start { customer_name: "Khách hàng Minh", initial_message: "Tư vấn giúp em dàn PC 30 triệu" }
    ChatCtrl->>MySQL: INSERT INTO chat_sessions (session_id, customer_name, status: 'waiting')
    ChatCtrl->>MySQL: INSERT INTO chat_messages (session_id, sender: 'customer', text: 'Tư vấn giúp em dàn PC 30 triệu')
    ChatCtrl-->>ChatUI: 200 OK { sessionId, status: 'waiting' }
    ChatUI-->>Customer: Hiển thị: "Đang kết nối nhân viên tư vấn, vui lòng đợi..."

    %% NHÂN VIÊN NHẬN PHIÊN
    Staff->>StaffUI: Xem danh sách hàng đợi (Queue Badge hiển thị có 1 khách chờ)
    StaffUI->>ChatCtrl: GET /api/chat/queue
    ChatCtrl->>MySQL: SELECT * FROM chat_sessions WHERE status = 'waiting'
    MySQL-->>ChatCtrl: Danh sách phiên chờ
    ChatCtrl-->>StaffUI: 200 OK { queue: [...] }

    Staff->>StaffUI: Bấm "Tiếp nhận phiên chat"
    StaffUI->>ChatCtrl: POST /api/chat/session/:id/accept (Headers: Bearer <staff_token>)
    ChatCtrl->>MySQL: UPDATE chat_sessions SET status = 'active', staff_name = 'Sales Hoàng' WHERE id = ?
    ChatCtrl-->>StaffUI: 200 OK { session }

    %% TRAO ĐỔI TIN NHẮN & GỬI CẤU HÌNH PC
    ChatUI->>ChatCtrl: GET /api/chat/session/:id/poll (Polling 3s / WebSocket)
    ChatCtrl-->>ChatUI: 200 OK { status: 'active', staff_name: 'Sales Hoàng' }
    ChatUI-->>Customer: "Nhân viên Sales Hoàng đã tham gia phòng chat!"

    Customer->>ChatUI: Bấm "Gửi cấu hình PC đang chọn"
    ChatUI->>ChatCtrl: POST /api/chat/session/:id/message { sender: 'customer', text: 'Dàn máy em đang tính lấy nè anh', build_data: JSON.stringify(pcBuild) }
    ChatCtrl->>MySQL: INSERT INTO chat_messages (session_id, sender: 'customer', text, build_data)
    ChatCtrl-->>ChatUI: 200 OK

    StaffUI->>ChatCtrl: GET /api/chat/session/:id/poll
    ChatCtrl-->>StaffUI: Tin nhắn mới kèm build_data
    StaffUI->>StaffUI: Tự động render Card mô phỏng dàn PC gồm 8 món của khách
    Staff->>StaffUI: Nhấp "Xem chi tiết" -> Mở Bàn build thẩm định -> Nhập tin nhắn tư vấn
    StaffUI->>ChatCtrl: POST /api/chat/session/:id/message { sender: 'staff', text: 'Dàn này rất mạnh, nhưng em nên đổi tản nhiệt nước 360 để mát hơn nhé!' }
    ChatCtrl->>MySQL: Lưu tin nhắn
    ChatCtrl-->>StaffUI: 200 OK

    ChatUI->>ChatCtrl: GET tin nhắn mới
    ChatCtrl-->>ChatUI: Tin nhắn của nhân viên
    ChatUI-->>Customer: Hiển thị lời khuyên của nhân viên tư vấn

    %% KẾT THÚC PHIÊN CHAT
    Staff->>StaffUI: Bấm "Kết thúc phiên tư vấn"
    StaffUI->>ChatCtrl: POST /api/chat/session/:id/close
    ChatCtrl->>MySQL: UPDATE chat_sessions SET status = 'closed', updated_at = NOW()
    ChatCtrl-->>StaffUI: 200 OK
    ChatUI-->>Customer: "Phiên tư vấn đã kết thúc. Cảm ơn quý khách!"
```

---
*Tài liệu TASK-03 được xây dựng dựa trên kiến trúc thực tế của hệ thống mã nguồn `services/api/` và `apps/web/`, hoàn toàn tương thích với các tiêu chuẩn mô hình hóa công nghệ phần mềm trong Khóa luận tốt nghiệp.*
