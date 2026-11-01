import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

wb = openpyxl.Workbook()
ws = wb.active
ws.title = 'KLTN_Task_List'

ws.views.sheetView[0].showGridLines = True

# Title block
ws.merge_cells('A1:G1')
ws['A1'] = 'KẾ HOẠCH & DANH MỤC CÔNG VIỆC HOÀN THIỆN BÁO CÁO KHÓA LUẬN TỐT NGHIỆP'
ws['A1'].font = Font(name='Segoe UI', size=16, bold=True, color='1F4E79')
ws['A1'].alignment = Alignment(horizontal='center', vertical='center')

ws.merge_cells('A2:G2')
ws['A2'] = 'Đề tài: Hệ thống thương mại điện tử linh kiện máy tính tích hợp Smart PC Builder và AI tư vấn cấu hình (PC Mall)'
ws['A2'].font = Font(name='Segoe UI', size=11, italic=True, color='595959')
ws['A2'].alignment = Alignment(horizontal='center', vertical='center')

ws.merge_cells('A3:G3')
ws['A3'] = 'Sinh viên thực hiện: Hứa Minh Khương - Trịnh Công Tuyền | GVHD: TS. Ngô Hữu Dũng | ĐH Công nghiệp TP.HCM'
ws['A3'].font = Font(name='Segoe UI', size=11, bold=True, color='262626')
ws['A3'].alignment = Alignment(horizontal='center', vertical='center')

ws.row_dimensions[1].height = 32
ws.row_dimensions[2].height = 20
ws.row_dimensions[3].height = 22
ws.row_dimensions[4].height = 10

headers = [
    'STT',
    'Mã Task',
    'Mức độ\nưu tiên',
    'Tên hạng mục công việc',
    'Mô tả chi tiết & Hướng dẫn triển khai',
    'Nguồn dữ liệu có sẵn trong Project',
    'Trạng thái\n(Dự kiến)'
]

ws.row_dimensions[5].height = 28
header_fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
header_font = Font(name='Segoe UI', size=10, bold=True, color='FFFFFF')
header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

thin_border_side = Side(border_style='thin', color='D9D9D9')
header_border = Border(left=thin_border_side, right=thin_border_side, top=Side(border_style='medium', color='1F4E79'), bottom=Side(border_style='medium', color='1F4E79'))

for col_idx, h in enumerate(headers, 1):
    cell = ws.cell(row=5, column=col_idx, value=h)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = header_align
    cell.border = header_border

tasks = [
    (1, 'TASK-01', 'P0 (Khẩn cấp)', 'Thống nhất cấu trúc chương báo cáo',
     'Lựa chọn cấu trúc 5 chương chuẩn của Khoa CNTT - IUH (như MauBaoCaoThamKhao) hoặc giữ 8 chương theo phê duyệt của GVHD TS. Ngô Hữu Dũng. Khuyến nghị cấu trúc 5 chương để đảm bảo tính chuẩn mực học thuật của Khoa.',
     'Đề cương KLTN, ý kiến phản hồi từ GVHD', 'Cần làm'),
    (2, 'TASK-02', 'P0 (Khẩn cấp)', 'Thiết kế Cơ sở dữ liệu & Data Dictionary',
     'Trình bày sơ đồ quan hệ thực thể (ERD), mô hình dữ liệu quan hệ, và lập bảng Từ điển dữ liệu (Data Dictionary) chi tiết cho các thực thể cốt lõi: Users, Roles, Categories, Products, Specifications, Compatibility_Rules, Builds, Orders, Order_Items, Tickets, Shipments.',
     'docs/03-database/cnm_ecommerce_full_setup.sql, database/prisma/schema.prisma, docs/03-database/README.md', 'Cần làm'),
    (3, 'TASK-03', 'P0 (Khẩn cấp)', 'Vẽ và đặc tả hệ thống biểu đồ UML',
     '1. Sơ đồ Use Case tổng quát toàn hệ thống.\n2. Phân rã Use Case theo 5 Actor (Guest, Customer, Staff, Tech, Admin).\n3. Sơ đồ Activity Diagram: luồng Build PC & xử lý tập luật, luồng tư vấn cấu hình AI Advisor, luồng đặt hàng thanh toán.\n4. Sơ đồ Sequence Diagram cho các tương tác nghiệp vụ phức tạp.',
     'docs/01-requirements/README.md, docs/02-architecture/README.md, docs/ROUTES_AUDIT.md', 'Cần làm'),
    (4, 'TASK-04', 'P0 (Khẩn cấp)', 'Lập bảng Đặc tả Use Case chi tiết',
     'Soạn bảng đặc tả theo chuẩn IUH (Tên UC, Actor, Mục tiêu, Điều kiện tiên quyết/kết thúc, Luồng sự kiện chính, Luồng ngoại lệ) cho 8 Use Case trọng tâm: Đăng ký/Đăng nhập, Tìm kiếm/Lọc linh kiện, Smart PC Builder kiểm tra tương thích, AI tư vấn cấu hình, Đặt hàng & Thanh toán, Quản lý đơn hàng, Admin cấu hình tập luật tương thích, Kỹ thuật viên xử lý bảo hành.',
     'docs/CUSTOMER_DEMO_100.md, docs/ADMIN_DEMO_100.md, docs/STAFF_DEMO_100.md, docs/TECH_DEMO_100.md', 'Cần làm'),
    (5, 'TASK-05', 'P0 (Khẩn cấp)', 'Chụp ảnh minh họa & Thuyết minh giao diện',
     'Chụp ảnh màn hình thực tế giao diện ứng dụng web (apps/web) kèm số hiệu Hình X.Y và phân tích chức năng:\n- Giao diện Trang chủ, Catalog linh kiện & Bộ lọc thông số kỹ thuật.\n- Giao diện Smart PC Builder (chọn linh kiện, hiển thị điểm Build Health, cảnh báo Blocker/Warning/Advisory).\n- Giao diện Chatbot / AI Configuration Advisor (hội thoại, đề xuất Best Value, Best Performance, Budget Safe).\n- Giao diện Giỏ hàng, Đặt hàng & Thanh toán.\n- Dashboard Quản trị Admin (quản lý sản phẩm, đơn hàng, cấu hình Rules).',
     'apps/web/src/pages/ (Chạy dự án frontend để chụp ảnh màn hình sắc nét)', 'Cần làm'),
    (6, 'TASK-06', 'P0 (Khẩn cấp)', 'Xây dựng Bảng Kịch bản Kiểm thử (Test Cases)',
     'Soạn bảng kiểm thử chất lượng phần mềm theo mẫu chuẩn IUH (Test ID, Tên chức năng, Tiền điều kiện, Dữ liệu đầu vào, Các bước thực hiện, Kết quả mong đợi, Kết quả thực tế, Đánh giá Pass/Fail):\n- Test cases chức năng Xác thực (Auth) & Phân quyền (RBAC).\n- Test cases kiểm tra tập luật tương thích Smart PC Builder (Socket, Form Factor, Wattage, RAM DDR).\n- Test cases xử lý luồng AI Advisor & bảo mật chống Prompt Injection.\n- Test cases Đặt hàng & Xử lý trạng thái giao dịch.',
     'docs/06-testing/README.md, docs/TESTING_GUIDE_DETAILED.md, docs/audit/TESTING_AND_PRODUCTION_READINESS.md', 'Cần làm'),
    (7, 'TASK-07', 'P1 (Quan trọng)', 'Viết Cơ sở lý thuyết Công nghệ áp dụng',
     'Viết chi tiết các mục lý thuyết công nghệ thực tế đang sử dụng trong đồ án (định nghĩa, kiến trúc hoạt động, ưu điểm, lý do chọn và ứng dụng trong PC Mall):\n- Frontend: React 18, Vite, Tailwind CSS, Responsive Design.\n- Backend: Node.js, Express.js, TypeScript, RESTful API architecture.\n- Cơ sở dữ liệu: MySQL 8, Prisma ORM, kỹ thuật indexing & connection pool.\n- Xác thực & Phân quyền: JSON Web Token (JWT) stateless, Role-Based Access Control (RBAC).\n- Trí tuệ nhân tạo: OpenAI / LLM API, Prompt Engineering, XAI (Explainable AI).',
     'README.md, packages/shared/, services/api/src/, apps/web/src/', 'Cần làm'),
    (8, 'TASK-08', 'P1 (Quan trọng)', 'Soạn thảo Hiện thực & Triển khai hệ thống',
     'Trình bày chi tiết giải pháp kỹ thuật và triển khai:\n- Cấu trúc thư mục Monorepo (apps, services, packages, infra).\n- Môi trường phát triển và cấu hình biến môi trường (.env).\n- Đóng gói ứng dụng Containerization với Docker, Dockerfile và Docker Compose.\n- Cấu hình Reverse Proxy Nginx, quản lý routing và bảo mật mạng nội bộ.\n- Quy trình tự động hóa CI/CD với GitHub Actions (nếu có).',
     'DEPLOYMENT_GUIDE.md, docker-compose.yml, infra/docker/, docs/07-deployment/README.md', 'Cần làm'),
    (9, 'TASK-09', 'P1 (Quan trọng)', 'Viết nội dung Đánh giá & Thảo luận',
     '1. Đánh giá chức năng: So sánh các mục tiêu đã đề ra tại Chương 1 với kết quả hiện thực thực tế.\n2. Đánh giá hiệu năng: Thời gian phản hồi của Compatibility Engine (< 1.5s), hiệu suất truy vấn cơ sở dữ liệu.\n3. Thảo luận về ưu điểm: Cơ chế XAI minh bạch (Why this, Why not, What wrong, How to fix), tự động tính điểm Build Health.\n4. Hạn chế còn tồn tại: Mức độ bao phủ của bộ quy tắc phần cứng, cơ chế đồng bộ giá nhà phân phối.',
     'docs/audit/PROJECT_AUDIT_SUMMARY.md, docs/audit/MODULE_COMPLETION_MATRIX.md, docs/audit/ISSUES_AND_REMEDIATION_PLAN.md', 'Cần làm'),
    (10, 'TASK-10', 'P1 (Quan trọng)', 'Soạn thảo Kết luận & Hướng phát triển',
     '1. Kết quả đạt được: Đóng góp của đề tài về mặt lý thuyết hệ thống thông tin và ứng dụng thương mại điện tử thực tiễn.\n2. Bài học kinh nghiệm: Kỹ năng phân tích thiết kế hệ thống phân tán, xử lý dữ liệu đặc tả phần cứng phức tạp.\n3. Hướng phát triển trong tương lai: Mở rộng sang ứng dụng di động (Mobile App), tích hợp Webhook đồng bộ tồn kho thời gian thực với các nhà phân phối linh kiện lớn, nâng cấp AI Agent tự động đàm phán giá.',
     'Chương 5 của MauBaoCaoThamKhao.docx, docs/PRODUCTION_ROADMAP.md', 'Cần làm'),
    (11, 'TASK-11', 'P2 (Hình thức/Học thuật)', 'Chuẩn hóa Trang bìa & Phiếu nhận xét GV',
     '1. Bổ sung đầy đủ Họ tên và Mã số sinh viên (MSSV) của 2 thành viên nhóm vào bìa chính và bìa phụ.\n2. Thiết kế khung viền trang bìa ngoài theo chuẩn mẫu đồ án tốt nghiệp của IUH.\n3. Thay thế các dòng tab trống ở trang Nhận xét của GVHD và GVPB bằng bảng tiêu chí đánh giá chuẩn bao gồm: Tiêu chí chấm điểm, Điểm số, Nhận xét chi tiết, Ngày tháng và Chữ ký.',
     'Trang bìa và các trang phiếu nhận xét từ MauBaoCaoThamKhao.docx', 'Cần làm'),
    (12, 'TASK-12', 'P2 (Hình thức/Học thuật)', 'Bổ sung Lời cam đoan & Chỉnh đại từ xưng hô',
     '1. Bổ sung trang Lời cam đoan (cam kết công trình nghiên cứu trung thực, không sao chép trái phép).\n2. Rà soát Lời cảm ơn và toàn bộ báo cáo: sửa đại từ xưng hô từ "em" thành "chúng em" (do đề tài gồm 2 sinh viên thực hiện).',
     'Trang Lời cam đoan từ MauBaoCaoThamKhao.docx', 'Cần làm'),
    (13, 'TASK-13', 'P2 (Hình thức/Học thuật)', 'Cấu hình Header, Footer & Đánh số trang chuẩn',
     '1. Cấu hình Header hiển thị tên đề tài hoặc tên chương hiện tại.\n2. Cấu hình Footer hiển thị tên sinh viên nhóm + Số trang tự động.\n3. Ngắt Section trong MS Word: Đánh số trang La Mã (i, ii, iii,...) cho phần đầu (từ Lời cảm ơn đến Danh mục viết tắt); Đánh số Ả Rập (1, 2, 3,...) bắt đầu từ trang đầu tiên của Chương 1.',
     'Cấu hình Sections & Margins từ MauBaoCaoThamKhao.docx (Top: 3cm, Bottom: 3cm, Left: 3.5cm, Right: 2cm)', 'Cần làm'),
    (14, 'TASK-14', 'P2 (Hình thức/Học thuật)', 'Lập Bảng Danh mục các thuật ngữ viết tắt',
     'Xây dựng bảng danh mục thuật ngữ gồm 3 cột (Từ viết tắt, Cụm từ tiếng Anh nguyên bản, Ý nghĩa tiếng Việt) cho toàn bộ các từ viết tắt: CPU, GPU, RAM, PSU, TDP, SSD, HDD, PCIe, XAI, DSS, AI, REST, API, JWT, RBAC, ORM, UI, UX, CI/CD, SDLC, UML, ERD,...',
     'Thuật ngữ kỹ thuật xuất hiện trong báo cáo và source code', 'Cần làm'),
    (15, 'TASK-15', 'P2 (Hình thức/Học thuật)', 'Tạo Mục lục, Danh mục hình và bảng tự động',
     '1. Áp dụng chuẩn Heading 1, 2, 3 xuyên suốt để tạo Table of Contents (Mục lục) tự động.\n2. Sử dụng tính năng Caption cho toàn bộ hình ảnh (Hình X.Y) và bảng biểu (Bảng X.Y) để sinh tự động Danh mục hình ảnh và Danh mục bảng biểu chính xác theo số trang.',
     'Tính năng References -> Table of Contents / Insert Table of Figures trong MS Word', 'Cần làm'),
    (16, 'TASK-16', 'P2 (Hình thức/Học thuật)', 'Xây dựng Danh mục Tài liệu tham khảo chuẩn',
     'Liệt kê tối thiểu 15-20 tài liệu tham khảo theo quy chuẩn học thuật (IEEE hoặc APA):\n- Sách/giáo trình Phân tích thiết kế hệ thống thông tin, Cơ sở dữ liệu.\n- Tài liệu đặc tả kỹ thuật và whitepapers phần cứng của Intel, AMD, NVIDIA, JEDEC.\n- Tài liệu hướng dẫn chính thức của React, Express, Prisma, Docker, OWASP Top 10.',
     'Mục Tài liệu tham khảo cuối file MauBaoCaoThamKhao.docx', 'Cần làm')
]

p0_fill = PatternFill(start_color='FCE4D6', end_color='FCE4D6', fill_type='solid')
p0_font = Font(name='Segoe UI', size=9, bold=True, color='C00000')

p1_fill = PatternFill(start_color='FFF2CC', end_color='FFF2CC', fill_type='solid')
p1_font = Font(name='Segoe UI', size=9, bold=True, color='B25900')

p2_fill = PatternFill(start_color='E2EFDA', end_color='E2EFDA', fill_type='solid')
p2_font = Font(name='Segoe UI', size=9, bold=True, color='375623')

cell_font = Font(name='Segoe UI', size=9, color='262626')
cell_font_bold = Font(name='Segoe UI', size=9, bold=True, color='262626')

border_cell = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

start_row = 6
for idx, (stt, code, prio, name, desc, src, status) in enumerate(tasks):
    r = start_row + idx
    ws.row_dimensions[r].height = 45 if len(desc) < 160 else 65
    
    ws.cell(row=r, column=1, value=stt).alignment = Alignment(horizontal='center', vertical='center')
    ws.cell(row=r, column=2, value=code).alignment = Alignment(horizontal='center', vertical='center')
    
    prio_cell = ws.cell(row=r, column=3, value=prio)
    prio_cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    if 'P0' in prio:
        prio_cell.fill = p0_fill
        prio_cell.font = p0_font
    elif 'P1' in prio:
        prio_cell.fill = p1_fill
        prio_cell.font = p1_font
    else:
        prio_cell.fill = p2_fill
        prio_cell.font = p2_font

    name_cell = ws.cell(row=r, column=4, value=name)
    name_cell.font = cell_font_bold
    name_cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)

    desc_cell = ws.cell(row=r, column=5, value=desc)
    desc_cell.font = cell_font
    desc_cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)

    src_cell = ws.cell(row=r, column=6, value=src)
    src_cell.font = Font(name='Segoe UI', size=8.5, italic=True, color='404040')
    src_cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)

    stat_cell = ws.cell(row=r, column=7, value=status)
    stat_cell.font = Font(name='Segoe UI', size=9, bold=True, color='7F6000')
    stat_cell.fill = PatternFill(start_color='FFF9E6', end_color='FFF9E6', fill_type='solid')
    stat_cell.alignment = Alignment(horizontal='center', vertical='center')

    for c in range(1, 8):
        c_cell = ws.cell(row=r, column=c)
        c_cell.border = border_cell
        if c in [1, 2]:
            c_cell.font = cell_font_bold

col_widths = {
    'A': 6,
    'B': 13,
    'C': 16,
    'D': 28,
    'E': 55,
    'F': 35,
    'G': 14
}

for col_l, w in col_widths.items():
    ws.column_dimensions[col_l].width = w

out_xlsx = r'T:\Khoa_luan\KLTN_NDH88_TaskList.xlsx'
wb.save(out_xlsx)
print(f'Saved XLSX successfully: {out_xlsx}')
