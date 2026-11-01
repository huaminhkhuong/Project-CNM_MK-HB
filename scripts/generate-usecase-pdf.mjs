import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const imagePath = "C:/Users/cobat/.gemini/antigravity/brain/22f5ac51-b5c9-4d34-a4c6-f798801f8fde/.user_uploaded/media_1793525646043_a3773d9a.png";
const imageBase64 = fs.readFileSync(imagePath).toString("base64");
const imageSrc = `data:image/png;base64,${imageBase64}`;

const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Báo Cáo Đánh Giá Use Case Tổng Quát & Đề Xuất Nâng Cấp Hệ Thống PC Mall</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 18mm 18mm 18mm;
    }
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* Cover / Header Header */
    .header-box {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .inst-header {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .doc-title {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.25;
      margin: 6px 0 10px 0;
    }
    .doc-subtitle {
      font-size: 14px;
      font-weight: 600;
      color: #2563eb;
      margin-bottom: 12px;
    }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 11.5px;
      color: #475569;
    }

    /* Headings */
    h2 {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      border-left: 4px solid #2563eb;
      padding-left: 10px;
      margin-top: 24px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    h3 {
      font-size: 13.5px;
      font-weight: 700;
      color: #1d4ed8;
      margin-top: 14px;
      margin-bottom: 8px;
    }

    p, li {
      text-align: justify;
      color: #334155;
    }

    ul, ol {
      margin: 6px 0 12px 20px;
      padding: 0;
    }
    li {
      margin-bottom: 4px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 16px 0;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      vertical-align: top;
    }
    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-high {
      background: #fee2e2;
      color: #dc2626;
      border: 1px solid #fca5a5;
    }
    .badge-med {
      background: #fef3c7;
      color: #d97706;
      border: 1px solid #fcd34d;
    }
    .badge-low {
      background: #e0f2fe;
      color: #0284c7;
      border: 1px solid #bae6fd;
    }
    .badge-pass {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }

    /* Callout Boxes */
    .callout {
      border-radius: 8px;
      padding: 10px 14px;
      margin: 12px 0;
      font-size: 12.5px;
      border-left: 4px solid;
    }
    .callout-info {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1e40af;
    }
    .callout-warning {
      background: #fffbeb;
      border-color: #f59e0b;
      color: #92400e;
    }
    .callout-note {
      background: #f8fafc;
      border-color: #64748b;
      color: #334155;
    }

    /* Diagram wrapper */
    .diagram-img-box {
      text-align: center;
      margin: 14px 0;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      background: #fafafa;
    }
    .diagram-img {
      max-width: 96%;
      height: auto;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .diagram-caption {
      font-size: 11px;
      font-style: italic;
      color: #64748b;
      margin-top: 6px;
    }

    /* Page Break Controls */
    .page-break {
      page-break-before: always;
    }
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header-box">
    <div class="inst-header">ĐỀ TÀI KHÓA LUẬN TỐT NGHIỆP • KỸ THUẬT PHẦN MỀM / HỆ THỐNG THÔNG TIN</div>
    <div class="doc-title">BÁO CÁO ĐÁNH GIÁ USE CASE TỔNG QUÁT & KẾ HOẠCH NÂNG CẤP HỆ THỐNG</div>
    <div class="doc-subtitle">Hệ Thống Thương Mại Điện Tử Linh Kiện & Lắp Ráp PC Thông Minh Tích Hợp AI (Project PC Mall)</div>
    <div class="meta-bar">
      <span><strong>Đối tượng tài liệu:</strong> Nhóm phát triển, Người đánh giá, Giảng viên phản biện</span>
      <span><strong>Ngày lập:</strong> 01/11/2026</span>
      <span><strong>Trạng thái:</strong> Bản đệ trình rà soát (Revision 1.0)</span>
    </div>
  </div>

  <!-- PHẦN 1 -->
  <h2>1. TỔNG QUAN HỆ THỐNG & ĐỐI TƯỢNG TÁC NHÂN (ACTORS)</h2>
  <p>
    <strong>Project PC Mall</strong> là hệ sinh thái phần mềm tích hợp hoàn chỉnh giải quyết trọn vẹn chuỗi giá trị thương mại điện tử linh kiện máy tính, 
    với điểm nhấn kỹ thuật đột phá là <strong>Phân hệ Lắp Ráp PC (PC Builder) hỗ trợ Trí Tuệ Nhân Tạo (Gemini LLM)</strong> kết hợp 
    <strong>Engine kiểm tra tương thích phần cứng theo thời gian thực</strong>.
  </p>
  <p>Hệ thống định danh <strong>5 Tác nhân con người</strong> và <strong>3 Tác nhân dịch vụ ngoài</strong>:</p>
  <ul>
    <li><strong>Khách Hàng Vãng Lai (Guest):</strong> Người dùng chưa đăng nhập, được phép duyệt danh mục sản phẩm, tìm kiếm, so sánh linh kiện, kiểm tra bảo hành và <em>tự do lắp ráp PC với đầy đủ tính năng kiểm tra tương thích & lưu trữ Client-side</em>.</li>
    <li><strong>Khách Hàng Thành Viên (Member Customer):</strong> Kế thừa toàn bộ quyền của Khách vãng lai, bổ sung: Lưu cấu hình đám mây, chia sẻ liên kết cấu hình công khai, đặt hàng, quản lý đơn hàng, gửi Ticket hỗ trợ và đánh giá sản phẩm.</li>
    <li><strong>Nhân Viên Bán Hàng (Sales Staff):</strong> Tiếp nhận, kiểm tra đơn hàng, xác nhận xuất kho và kết nối đơn vị vận chuyển giao hàng; trực Live Chat hỗ trợ khách.</li>
    <li><strong>Nhân Viên Kỹ Thuật (Technical Staff):</strong> Tiếp nhận và xử lý Ticket kỹ thuật chuyên sâu, tiếp nhận máy bảo hành RMA, quản lý bảng luật tương thích phần cứng (Socket, TDP, Form Factor).</li>
    <li><strong>Quản Trị Viên (System Admin):</strong> Quản lý toàn bộ danh mục sản phẩm, biến thể SKU, kho hàng, người dùng & phân quyền, duyệt thanh toán chuyển khoản và theo dõi Dashboard KPI/Doanh thu.</li>
    <li><strong>AI Advisor Service (External):</strong> Dịch vụ trí tuệ nhân tạo (Google Gemini 3.5 Flash-Lite) đóng vai trò Chuyên gia kỹ thuật phần cứng, phân tích đề xuất cấu hình tối ưu và thẩm định độc lập chất lượng bộ PC.</li>
    <li><strong>Đơn Vị Giao Vận GHN (External):</strong> Tiếp nhận yêu cầu tạo vận đơn, đồng bộ mã vận đơn và cập nhật trạng thái vận chuyển.</li>
    <li><strong>Cổng Thanh Toán VNPay (External):</strong> Xử lý giao dịch thanh toán điện tử trực tuyến an toàn.</li>
  </ul>

  <!-- PHẦN 2 -->
  <div class="avoid-break">
    <h2>2. HÌNH ẢNH SƠ ĐỒ USE CASE HIỆN TẠI & ĐÁNH GIÁ TỔNG THỂ</h2>
    <div class="diagram-img-box">
      <img src="${imageSrc}" class="diagram-img" alt="Sơ đồ Use Case Project PC Mall">
      <div class="diagram-caption">Hình 1: Sơ đồ Use Case tổng quát hiện tại của dự án Project PC Mall</div>
    </div>
  </div>

  <div class="avoid-break">
    <h3>Đánh giá ưu điểm & hạn chế của sơ đồ hiện tại:</h3>
    <ul>
      <li><strong>Ưu điểm:</strong> Đã phân định tương đối đầy đủ các Actor nghiệp vụ; thể hiện rõ quan hệ kế thừa giữa Khách hàng vãng lai và Khách hàng thành viên; có sự tham gia của các Actor ngoại vi (VNPay, GHN, AI).</li>
      <li><strong>Hạn chế cốt lõi 1 (Thiếu chiều sâu phân hệ PC Builder):</strong> Phân hệ quan trọng nhất của đồ án chỉ được biểu diễn bằng 1 Use Case đơn độc <em>"Build cấu hình PC"</em>, làm mờ nhạt hoàn toàn các năng lực công nghệ vượt trội mà hệ thống thực tế đã hiện thực.</li>
      <li><strong>Hạn chế cốt lõi 2 (Chưa phản ánh đúng năng lực AI):</strong> AI trên sơ đồ chỉ dừng lại ở <em>"Chat tư vấn kỹ thuật với AI"</em>, trong khi thực tế AI đảm nhiệm 2 luồng lớn: Đề xuất tự động từ Pool 32 linh kiện và Thẩm định độc lập (AI Audit) kèm tìm linh kiện thay thế thông minh.</li>
      <li><strong>Hạn chế cốt lõi 3 (Khách vãng lai bị đánh giá thấp):</strong> Trên sơ đồ, khách vãng lai chỉ có thể build mà không thấy được khả năng lưu tạm local, xuất/nhập file JSON cấu hình - những tính năng UX rất được đánh giá cao trong thực tế.</li>
    </ul>
  </div>

  <div class="page-break"></div>

  <!-- PHẦN 3 -->
  <h2>3. ĐỐI CHIẾU KHOẢNG TRỐNG THỰC TẾ (GAP ANALYSIS: SƠ ĐỒ vs CODEBASE)</h2>
  <p>Bảng đối chiếu dưới đây làm rõ sự chênh lệch giữa các Use Case trên bản vẽ sơ đồ và mã nguồn đã được hiện thực trong hệ thống:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Phân hệ</th>
        <th style="width: 25%;">Trên Sơ Đồ Hiện Tại</th>
        <th style="width: 35%;">Đã Hiện Thực Trong Codebase Thực Tế</th>
        <th style="width: 20%;">Khoảng Trống / Nhận Xét</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. PC Builder & Trợ lý AI</strong></td>
        <td>
          • Build cấu hình PC<br>
          • Chat tư vấn kỹ thuật với AI<br>
          • Lưu và chia sẻ cấu hình PC (chỉ dành cho Thành viên)
        </td>
        <td>
          • <strong>Form tiêu chí đa chiều (Wizard):</strong> Ngân sách, độ phân giải, tựa game/phần mềm, thẩm mỹ màu sắc.<br>
          • <strong>Luồng 1 - AI Đề Xuất (Pool 32):</strong> Query DB lấy 4 linh kiện/danh mục $\rightarrow$ AI stream chọn 1 món tối ưu/danh mục, tính toán Dual-Channel RAM.<br>
          • <strong>Luồng 2 - AI Audit Build:</strong> Chấm điểm độc lập, đo bottleneck %, công suất nguồn PSU $\rightarrow$ Tự tìm linh kiện thay thế từ DB ('Smart Replacement') $\rightarrow$ Chat hỏi đáp theo ngữ cảnh dàn máy.<br>
          • <strong>Rule Engine Tương Thích Tức Thì:</strong> Socket CPU-Main, DDR4/DDR5, dài VGA, tản nhiệt.<br>
          • <strong>Khách vãng lai:</strong> Lưu nhiều cấu hình trên LocalStorage, Đổi tên, Xuất/Nhập file '.json'.
        </td>
        <td><span class="badge badge-high">Chênh Lệch Lớn</span><br>Sơ đồ quá sơ sài so với năng lực thực tế của phân hệ đinh trong đồ án.</td>
      </tr>
      <tr>
        <td><strong>2. Thương Mại Điện Tử & Đặt Hàng</strong></td>
        <td>
          • Xem danh mục, Tìm kiếm, Lọc<br>
          • Xem chi tiết / so sánh<br>
          • Đặt hàng (Extend: Thanh toán VNPay)<br>
          • Quản lý đơn (Extend: Huỷ đơn)
        </td>
        <td>
          • <strong>Lọc chuyên sâu:</strong> Theo thông số kỹ thuật (Socket, RAM bus, Chuẩn giao tiếp).<br>
          • <strong>So sánh sản phẩm:</strong> Bảng đối chiếu song song specs chi tiết.<br>
          • <strong>Nạp dàn PC vào giỏ hàng:</strong> Đưa toàn bộ linh kiện đã build vào Checkout với 1 cú click.<br>
          • <strong>Theo dõi tiến trình đơn:</strong> Tracking trạng thái chi tiết theo thời gian thực (Order Events Timeline).
        </td>
        <td><span class="badge badge-pass">Cơ Bản Khớp</span><br>Cần làm rõ Use Case nạp nguyên dàn PC đã build vào giỏ hàng.</td>
      </tr>
      <tr>
        <td><strong>3. Hậu Mãi & Dịch Vụ Khách Hàng</strong></td>
        <td>
          • Kích hoạt bảo hành điện tử<br>
          • Gửi Ticket<br>
          • Xử lý Ticket kỹ thuật<br>
          • Tiếp nhận bảo hành RMA
        </td>
        <td>
          • <strong>Tra cứu bảo hành công khai:</strong> Khách vãng lai tra cứu trực tiếp theo Serial/IMEI không cần tài khoản.<br>
          • <strong>Trao đổi Ticket tương tác:</strong> Nhắn tin 2 chiều giữa khách và kỹ thuật viên kèm đính kèm file/ảnh.<br>
          • <strong>Staff Chat:</strong> Kênh chat trực tiếp nhân viên - khách hàng ('/staff/chat').
        </td>
        <td><span class="badge badge-med">Cần Bổ Sung</span><br>Thiếu Use Case tra cứu bảo hành cho khách vãng lai và kênh Staff Chat.</td>
      </tr>
      <tr>
        <td><strong>4. Quản Trị & Vận Hành</strong></td>
        <td>
          • Quản lý người dùng & phân quyền<br>
          • Quản lý danh mục & vòng đời SP<br>
          • Quản lý tồn kho hàng hóa<br>
          • Cấu hình & giám sát hệ thống<br>
          • Dashboard báo cáo KPI & Doanh thu<br>
          • Quản lý luật tương thích
        </td>
        <td>
          • Đã có đầy đủ trang quản trị ('AdminDashboard', 'AdminProducts', 'AdminSkus', 'AdminAttributes', 'AdminSystem', 'AdminCompatibilityRules').<br>
          • <strong>Bổ sung thực tế:</strong> Module duyệt thanh toán chuyển khoản thủ công ('AdminPaymentApprovalPage').
        </td>
        <td><span class="badge badge-med">Cần Bổ Sung</span><br>Cần đưa thêm Use Case duyệt thanh toán chuyển khoản vào sơ đồ.</td>
      </tr>
    </tbody>
  </table>

  <!-- PHẦN 4 -->
  <div class="page-break"></div>
  <h2>4. DANH MỤC CÁC VẤN ĐỀ CẦN SỬA ĐỔI & LỘ TRÌNH THỰC HIỆN</h2>
  <p>Nhóm phát triển đề xuất kế hoạch hành động phân loại theo 3 mức độ ưu tiên để người đọc/thành viên trong nhóm tiến hành cập nhật:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 8%;">Mã</th>
        <th style="width: 25%;">Hạng Mục Cần Sửa Đổi</th>
        <th style="width: 15%;">Mức Ưu Tiên</th>
        <th style="width: 52%;">Mô Tả Chi Tiết & Lý Do Kỹ Thuật</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>MOD-01</strong></td>
        <td><strong>Tách nhánh 2 Luồng AI trong PC Builder</strong></td>
        <td><span class="badge badge-high">Ưu Tiên 1 (Cao)</span></td>
        <td>
          Thay vì chỉ có 1 hình elip <em>"Build cấu hình PC"</em>, cần tách thành 2 Use Case mở rộng (Extend) rõ rệt:
          <br>1. <strong>Đề xuất cấu hình từ Pool 32 linh kiện (AI Suggest)</strong>: Kèm Form tiêu chí chuẩn.
          <br>2. <strong>Thẩm định & Bắt nghẽn cổ chai (AI Build Audit)</strong>: Kèm gợi ý đổi linh kiện từ DB.
          <br><em>Lý do:</em> Đây là đóng góp khoa học chính của đề tài tốt nghiệp, phải thể hiện nổi bật trên sơ đồ.
        </td>
      </tr>
      <tr>
        <td><strong>MOD-02</strong></td>
        <td><strong>Bổ sung Use Case kiểm tra tương thích tự động</strong></td>
        <td><span class="badge badge-high">Ưu Tiên 1 (Cao)</span></td>
        <td>
          Thêm Use Case <em>"Kiểm tra tương thích phần cứng tức thì"</em> nối quan hệ <code>&lt;&lt;Include&gt;&gt;</code> với <em>"Lắp ráp PC thủ công"</em>.
          <br><em>Lý do:</em> Mọi thao tác chọn linh kiện trong hệ thống đều tự động kích hoạt Rule Engine kiểm tra tính tương thích.
        </td>
      </tr>
      <tr>
        <td><strong>MOD-03</strong></td>
        <td><strong>Gắn Use Case Lưu cấu hình cho Khách vãng lai</strong></td>
        <td><span class="badge badge-high">Ưu Tiên 1 (Cao)</span></td>
        <td>
          Bổ sung Use Case <em>"Lưu tạm & Xuất/Nhập file JSON cấu hình"</em> gán trực tiếp cho Actor <code>Khách Hàng Vãng Lai</code>.
          <br><em>Lý do:</em> Hệ thống thực tế cho phép khách lưu trên LocalStorage và tải file '.json' về máy mà không bắt buộc phải đăng nhập.
        </td>
      </tr>
      <tr>
        <td><strong>MOD-04</strong></td>
        <td><strong>Kết nối AI Advisor Service với cả 2 Use Case AI</strong></td>
        <td><span class="badge badge-high">Ưu Tiên 1 (Cao)</span></td>
        <td>
          Actor <code>AI Advisor Service</code> phải được kẻ đường liên kết (Association) tới cả 2 Use Case: <em>"Đề xuất PC từ 32 ứng viên"</em> và <em>"Thẩm định Build & Chat chuyên sâu"</em>.
        </td>
      </tr>
      <tr>
        <td><strong>MOD-05</strong></td>
        <td><strong>Bổ sung Use Case Tra cứu bảo hành điện tử</strong></td>
        <td><span class="badge badge-med">Ưu Tiên 2 (Trung bình)</span></td>
        <td>
          Thêm Use Case <em>"Tra cứu bảo hành theo Serial/IMEI"</em> cho <code>Khách Hàng Vãng Lai</code>.
          <br><em>Lý do:</em> Khách hàng mua hàng tại quầy hoặc nhận máy có thể tra cứu hạn bảo hành trực tiếp từ trang chủ mà không cần tạo tài khoản.
        </td>
      </tr>
      <tr>
        <td><strong>MOD-06</strong></td>
        <td><strong>Bổ sung Use Case Duyệt thanh toán chuyển khoản</strong></td>
        <td><span class="badge badge-med">Ưu Tiên 2 (Trung bình)</span></td>
        <td>
          Gán Use Case <em>"Duyệt thanh toán chuyển khoản thủ công"</em> cho Actor <code>Quản Trị Viên</code> (Admin).
          <br><em>Lý do:</em> Đã hiện thực trang 'AdminPaymentApprovalPage' trong codebase để phục vụ các đơn thanh toán QR Banking.
        </td>
      </tr>
      <tr>
        <td><strong>MOD-07</strong></td>
        <td><strong>Làm rõ quan hệ Tạo vận đơn GHN</strong></td>
        <td><span class="badge badge-med">Ưu Tiên 2 (Trung bình)</span></td>
        <td>
          Quan hệ giữa <em>"Tiếp nhận & xử lý đơn hàng"</em> và <em>"Tạo vận đơn (GHN)"</em> nên chuyển từ <code>&lt;&lt;Include&gt;&gt;</code> sang <code>&lt;&lt;Extend&gt;&gt;</code>, vì chỉ đơn hàng giao tận nơi mới tạo vận đơn GHN, đơn nhận tại cửa hàng không kích hoạt.
        </td>
      </tr>
      <tr>
        <td><strong>MOD-08</strong></td>
        <td><strong>Phân vùng 4 Hệ Thống Con (Subsystem Boundaries)</strong></td>
        <td><span class="badge badge-low">Ưu Tiên 3 (Hình thức)</span></td>
        <td>
          Thay vì để chung trong 1 khung xanh lớn, dùng 4 khung hình chữ nhật con phân vùng rõ: <em>PC Builder & AI</em>, <em>Thương Mại Điện Tử</em>, <em>Hậu Mãi RMA</em>, <em>Quản Trị Doanh Nghiệp</em>.
        </td>
      </tr>
    </tbody>
  </table>

  <!-- PHẦN 5 -->
  <div class="page-break"></div>
  <h2>5. ĐẶC TẢ CHI TIẾT 2 USE CASE TRỌNG TÂM CÔNG NGHỆ (PC BUILDER AI)</h2>
  <p>Nhằm phục vụ tài liệu thuyết minh Khóa luận, dưới đây là bảng đặc tả Use Case chuẩn mực của 2 chức năng đột phá vừa hoàn thiện:</p>

  <div class="avoid-break">
    <h3>Đặc tả 1: Use Case "Đề xuất cấu hình PC thông minh từ Pool 32 linh kiện" (UC-AI-01)</h3>
    <table>
      <tr>
        <th style="width: 25%;">Thuộc tính</th>
        <th style="width: 75%;">Nội dung đặc tả</th>
      </tr>
      <tr>
        <td><strong>Mã Use Case / Tên</strong></td>
        <td><code>UC-AI-01</code>: Đề xuất cấu hình PC thông minh từ Candidate Pool 32 linh kiện</td>
      </tr>
      <tr>
        <td><strong>Tác nhân (Actor)</strong></td>
        <td>Khách Hàng Vãng Lai, Khách Hàng Thành Viên, AI Advisor Service (Gemini 3.5 Flash-Lite)</td>
      </tr>
      <tr>
        <td><strong>Mô tả tóm tắt</strong></td>
        <td>Người dùng nhập bộ tiêu chuẩn (ngân sách, mục đích chi tiết, độ phân giải, thẩm mỹ màu sắc). Hệ thống lọc ra 32 ứng viên linh kiện thực tế từ kho và AI stream lựa chọn 8 linh kiện tối ưu, tính toán cấu hình Dual-Channel RAM.</td>
      </tr>
      <tr>
        <td><strong>Tiền điều kiện (Pre-condition)</strong></td>
        <td>Người dùng truy cập trang PC Builder và mở Modal Tiêu Chí Lắp Ráp. Kho hàng có ít nhất 4 ứng viên hợp lệ cho mỗi danh mục.</td>
      </tr>
      <tr>
        <td><strong>Luồng sự kiện chính (Main Flow)</strong></td>
        <td>
          1. Khách hàng bấm nút "Build PC Của Bạn" $\rightarrow$ Chọn nhánh "AI Tư Vấn Đề Xuất".<br>
          2. Khách hàng thiết lập: Ngân sách, Nhu cầu (Gaming Esports/AAA, Đồ họa 3D, Văn phòng), Độ phân giải (1080p, 2K, 4K), Tone màu (Đen/Trắng), Nhu cầu tản nhiệt và câu lệnh mô tả riêng.<br>
          3. Hệ thống tạo Candidate Pool 32 linh kiện từ cơ sở dữ liệu kho hàng thật.<br>
          4. Hệ thống gửi 32 linh kiện kèm Prompt nghiêm khắc, không thiên vị tới AI Advisor Service.<br>
          5. AI phản hồi bài phân tích dạng Streaming Server-Sent Events (SSE) theo thời gian thực.<br>
          6. Khi hoàn tất, Modal hiển thị trọn bộ 8 linh kiện được chọn, điểm tương thích, tổng giá tiền và kiến trúc RAM.<br>
          7. Khách hàng bấm "Áp Dụng Vào Cấu Hình" để nạp vào bàn lắp ráp.
        </td>
      </tr>
      <tr>
        <td><strong>Hậu điều kiện (Post-condition)</strong></td>
        <td>8 linh kiện được nạp đồng bộ vào bàn lắp ráp, trạng thái tương thích được cập nhật tức thì.</td>
      </tr>
    </table>
  </div>

  <div class="avoid-break" style="margin-top: 20px;">
    <h3>Đặc tả 2: Use Case "Thẩm định cấu hình & Gợi ý linh kiện thay thế với AI" (UC-AI-02)</h3>
    <table>
      <tr>
        <th style="width: 25%;">Thuộc tính</th>
        <th style="width: 75%;">Nội dung đặc tả</th>
      </tr>
      <tr>
        <td><strong>Mã Use Case / Tên</strong></td>
        <td><code>UC-AI-02</code>: Thẩm định cấu hình độc lập & Gợi ý linh kiện thay thế (AI Audit & Smart Swap)</td>
      </tr>
      <tr>
        <td><strong>Tác nhân (Actor)</strong></td>
        <td>Khách Hàng Vãng Lai, Khách Hàng Thành Viên, AI Advisor Service</td>
      </tr>
      <tr>
        <td><strong>Mô tả tóm tắt</strong></td>
        <td>Sau khi người dùng tự chọn linh kiện, AI thực hiện bài thẩm định độc lập nghiêm khắc: chấm điểm 0-100, đo tỷ lệ nghẽn cổ chai, kiểm tra công suất nguồn. Nếu phát hiện linh kiện yếu/lỗi, hệ thống tự query DB tìm 3 linh kiện thay thế phù hợp và cho phép chat hỏi đáp kỹ thuật trực tiếp.</td>
      </tr>
      <tr>
        <td><strong>Tiền điều kiện (Pre-condition)</strong></td>
        <td>Bàn lắp ráp có ít nhất 1 linh kiện đã được chọn.</td>
      </tr>
      <tr>
        <td><strong>Luồng sự kiện chính (Main Flow)</strong></td>
        <td>
          1. Khách hàng bấm nút "Đánh Giá Build Với AI" trên thanh tóm tắt cấu hình.<br>
          2. Hệ thống thu thập danh sách linh kiện hiện có và gửi yêu cầu thẩm định stream tới AI.<br>
          3. AI stream báo cáo phân tích chuyên sâu: Điểm Audit, % Nghẽn cổ chai, Công suất PSU.<br>
          4. Nếu có linh kiện không cân xứng (ví dụ: i3 đi với RTX 4070 Ti, nguồn 400W), hệ thống trích xuất tiêu chí và tự động truy vấn DB kho hàng lấy linh kiện thay thế hiển thị dạng thẻ tương tác.<br>
          5. Khách hàng có thể bấm "Thay Thế Linh Kiện Này" để swap trực tiếp.<br>
          6. Khách hàng có thể gõ câu hỏi trò chuyện trực tiếp (AI Chat Stream) để hỏi sâu về thông số kỹ thuật.
        </td>
      </tr>
      <tr>
        <td><strong>Hậu điều kiện (Post-condition)</strong></td>
        <td>Dàn máy được tối ưu hoá, giảm thiểu nguy cơ nghẽn cổ chai và cháy nổ nguồn điện.</td>
      </tr>
    </table>
  </div>

  <!-- PHẦN 6 -->
  <div class="page-break"></div>
  <h2>6. Ý KIẾN THAM VẤN KỸ THUẬT VỀ QUAN HỆ &lt;&lt;INCLUDE&gt;&gt; ĐĂNG NHẬP</h2>
  
  <div class="callout callout-note">
    <strong>GHI CHÚ CHỈ ĐẠO CỦA NHÓM NGHIÊN CỨU:</strong><br>
    Theo chỉ đạo của tác giả, <em>"về phần quan hệ include Đăng nhập tạm thời giữ nguyên hiện trạng, chờ ý kiến đánh giá trực tiếp từ Giảng viên hướng dẫn / Giảng viên phản biện rồi mới quyết định phương án tinh giản"</em>.
  </div>

  <p>Để phục vụ buổi trao đổi với Giảng viên, nhóm phát triển xin tổng hợp cơ sở lý thuyết và các kịch bản xử lý để xin ý kiến chỉ đạo:</p>

  <h3>A. Cơ sở lý thuyết theo chuẩn UML 2.5 (Object Management Group - OMG)</h3>
  <ul>
    <li>
      <strong>Định nghĩa quan hệ &lt;&lt;Include&gt;&gt;:</strong> Chỉ sử dụng khi một Use Case cơ sở (Base Use Case) bắt buộc phải gọi một chuỗi hành vi của Use Case con (Included Use Case) như một phần không thể tách rời trong luồng nghiệp vụ chính (Ví dụ: <em>"Lắp ráp PC"</em> bắt buộc phải <em>"Kiểm tra tương thích"</em>).
    </li>
    <li>
      <strong>Đăng nhập (Authentication) trong thiết kế phần mềm:</strong> Trong các giáo trình kỹ nghệ phần mềm kinh điển (Larman, Fowler), Đăng nhập thường được xem là:
      <ul>
        <li><strong>Tiền điều kiện (Pre-condition):</strong> Ghi rõ trong mục Pre-condition của bảng đặc tả: <em>"Người dùng đã đăng nhập vai trò Member/Staff/Admin"</em> mà không cần vẽ mũi tên trên sơ đồ.</li>
        <li><strong>Ranh giới Actor (Actor Generalization):</strong> Bằng cách kế thừa 'Khách Hàng Vãng Lai' $\rightarrow$ 'Khách Hàng Thành Viên', mọi Use Case gắn với 'Khách Hàng Thành Viên' đương nhiên đòi hỏi phải có tài khoản đăng nhập.</li>
      </ul>
    </li>
  </ul>

  <h3>B. Hai phương án chuẩn bị sẵn sàng để Giảng viên lựa chọn</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Phương Án</th>
        <th style="width: 45%;">Mô Tả Cách Thể Hiện</th>
        <th style="width: 30%;">Đánh Giá / Khuyến Nghị</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Phương án A:<br>Giữ nguyên mạng nhện Include</strong></td>
        <td>
          Giữ nguyên toàn bộ các mũi tên <code>&lt;&lt;Include&gt;&gt;</code> trỏ vào ô 'Đăng nhập' như hình vẽ hiện tại.
        </td>
        <td>
          • <em>Ưu điểm:</em> Nhấn mạnh tính bảo mật, nhắc nhở chức năng nào cần đăng nhập.<br>
          • <em>Nhược điểm:</em> Sơ đồ bị chằng chịt, dễ bị trừ điểm lỗi hình thức UML.
        </td>
      </tr>
      <tr>
        <td><strong>Phương án B:<br>Tinh giản chuẩn hóa UML (Khuyến nghị)</strong></td>
        <td>
          1. Xóa toàn bộ các mũi tên <code>&lt;&lt;Include&gt;&gt;</code> đổ về Đăng nhập.<br>
          2. Đưa 'Đăng nhập' thành 1 Use Case thông thường thuộc phân hệ Quản lý tài khoản.<br>
          3. Sử dụng Pre-condition trong tài liệu thuyết minh để định danh điều kiện đăng nhập.
        </td>
        <td>
          • <em>Ưu điểm:</em> Sơ đồ sáng sủa, chuyên nghiệp, đúng 100% chuẩn sách giáo khoa kỹ nghệ phần mềm quốc tế.<br>
          • <em>Nhược điểm:</em> Cần người đọc hiểu rõ khái niệm Pre-condition.
        </td>
      </tr>
    </tbody>
  </table>

  <div class="callout callout-info" style="margin-top: 20px;">
    <strong>CÂU HỎI XIN Ý KIẾN GIẢNG VIÊN HƯỚNG DẪN:</strong><br>
    <em>"Thưa Thầy/Cô, trong sơ đồ Use Case tổng quát của Khóa luận, Thầy/Cô khuyến khích nhóm giữ các mũi tên <code>&lt;&lt;Include&gt;&gt; Đăng nhập</code> để làm rõ yêu cầu bảo mật của từng tác vụ, hay Thầy/Cô định hướng tinh giản các mũi tên này và mô tả điều kiện đăng nhập dưới dạng Pre-condition trong bảng đặc tả để sơ đồ mạch lạc hơn theo chuẩn UML 2.5?"</em>
  </div>

  <!-- PHẦN KẾT LUẬN -->
  <h2 style="margin-top: 30px;">7. KẾT LUẬN & HÀNH ĐỘNG TIẾP THEO</h2>
  <p>
    Hệ thống <strong>Project PC Mall</strong> hiện tại đã hoàn thiện xuất sắc cả về mặt tính năng nghiệp vụ lẫn các bài toán kỹ thuật phức tạp (Streaming SSE, Candidate Pool 32, AI Build Audit, Smart Replacement, Heuristic Compatibility Engine).
  </p>
  <p>
    Việc cập nhật lại Sơ đồ Use Case theo các đề xuất trong tài liệu này (đặc biệt là làm nổi bật 2 Luồng AI PC Builder và phân tách 4 Subsystems) sẽ giúp bài báo cáo Khóa luận phản ánh chính xác 100% giá trị công nghệ thực tế của đồ án, đạt điểm đánh giá tối đa từ Hội đồng chấm thi.
  </p>

  <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center;">
    <div style="width: 45%;">
      <strong>NGƯỜI LẬP BÁO CÁO</strong><br>
      <span style="font-size: 11px; color: #64748b;">(Ký và ghi rõ họ tên)</span>
      <div style="height: 50px;"></div>
      <strong>Nhóm Phát Triển Project PC Mall</strong>
    </div>
    <div style="width: 45%;">
      <strong>Ý KIẾN GIẢNG VIÊN HƯỚNG DẪN</strong><br>
      <span style="font-size: 11px; color: #64748b;">(Ký và ghi nhận xét)</span>
      <div style="height: 50px;"></div>
      ...........................................................
    </div>
  </div>

</body>
</html>
`;

const htmlFilePath = "T:/Khoa_luan/docs/Bao_Cao_Danh_Gia_UseCase_PC_Mall.html";
const pdfFilePath = "T:/Khoa_luan/docs/Bao_Cao_Danh_Gia_UseCase_PC_Mall.pdf";

fs.writeFileSync(htmlFilePath, htmlContent, "utf8");
console.log("✅ Đã ghi file HTML tại:", htmlFilePath);

// Dùng Chrome headless để in ra PDF
const chromeCmd = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfFilePath}" "${htmlFilePath}"`;
console.log("🚀 Đang khởi chạy Chrome headless để xuất PDF...");

try {
  const stdout = execSync(chromeCmd, { encoding: "utf8" });
  console.log(stdout);
  const stats = fs.statSync(pdfFilePath);
  console.log(`🎉 XUẤT THÀNH CÔNG PDF! Kích thước: ${(stats.size / 1024).toFixed(1)} KB tại: ${pdfFilePath}`);
} catch (err) {
  console.error("❌ Lỗi khi xuất PDF qua Chrome:", err);
}
