import { Link } from "react-router-dom";

const columns = [
  {
    title: "Chăm sóc khách hàng",
    items: [
      { label: "Trung tâm trợ giúp", to: "/help" },
      { label: "Hướng dẫn đặt hàng", to: "/guide" },
      { label: "Chế độ bảo hành", to: "/warranty" },
      { label: "Chính sách đổi trả", to: "/returns" }
    ]
  },
  {
    title: "Về PC Mall",
    items: [
      { label: "Giới thiệu", to: "/about" },
      { label: "Tuyển dụng", to: "/jobs" },
      { label: "Chính sách bảo mật", to: "/privacy" },
      { label: "Điều khoản dịch vụ", to: "/terms" }
    ]
  },
  {
    title: "Thanh toán",
    items: [
      { label: "VNPay Sandbox", icon: "vnpay" },
      { label: "Tiền mặt (COD)", icon: "cod" },
      { label: "Chuyển khoản", icon: "bank" }
    ]
  },
  {
    title: "Theo dõi",
    items: [
      { label: "Facebook", to: "https://facebook.com" },
      { label: "YouTube", to: "https://youtube.com" },
      { label: "Hỗ trợ 24/7", to: "/contact" }
    ]
  }
];

export function Footer() {
  return (
    <footer className="market-footer">
      <div className="market-container market-footer__top">
        {/* Brand Column */}
        <div className="market-footer__brand" style={{ paddingRight: 20 }}>
          <div className="market-logo" style={{ marginBottom: 24 }}>
            <div className="market-logo__eyebrow" style={{ color: "#3b82f6" }}>PC Enthusiast</div>
            <div className="market-logo__text" style={{ fontSize: 36, color: "#ffffff" }}>PC Mall</div>
          </div>
          <p style={{ 
            fontSize: '14px', 
            lineHeight: 1.7, 
            color: 'rgba(255,255,255,0.5)',
            margin: 0
          }}>
            Hệ thống cung cấp linh kiện PC và cố vấn lắp ráp hàng đầu. Chúng tôi kết hợp giữa chuyên môn kỹ thuật và sức mạnh AI để mang lại cấu hình hoàn hảo cho bạn.
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <div className="market-footer__title">{column.title}</div>
            <div className="market-footer__list">
              {column.items.map((item) => (
                <span key={item.label}>
                   {item.to ? (
                     item.to.startsWith('http') ? (
                       <a href={item.to} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{item.label}</a>
                     ) : (
                       <Link to={item.to} style={{ color: "inherit", textDecoration: "none" }}>{item.label}</Link>
                     )
                   ) : (
                     item.label
                   )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="market-footer__bottom">
        <div className="market-container" style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '16px', color: '#ffffff', letterSpacing: '0.02em' }}>
            © {new Date().getFullYear()} PC Mall. Phát triển bởi: <span style={{ color: "var(--market-primary)" }}>Hứa Minh Khương</span> & <span style={{ color: "var(--market-primary)" }}>Trịnh Công Tuyền</span>.
          </p>
          <div style={{ 
            marginTop: 20, 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 20,
            opacity: 0.5
          }}>
             <span style={{ fontSize: '11px', border: '1px solid #fff', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>VNPAY</span>
             <span style={{ fontSize: '11px', border: '1px solid #fff', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>VISA</span>
             <span style={{ fontSize: '11px', border: '1px solid #fff', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>MASTERCARD</span>
             <span style={{ fontSize: '11px', border: '1px solid #fff', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>JCB</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

