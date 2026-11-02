import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register Unicode fonts (Arial / Times New Roman from Windows)
pdfmetrics.registerFont(TTFont('Arial', r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold', r'C:\Windows\Fonts\arialbd.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Italic', r'C:\Windows\Fonts\ariali.ttf'))
pdfmetrics.registerFont(TTFont('Arial-BoldItalic', r'C:\Windows\Fonts\arialbi.ttf'))

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont('Arial', 8)
        self.setFillColor(colors.HexColor('#595959'))

        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(1.5 * cm, 20.2 * cm, "PC Mall – Kế hoạch hoàn thiện Khóa luận tốt nghiệp (NDH88)")
            self.drawRightString(28.2 * cm, 20.2 * cm, "ĐH Công nghiệp TP.HCM - Khoa CNTT")
            self.setStrokeColor(colors.HexColor('#D9D9D9'))
            self.setLineWidth(0.5)
            self.line(1.5 * cm, 20.0 * cm, 28.2 * cm, 20.0 * cm)

        # Footer
        footer_text = f"Trang {self._pageNumber} / {page_count}"
        self.drawString(1.5 * cm, 0.9 * cm, "Sinh viên: Hứa Minh Khương – Trịnh Công Tuyền | GVHD: TS. Ngô Hữu Dũng")
        self.drawRightString(28.2 * cm, 0.9 * cm, footer_text)
        self.setStrokeColor(colors.HexColor('#D9D9D9'))
        self.setLineWidth(0.5)
        self.line(1.5 * cm, 1.2 * cm, 28.2 * cm, 1.2 * cm)
        self.restoreState()

def create_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=15,
        leading=19,
        textColor=colors.HexColor('#1F4E79'),
        alignment=1, # Center
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Arial-Italic',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#404040'),
        alignment=1,
        spaceAfter=3
    )

    author_style = ParagraphStyle(
        'DocAuthor',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#262626'),
        alignment=1,
        spaceAfter=10
    )

    th_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
        alignment=1
    )

    td_center = ParagraphStyle(
        'TDCenter',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=8,
        leading=11,
        alignment=1
    )

    td_prio_p0 = ParagraphStyle(
        'TDPrioP0',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#C00000'),
        alignment=1
    )

    td_prio_p1 = ParagraphStyle(
        'TDPrioP1',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#B25900'),
        alignment=1
    )

    td_prio_p2 = ParagraphStyle(
        'TDPrioP2',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#375623'),
        alignment=1
    )

    td_name = ParagraphStyle(
        'TDName',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#1A1A1A')
    )

    td_desc = ParagraphStyle(
        'TDDesc',
        parent=styles['Normal'],
        fontName='Arial',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#262626')
    )

    td_source = ParagraphStyle(
        'TDSource',
        parent=styles['Normal'],
        fontName='Arial-Italic',
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor('#555555')
    )

    td_status = ParagraphStyle(
        'TDStatus',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#7F6000'),
        alignment=1
    )

    elements = []

    # Title Banner
    elements.append(Paragraph("KẾ HOẠCH & DANH MỤC CÔNG VIỆC HOÀN THIỆN BÁO CÁO KHÓA LUẬN TỐT NGHIỆP", title_style))
    elements.append(Paragraph("Đề tài: Hệ thống thương mại điện tử linh kiện máy tính tích hợp Smart PC Builder và AI tư vấn cấu hình (PC Mall)", subtitle_style))
    elements.append(Paragraph("Sinh viên thực hiện: Hứa Minh Khương – Trịnh Công Tuyền  |  GVHD: TS. Ngô Hữu Dũng  |  Trường ĐH Công nghiệp TP.HCM (IUH)", author_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1F4E79'), spaceBefore=2, spaceAfter=8))

    # Table setup
    # Total available width = 29.7 - 3.0 = 26.7 cm
    col_widths = [1.0 * cm, 1.8 * cm, 2.5 * cm, 4.8 * cm, 9.8 * cm, 5.2 * cm, 1.6 * cm]

    headers = [
        Paragraph("STT", th_style),
        Paragraph("Mã", th_style),
        Paragraph("Độ ưu tiên", th_style),
        Paragraph("Hạng mục công việc", th_style),
        Paragraph("Mô tả chi tiết & Hướng dẫn triển khai", th_style),
        Paragraph("Nguồn dữ liệu dự án", th_style),
        Paragraph("Trạng thái", th_style)
    ]

    table_data = [headers]

    raw_tasks = [
        # P0
        (1, 'TASK-01', 'P0 (Khẩn cấp)', 'Thống nhất cấu trúc chương báo cáo',
         'Thống nhất lựa chọn cấu trúc 5 chương chuẩn của Khoa CNTT - IUH (như MauBaoCaoThamKhao) hoặc giữ 8 chương theo đề cương GVHD TS. Ngô Hữu Dũng. Khuyến nghị chuẩn 5 chương để đảm bảo tính chuẩn mực học thuật của Khoa.',
         'Đề cương KLTN, phản hồi từ GVHD', 'Cần làm'),
        (2, 'TASK-02', 'P0 (Khẩn cấp)', 'Thiết kế Cơ sở dữ liệu & Data Dictionary',
         'Trình bày sơ đồ quan hệ thực thể (ERD), mô hình dữ liệu quan hệ, và lập bảng Từ điển dữ liệu (Data Dictionary) chi tiết cho các thực thể cốt lõi: Users, Roles, Categories, Products, Specifications, Compatibility_Rules, Builds, Orders, Order_Items, Tickets, Shipments.',
         'docs/03-database/cnm_ecommerce_full_setup.sql, database/prisma/schema.prisma, docs/03-database/README.md', 'Cần làm'),
        (3, 'TASK-03', 'P0 (Khẩn cấp)', 'Vẽ và đặc tả hệ thống biểu đồ UML',
         '1. Sơ đồ Use Case tổng quát toàn hệ thống.<br/>2. Phân rã Use Case theo 5 Actor (Guest, Customer, Staff, Tech, Admin).<br/>3. Sơ đồ Activity Diagram: luồng Build PC & xử lý tập luật, luồng tư vấn cấu hình AI Advisor, luồng đặt hàng thanh toán.<br/>4. Sơ đồ Sequence Diagram cho các tương tác nghiệp vụ phức tạp.',
         'docs/01-requirements/README.md, docs/02-architecture/README.md, docs/ROUTES_AUDIT.md', 'Cần làm'),
        (4, 'TASK-04', 'P0 (Khẩn cấp)', 'Lập bảng Đặc tả Use Case chi tiết',
         'Soạn bảng đặc tả theo chuẩn IUH (Tên UC, Actor, Mục tiêu, Tiền/Hậu điều kiện, Luồng chính, Luồng ngoại lệ) cho 8 Use Case trọng tâm: Đăng ký/Đăng nhập, Tìm kiếm/Lọc linh kiện, Smart PC Builder kiểm tra tương thích, AI tư vấn cấu hình, Đặt hàng & Thanh toán, Quản lý đơn hàng, Admin cấu hình tập luật tương thích, Kỹ thuật viên xử lý bảo hành.',
         'docs/CUSTOMER_DEMO_100.md, docs/ADMIN_DEMO_100.md, docs/STAFF_DEMO_100.md, docs/TECH_DEMO_100.md', 'Cần làm'),
        (5, 'TASK-05', 'P0 (Khẩn cấp)', 'Chụp ảnh minh họa & Thuyết minh giao diện',
         'Chụp ảnh màn hình thực tế giao diện ứng dụng web (apps/web) kèm số hiệu Hình X.Y và phân tích chức năng:<br/>- Giao diện Trang chủ, Catalog linh kiện & Bộ lọc thông số kỹ thuật.<br/>- Giao diện Smart PC Builder (chọn linh kiện, hiển thị điểm Build Health, cảnh báo Blocker/Warning/Advisory).<br/>- Giao diện Chatbot / AI Configuration Advisor (hội thoại, đề xuất 3 cấu hình).<br/>- Giao diện Giỏ hàng, Đặt hàng & Thanh toán.<br/>- Dashboard Quản trị Admin (quản lý sản phẩm, đơn hàng, cấu hình Rules).',
         'apps/web/src/pages/ (Chạy dự án frontend để chụp ảnh màn hình sắc nét)', 'Cần làm'),
        (6, 'TASK-06', 'P0 (Khẩn cấp)', 'Xây dựng Bảng Kịch bản Kiểm thử (Test Cases)',
         'Soạn bảng kiểm thử chất lượng phần mềm theo mẫu chuẩn IUH (Test ID, Tên chức năng, Tiền điều kiện, Dữ liệu đầu vào, Các bước thực hiện, Kết quả mong đợi, Kết quả thực tế, Đánh giá Pass/Fail):<br/>- Test cases chức năng Xác thực (Auth) & Phân quyền (RBAC).<br/>- Test cases kiểm tra tập luật tương thích Smart PC Builder (Socket, Form Factor, Wattage, RAM DDR).<br/>- Test cases xử lý luồng AI Advisor & bảo mật chống Prompt Injection.<br/>- Test cases Đặt hàng & Xử lý trạng thái giao dịch.',
         'docs/06-testing/README.md, docs/TESTING_GUIDE_DETAILED.md, docs/audit/TESTING_AND_PRODUCTION_READINESS.md', 'Cần làm'),

        # P1
        (7, 'TASK-07', 'P1 (Quan trọng)', 'Viết Cơ sở lý thuyết Công nghệ áp dụng',
         'Viết chi tiết các mục lý thuyết công nghệ thực tế đang sử dụng trong đồ án (định nghĩa, kiến trúc hoạt động, ưu điểm, lý do chọn và ứng dụng trong PC Mall):<br/>- Frontend: React 18, Vite, Tailwind CSS, Responsive Design.<br/>- Backend: Node.js, Express.js, TypeScript, RESTful API architecture.<br/>- Cơ sở dữ liệu: MySQL 8, Prisma ORM, kỹ thuật indexing & connection pool.<br/>- Xác thực & Phân quyền: JSON Web Token (JWT) stateless, Role-Based Access Control (RBAC).<br/>- Trí tuệ nhân tạo: OpenAI / LLM API, Prompt Engineering, XAI (Explainable AI).',
         'README.md, packages/shared/, services/api/src/, apps/web/src/', 'Cần làm'),
        (8, 'TASK-08', 'P1 (Quan trọng)', 'Soạn thảo Hiện thực & Triển khai hệ thống',
         'Trình bày chi tiết giải pháp kỹ thuật và triển khai:<br/>- Cấu trúc thư mục Monorepo (apps, services, packages, infra).<br/>- Môi trường phát triển và cấu hình biến môi trường (.env).<br/>- Đóng gói ứng dụng Containerization với Docker, Dockerfile và Docker Compose.<br/>- Cấu hình Reverse Proxy Nginx, quản lý routing và bảo mật mạng nội bộ.<br/>- Quy trình tự động hóa CI/CD với GitHub Actions (nếu có).',
         'DEPLOYMENT_GUIDE.md, docker-compose.yml, infra/docker/, docs/07-deployment/README.md', 'Cần làm'),
        (9, 'TASK-09', 'P1 (Quan trọng)', 'Viết nội dung Đánh giá & Thảo luận',
         '1. Đánh giá chức năng: So sánh các mục tiêu đã đề ra tại Chương 1 với kết quả hiện thực thực tế.<br/>2. Đánh giá hiệu năng: Thời gian phản hồi của Compatibility Engine (< 1.5s), hiệu suất truy vấn cơ sở dữ liệu.<br/>3. Thảo luận về ưu điểm: Cơ chế XAI minh bạch (Why this, Why not, What wrong, How to fix), tự động tính điểm Build Health.<br/>4. Hạn chế còn tồn tại: Mức độ bao phủ của bộ quy tắc phần cứng, cơ chế đồng bộ giá nhà phân phối.',
         'docs/audit/PROJECT_AUDIT_SUMMARY.md, docs/audit/MODULE_COMPLETION_MATRIX.md, docs/audit/ISSUES_AND_REMEDIATION_PLAN.md', 'Cần làm'),
        (10, 'TASK-10', 'P1 (Quan trọng)', 'Soạn thảo Kết luận & Hướng phát triển',
         '1. Kết quả đạt được: Đóng góp của đề tài về mặt lý thuyết hệ thống thông tin và ứng dụng thương mại điện tử thực tiễn.<br/>2. Bài học kinh nghiệm: Kỹ năng phân tích thiết kế hệ thống phân tán, xử lý dữ liệu đặc tả phần cứng phức tạp.<br/>3. Hướng phát triển trong tương lai: Mở rộng sang ứng dụng di động (Mobile App), tích hợp Webhook đồng bộ tồn kho thời gian thực với các nhà phân phối linh kiện lớn, nâng cấp AI Agent tự động đàm phán giá.',
         'Chương 5 của MauBaoCaoThamKhao.docx, docs/PRODUCTION_ROADMAP.md', 'Cần làm'),

        # P2
        (11, 'TASK-11', 'P2 (Hình thức)', 'Chuẩn hóa Trang bìa & Phiếu nhận xét GV',
         '1. Bổ sung đầy đủ Họ tên và Mã số sinh viên (MSSV) của 2 thành viên nhóm vào bìa chính và bìa phụ.<br/>2. Thiết kế khung viền trang bìa ngoài theo chuẩn mẫu đồ án tốt nghiệp của IUH.<br/>3. Thay thế các dòng tab trống ở trang Nhận xét của GVHD và GVPB bằng bảng tiêu chí đánh giá chuẩn bao gồm: Tiêu chí chấm điểm, Điểm số, Nhận xét chi tiết, Ngày tháng và Chữ ký.',
         'Trang bìa và các trang phiếu nhận xét từ MauBaoCaoThamKhao.docx', 'Cần làm'),
        (12, 'TASK-12', 'P2 (Hình thức)', 'Bổ sung Lời cam đoan & Chỉnh đại từ xưng hô',
         '1. Bổ sung trang Lời cam đoan (cam kết công trình nghiên cứu trung thực, không sao chép trái phép).<br/>2. Rà soát Lời cảm ơn và toàn bộ báo cáo: sửa đại từ xưng hô từ "em" thành "chúng em" (do đề tài gồm 2 sinh viên thực hiện).',
         'Trang Lời cam đoan từ MauBaoCaoThamKhao.docx', 'Cần làm'),
        (13, 'TASK-13', 'P2 (Hình thức)', 'Cấu hình Header, Footer & Đánh số trang chuẩn',
         '1. Cấu hình Header hiển thị tên đề tài hoặc tên chương hiện tại.<br/>2. Cấu hình Footer hiển thị tên sinh viên nhóm + Số trang tự động.<br/>3. Ngắt Section trong MS Word: Đánh số trang La Mã (i, ii, iii,...) cho phần đầu (từ Lời cảm ơn đến Danh mục viết tắt); Đánh số Ả Rập (1, 2, 3,...) bắt đầu từ trang đầu tiên của Chương 1.',
         'Cấu hình Sections & Margins từ MauBaoCaoThamKhao.docx (Top: 3cm, Bottom: 3cm, Left: 3.5cm, Right: 2cm)', 'Cần làm'),
        (14, 'TASK-14', 'P2 (Hình thức)', 'Lập Bảng Danh mục các thuật ngữ viết tắt',
         'Xây dựng bảng danh mục thuật ngữ gồm 3 cột (Từ viết tắt, Cụm từ tiếng Anh nguyên bản, Ý nghĩa tiếng Việt) cho toàn bộ các từ viết tắt: CPU, GPU, RAM, PSU, TDP, SSD, HDD, PCIe, XAI, DSS, AI, REST, API, JWT, RBAC, ORM, UI, UX, CI/CD, SDLC, UML, ERD,...',
         'Thuật ngữ kỹ thuật xuất hiện trong báo cáo và source code', 'Cần làm'),
        (15, 'TASK-15', 'P2 (Hình thức)', 'Tạo Mục lục, Danh mục hình và bảng tự động',
         '1. Áp dụng chuẩn Heading 1, 2, 3 xuyên suốt để tạo Table of Contents (Mục lục) tự động.<br/>2. Sử dụng tính năng Caption cho toàn bộ hình ảnh (Hình X.Y) và bảng biểu (Bảng X.Y) để sinh tự động Danh mục hình ảnh và Danh mục bảng biểu chính xác theo số trang.',
         'Tính năng References -> Table of Contents / Insert Table of Figures trong MS Word', 'Cần làm'),
        (16, 'TASK-16', 'P2 (Hình thức)', 'Xây dựng Danh mục Tài liệu tham khảo chuẩn',
         'Liệt kê tối thiểu 15-20 tài liệu tham khảo theo quy chuẩn học thuật (IEEE hoặc APA):<br/>- Sách/giáo trình Phân tích thiết kế hệ thống thông tin, Cơ sở dữ liệu.<br/>- Tài liệu đặc tả kỹ thuật và whitepapers phần cứng của Intel, AMD, NVIDIA, JEDEC.<br/>- Tài liệu hướng dẫn chính thức của React, Express, Prisma, Docker, OWASP Top 10.',
         'Mục Tài liệu tham khảo cuối file MauBaoCaoThamKhao.docx', 'Cần làm')
    ]

    t_style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D9D9D9')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#1F4E79')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]

    for idx, (stt, code, prio, name, desc, src, status) in enumerate(raw_tasks, start=1):
        if 'P0' in prio:
            prio_p = Paragraph(prio, td_prio_p0)
            prio_bg = colors.HexColor('#FCE4D6')
        elif 'P1' in prio:
            prio_p = Paragraph(prio, td_prio_p1)
            prio_bg = colors.HexColor('#FFF2CC')
        else:
            prio_p = Paragraph(prio, td_prio_p2)
            prio_bg = colors.HexColor('#E2EFDA')

        row_cells = [
            Paragraph(str(stt), td_center),
            Paragraph(code, td_center),
            prio_p,
            Paragraph(name, td_name),
            Paragraph(desc, td_desc),
            Paragraph(src, td_source),
            Paragraph(status, td_status)
        ]
        table_data.append(row_cells)

        t_style_cmds.append(('BACKGROUND', (2, idx), (2, idx), prio_bg))
        t_style_cmds.append(('BACKGROUND', (6, idx), (6, idx), colors.HexColor('#FFF9E6')))
        if idx % 2 == 0:
            t_style_cmds.append(('BACKGROUND', (3, idx), (5, idx), colors.HexColor('#F9FAFB')))

    task_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    task_table.setStyle(TableStyle(t_style_cmds))
    elements.append(task_table)

    doc.build(elements, canvasmaker=NumberedCanvas)
    print(f"Generated PDF successfully: {output_path}")

if __name__ == '__main__':
    create_pdf(r"T:\Khoa_luan\KLTN_NDH88_TaskList.pdf")
