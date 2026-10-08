import React from 'react';
import { useLocation, Link } from 'react-router-dom';

const infoContent = {
  '/about': {
    title: 'Về PC Mall - Hệ thống cố vấn lắp ráp PC hàng đầu',
    content: (
      <>
        <section>
          <h2 style={{ color: 'var(--market-primary)', borderBottom: '2px solid #eee', paddingBottom: 10 }}>Tầm nhìn của chúng tôi</h2>
          <p>Dự án <strong>PC Mall</strong> không chỉ là một cửa hàng linh kiện trực tuyến đơn thuần. Đây là nền tảng công nghệ cao được phát triển với sứ mệnh <strong>"Đưa kiến thức chuyên gia đến tay mọi game thủ"</strong>.</p>
          <p>Chúng tôi tập trung vào việc giải quyết khó khăn lớn nhất của người dùng khi tự build PC: <strong>Sự tương thích và sự tối ưu</strong>. Nhờ vào hệ thống cơ sở dữ liệu khổng lồ và trí tuệ nhân tạo, PC Mall giúp bạn đưa ra những quyết định sáng suốt nhất cho ngân sách của mình.</p>
        </section>

        <section style={{ marginTop: 40 }}>
          <h2 style={{ color: 'var(--market-primary)', borderBottom: '2px solid #eee', paddingBottom: 10 }}>Đội ngũ sáng lập</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
            <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12 }}>
              <h3 style={{ margin: '0 0 10px' }}>Hứa Minh Khương</h3>
              <p style={{ margin: 0, fontSize: 14 }}><strong>Lead Backend Developer</strong></p>
              <p style={{ marginTop: 10, fontSize: 14, color: '#666' }}>Chịu trách nhiệm kiến trúc cơ sở dữ liệu Prisma, tích hợp AI PC Advisor và hệ thống thanh toán VNPay an toàn.</p>
            </div>
            <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12 }}>
              <h3 style={{ margin: '0 0 10px' }}>Trịnh Công Tuyền</h3>
              <p style={{ margin: 0, fontSize: 14 }}><strong>Lead Frontend Developer</strong></p>
              <p style={{ marginTop: 10, fontSize: 14, color: '#666' }}>Xây dựng giao diện người dùng hiện đại, tối ưu hóa trải nghiệm PC Builder và hệ thống quản lý Dashboard chuyên nghiệp.</p>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 40 }}>
          <h2 style={{ color: 'var(--market-primary)', borderBottom: '2px solid #eee', paddingBottom: 10 }}>Cam kết chất lượng (3S)</h2>
          <ul>
            <li><strong>Select (Lọc)</strong>: Chỉ cung cấp linh kiện từ các hãng Tier-1 (Asus, Gigabyte, MSI, Corsair...).</li>
            <li><strong>Smart (Thông minh)</strong>: Hệ thống AI tự động phát hiện lỗi cổ chai (Bottle-neck) trong cấu hình của bạn.</li>
            <li><strong>Service (Dịch vụ)</strong>: Hỗ trợ kỹ thuật trọn đời và giao hàng hỏa tốc trong 2 giờ.</li>
          </ul>
        </section>
      </>
    )
  },
  '/help': {
    title: 'Trung tâm hỗ trợ khách hàng',
    content: (
      <>
        <section>
          <h2 style={{ color: 'var(--market-primary)' }}>1. Tài khoản và Bảo mật</h2>
          <div style={{ marginLeft: 20 }}>
            <h3>Làm sao để đăng ký tài khoản?</h3>
            <p>Nhấp vào nút "Đăng ký" ở góc trên bên phải, điền thông tin email và số điện thoại. Bạn có thể sử dụng tài khoản này để lưu cấu hình PC Builder đã chọn.</p>
            <h3>Tôi quên mật khẩu, phải làm thế nào?</h3>
            <p>Sử dụng chức năng "Quên mật khẩu" tại trang đăng nhập. Mã OTP sẽ được gửi về email để bạn thiết lập lại mật khẩu mới.</p>
          </div>
        </section>

        <section style={{ marginTop: 30 }}>
          <h2 style={{ color: 'var(--market-primary)' }}>2. Đặt hàng và Vận chuyển</h2>
          <div style={{ marginLeft: 20 }}>
            <h3>Thời gian giao hàng là bao lâu?</h3>
            <p>- Nội thành TP.HCM: Giao nhanh 2h - 4h.<br />- Các tỉnh thành khác: Từ 2 đến 4 ngày làm việc thông qua VNPost hoặc GHTK.</p>
            <h3>Chi phí vận chuyển tính như thế nào?</h3>
            <p>PC Mall miễn phí vận chuyển cho các đơn hàng build PC trọn bộ trên 15 triệu đồng.</p>
          </div>
        </section>

        <section style={{ marginTop: 30 }}>
          <h2 style={{ color: 'var(--market-primary)' }}>3. Đối với người dùng Build PC</h2>
          <div style={{ marginLeft: 20 }}>
            <h3>Hệ thống có báo lỗi nếu linh kiện không khớp không?</h3>
            <p>Có. Hệ thống PC Builder của chúng tôi sẽ báo đỏ nếu Mainboard không lắp được CPU đã chọn, hoặc nguồn không đủ công suất cho Card đồ họa.</p>
            <h3>Tôi có được hỗ trợ lắp ráp tại nhà không?</h3>
            <p>Có, kỹ thuật viên của PC Mall sẽ đến hỗ trợ lắp ráp và đi dây chuyên nghiệp cho các cấu hình trọn bộ tại TP.HCM (hoàn toàn miễn phí).</p>
          </div>
        </section>
      </>
    )
  },
  '/guide': {
    title: 'Hướng dẫn Demo 100% — Khách vãng lai',
    content: (
      <>
        <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #eff6ff)', padding: 25, borderRadius: 16, marginBottom: 30, border: '1px solid #bbf7d0' }}>
          <h2 style={{ margin: '0 0 12px', color: '#065f46' }}>Demo không cần đăng nhập</h2>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            Trước buổi demo, admin chạy: <code>npm run seed:guest-demo</code>. Sau đó mở trang chủ và làm lần lượt 5 bước dưới đây.
          </p>
        </div>

        <ol style={{ lineHeight: 2, paddingLeft: 24 }}>
          <li><Link to="/products"><strong>Danh mục & lọc</strong></Link> — chọn Socket LGA1700 hoặc Loại RAM DDR5, áp dụng bộ lọc.</li>
          <li><Link to="/compare"><strong>So sánh</strong></Link> — thêm 2–4 sản phẩm từ nút So sánh trên thẻ.</li>
          <li><Link to="/pc-builder"><strong>Build PC</strong></Link> — chọn linh kiện, kiểm tra tương thích, lưu trình duyệt, xuất file JSON.</li>
          <li><Link to="/ai-chat"><strong>AI tư vấn</strong></Link> — chat thử, F5 kiểm tra lịch sử, hoặc Gặp nhân viên.</li>
          <li><Link to="/register"><strong>Đăng ký</strong></Link> — form email hoặc Google (nhãn DEMO).</li>
        </ol>

        <div style={{ marginTop: 28, padding: 20, background: '#f8fafc', borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Ghi chú khi báo cáo</h3>
          <ul style={{ lineHeight: 1.9 }}>
            <li>Google Sign-In: tích hợp <strong>demo</strong>, không OAuth production.</li>
            <li>Cấu hình PC khách: lưu <strong>localStorage</strong> + import/export JSON.</li>
            <li>Chat AI khách: lưu lịch sử trên trình duyệt (tối đa 80 tin).</li>
          </ul>
        </div>
      </>
    )
  },
  '/warranty': {
    title: 'Chính sách bảo hành & Sửa chữa',
    content: (
      <>
        <section>
          <h2 style={{ color: 'var(--market-primary)' }}>1. Thời gian bảo hành tiêu chuẩn</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={{ padding: 12, border: '1px solid #ddd' }}>Linh kiện</th>
                <th style={{ padding: 12, border: '1px solid #ddd' }}>Thời gian</th>
                <th style={{ padding: 12, border: '1px solid #ddd' }}>Hình thức</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>CPU (Intel/AMD Box)</td>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>36 Tháng</td>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>1 đổi 1 mới</td>
              </tr>
              <tr>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>Card màn hình (NVIDIA/AMD)</td>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>36 Tháng</td>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>Sửa chữa/Đổi tương đương</td>
              </tr>
              <tr>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>Mainboard, RAM, SSD</td>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>36 - 60 Tháng</td>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>1 đổi 1 nhanh</td>
              </tr>
              <tr>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>Màn hình, Nguồn, Tản nhiệt</td>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>12 - 36 Tháng</td>
                <td style={{ padding: 12, border: '1px solid #ddd' }}>Chính hãng</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section style={{ marginTop: 30 }}>
          <h2 style={{ color: 'var(--market-primary)' }}>2. Điều kiện được bảo hành</h2>
          <ul>
            <li>Sản phẩm còn trong thời hạn bảo hành của PC Mall.</li>
            <li>Tem bảo hành và mã Serial Number phải còn nguyên vẹn, không có dấu hiệu tẩy xóa.</li>
            <li>Sản phẩm gặp lỗi do nhà sản xuất trong điều kiện sử dụng bình thường.</li>
          </ul>
        </section>

        <section style={{ marginTop: 30 }}>
          <h2 style={{ color: 'var(--market-danger)' }}>3. Các trường hợp từ chối bảo hành</h2>
          <ul>
            <li>Sản phẩm bị cháy nổ, rơi vỡ, biến dạng cơ học.</li>
            <li>Sản phẩm bị vào nước, côn trùng xâm nhập.</li>
            <li>Hỏng hóc do thiên tai, sét đánh hoặc sử dụng sai nguồn điện quy định.</li>
            <li>Đã can thiệp sửa chữa tự ý hoặc tại các trung tâm không ủy quyền.</li>
          </ul>
        </section>
      </>
    )
  },
  '/returns': {
    title: 'Chính sách đổi trả hàng hóa',
    content: (
      <>
        <h2 style={{ color: 'var(--market-primary)' }}>Cam kết 7 ngày dùng thử miễn phí</h2>
        <p>Để khách hàng hoàn toàn yên tâm, PC Mall áp dụng chính sách <strong>Lỗi là đổi trong vòng 7 ngày</strong> đối với các linh kiện phần cứng chủ chốt.</p>
        
        <h3>1. Đối với hàng lỗi do nhà sản xuất:</h3>
        <p>- PC Mall đổi mới sản phẩm tương tự cùng model, cùng phiên bản ngay lập tức.</p>
        <p>- Nếu sản phẩm đó đã hết hàng, bạn có thể đổi sang model khác và bù trừ chênh lệch giá, hoặc yêu cầu hoàn tiền 100%.</p>

        <h3>2. Đối với hàng đổi theo nhu cầu (không lỗi):</h3>
        <p>- Sản phẩm phải còn nguyên seal (nếu có), đầy đủ hộp và không có dấu hiệu đã sử dụng.</p>
        <p>- Phí đổi trả: 10% giá trị sản phẩm (để bù đắp chi phí vận hành và đóng gói lại).</p>

        <h3>3. Các sản phẩm KHÔNG được đổi trả:</h3>
        <ul>
          <li>Phần mềm bản quyền (Windows, Office...).</li>
          <li>Quà tặng đi kèm đơn hàng (Keycap, Pad chuột tặng kèm...).</li>
          <li>Các sản phẩm tiêu hao (Keo tản nhiệt đã mở nắp, khí nén...).</li>
        </ul>
      </>
    )
  },
  '/privacy': {
    title: 'Chính sách bảo mật thông tin',
    content: (
      <>
        <div style={{ marginBottom: 30 }}>
          <p><em>Ngày cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}</em></p>
          <p>PC Mall luôn coi trọng việc bảo mật thông tin cá nhân của bạn. Dưới đây là cách chúng tôi thu thập và xử lý dữ liệu.</p>
        </div>

        <h3>1. Những thông tin chúng tôi thu thập</h3>
        <p>Khi bạn đăng ký hoặc đặt hàng, chúng tôi cần các thông tin: Họ tên, Email, Số điện thoại hỗ trợ, Địa chỉ nhận hàng và Lịch sử các cấu hình PC bạn đã lưu.</p>

        <h3>2. Mục đích sử dụng thông tin</h3>
        <ul>
          <li>Để xử lý và giao đơn hàng của bạn.</li>
          <li>Gửi thông báo về tình trạng bảo hành và khuyến mãi dành riêng cho bạn.</li>
          <li>Cải thiện hệ thống tư vấn AI dựa trên nhu cầu khách hàng tổng quát.</li>
        </ul>

        <h3>3. Cam kết an toàn</h3>
        <p>Toàn bộ dữ liệu được lưu trữ trên máy chủ an toàn với công nghệ <strong>SSL Encryption</strong>. Chúng tôi không bao giờ bán hoặc cung cấp dữ liệu của bạn cho bất kỳ doanh nghiệp quảng cáo nào.</p>
      </>
    )
  },
  '/terms': {
    title: 'Điều khoản dịch vụ & Sử dụng',
    content: (
      <>
        <h2 style={{ color: 'var(--market-primary)' }}>Thỏa thuận giữa Người dùng và PC Mall</h2>
        <p>Chào mừng bạn sử dụng dịch vụ của PC Mall. Bằng việc truy cập hoặc mua sắm, bạn mặc nhiên đồng ý với các điều khoản dưới đây.</p>
        
        <h3>1. Giá cả và Hóa đơn</h3>
        <p>Giá hiển thị trên website đã bao gồm thuế VAT 10% (trừ khi có ghi chú khác). Chúng tôi cam kết bán đúng giá niiyết nhưng có quyền điều chỉnh khi thị trường linh kiện biến động bất thường (ví dụ: giá VGA tăng đột ngột).</p>

        <h3>2. Quy định thanh toán</h3>
        <p>Bạn phải hoàn thành nghĩa vụ thanh toán trước khi nhận hàng (đối với thanh toán online) hoặc chuẩn bị đủ tiền mặt để thanh toán COD. PC Mall có quyền hủy các đơn hàng ảo hoặc có dấu hiệu gian lận.</p>

        <h3>3. Bản quyền nội dung</h3>
        <p>Mọi hình ảnh, bài review linh kiện và mã nguồn của hệ thống PC Builder thuộc bản quyền của <strong>PC Mall Team (Hứa Minh Khương & Trịnh Công Tuyền)</strong>. Việc sao chép trái phép sẽ bị xử lý theo pháp luật.</p>
      </>
    )
  },
  '/jobs': {
    title: 'Cơ hội nghề nghiệp tại PC Mall',
    content: (
      <>
        <div style={{ background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', padding: '30px', borderRadius: 16, color: '#fff', marginBottom: 30 }}>
          <h2 style={{ margin: 0 }}>Gia nhập đội ngũ "Phù thủy PC"</h2>
          <p style={{ margin: '10px 0 0', opacity: 0.9 }}>Cùng chúng tôi định nghĩa lại cách thế giới tìm kiếm linh kiện công nghệ.</p>
        </div>

        <h3>Văn hóa tại PC Mall</h3>
        <p>Chúng tôi không có cấp bậc cứng nhắc. Tại đây, chỉ có sự đam mê với công nghệ. Khương và Bảo luôn sẵn sàng lắng nghe mọi ý tưởng cải tiến hệ thống từ những thành viên mới nhất.</p>

        <h3>Vị trí đang mở tuyển (Năm 2026):</h3>
        <div style={{ display: 'grid', gap: 15 }}>
          <div style={{ border: '1px solid #eee', padding: 20, borderRadius: 12 }}>
            <h4 style={{ margin: 0 }}>Expert PC Consultant (Tư vấn chuyên sâu)</h4>
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#666' }}>Yêu cầu: Nắm rõ benchmark của tất cả các dòng GPU/CPU mới nhất. Lương: 15tr - 25tr + Bonus.</p>
          </div>
          <div style={{ border: '1px solid #eee', padding: 20, borderRadius: 12 }}>
            <h4 style={{ margin: 0 }}>Full-stack Developer (React/Nodejs/Prisma)</h4>
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#666' }}>Yêu cầu: Có tư duy thuật toán tốt, ưu tiên các bạn từng build dự án e-commerce. Lương: Thỏa thuận cực hấp dẫn.</p>
          </div>
        </div>
        <p style={{ marginTop: 25 }}>Ứng tuyển ngay bằng cách gửi Profile đến: <strong>talents@pcmall.vn</strong></p>
      </>
    )
  },
  '/contact': {
    title: 'Liên hệ với PC Mall',
    content: (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40 }}>
          <div>
            <h2 style={{ color: 'var(--market-primary)' }}>Trụ sở chính</h2>
            <p><strong>Địa chỉ:</strong> Lầu 4, Tòa nhà Công Nghệ, Khu Công Nghệ Cao, Thành phố Thủ Đức, TP. Hồ Chí Minh.</p>
            <p><strong>Điện thoại:</strong> (028) 3868 9999</p>
            <p><strong>Hotline bán hàng:</strong> 1900 6868 (Phím 1)</p>
            <p><strong>Hỗ trợ kỹ thuật:</strong> 1900 6868 (Phím 2)</p>
            <p><strong>Email hợp tác kinh doanh:</strong> b2b@pcmall.vn</p>
          </div>
          <div style={{ background: '#f8fafc', padding: 25, borderRadius: 16 }}>
            <h3 style={{ margin: '0 0 15px' }}>Thời gian làm việc</h3>
            <ul style={{ padding: 0, listStyle: 'none' }}>
              <li style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>Thứ 2 - Thứ 6: 08:30 - 20:30</li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>Thứ 7 & CN: 09:00 - 21:00</li>
              <li style={{ padding: '8px 0', color: 'var(--market-danger)' }}>Lễ, Tết: Nghỉ theo quy định</li>
            </ul>
            <p style={{ marginTop: 15, fontSize: 13, color: '#666' }}>Hệ thống Chat AI hỗ trợ giải đáp kỹ thuật: <strong>Hoạt động 24/7</strong>.</p>
          </div>
        </div>
      </>
    )
  }
};

export function InformationPage() {
  const { pathname } = useLocation();
  const page = infoContent[pathname] || { 
    title: 'Trang đang cập nhật', 
    content: <p>Nội dung đang được soạn thảo. Vui lòng quay lại sau...</p> 
  };

  return (
    <div className="market-container" style={{ padding: '60px 0' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 14, color: 'var(--market-muted)', marginBottom: 16 }}>
          <Link to="/" style={{ color: 'var(--market-primary)', fontWeight: 600 }}>Trang chủ</Link>
          <span style={{ margin: '0 10px', opacity: 0.5 }}>/</span>
          <span style={{ color: '#4b5563' }}>{page.title}</span>
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 900, margin: 0, color: '#111827', letterSpacing: '-0.02em' }}>{page.title}</h1>
      </div>
      
      <div className="market-panel" style={{ 
        padding: '50px', 
        background: '#fff', 
        borderRadius: 24,
        boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
        border: '1px solid rgba(0,0,0,0.05)'
      }}>
        <div className="info-content-render" style={{ 
          lineHeight: 1.85, 
          fontSize: 17, 
          color: '#374151',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          {page.content}
        </div>
      </div>

      <div style={{ marginTop: 50, textAlign: 'center' }}>
        <Link to="/" className="market-btn market-btn--primary" style={{ height: 54, padding: '0 40px', borderRadius: 12 }}>
          Tiếp tục mua sắm tại PC Mall
        </Link>
      </div>
    </div>
  );
}
