import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { cancelMockPayment, confirmMockPayment } from "../../services/order.service";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

const MOCK_CARDS = [
  { number: "9704198526191432198", name: "NGUYEN VAN A", bank: "NCB", label: "NCB Test Card" },
  { number: "9704195798459170488", name: "NGUYEN VAN A", bank: "NCB", label: "NCB Test Card 2" }
];

const timeline = ["Tạo yêu cầu", "Xác thực sandbox", "Cập nhật đơn hàng"];

export function MockPaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");
  const [status, setStatus] = useState("pending");
  const [selectedCard, setSelectedCard] = useState(MOCK_CARDS[0].number);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedCardInfo = useMemo(
    () => MOCK_CARDS.find((card) => card.number === selectedCard) || MOCK_CARDS[0],
    [selectedCard]
  );

  async function handlePay() {
    if (!orderId || status === "paying" || status === "cancelling") return;

    try {
      setStatus("paying");
      setErrorMessage("");
      await confirmMockPayment(orderId);
      setStatus("success");
      window.setTimeout(() => {
        navigate(`/payment/result?success=true&orderId=${orderId}&status=payment_success`, { replace: true });
      }, 1200);
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error?.response?.data?.message || error.message || "Không thể xác nhận thanh toán mô phỏng");
    }
  }

  async function handleCancel() {
    if (!orderId || status === "paying" || status === "cancelling") return;

    try {
      setStatus("cancelling");
      setErrorMessage("");
      await cancelMockPayment(orderId);
      navigate(`/payment/result?success=false&orderId=${orderId}&reason=user_cancelled`, {
        replace: true,
        state: { paymentStatus: "payment_cancelled", orderId }
      });
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error?.response?.data?.message || error.message || "Không thể hủy giao dịch mô phỏng");
    }
  }

  if (!orderId) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 520, padding: 28, borderRadius: 24, background: "#fff", border: "1px solid #e2e8f0", textAlign: "center" }}>
          <h1 style={{ margin: "0 0 10px", fontSize: 26 }}>Không tìm thấy giao dịch</h1>
          <p style={{ color: "#64748b", margin: "0 0 20px" }}>Liên kết thanh toán thiếu mã đơn hàng hợp lệ.</p>
          <Link to="/" style={{ color: "#0055c4", fontWeight: 800, textDecoration: "none" }}>Về trang chủ</Link>
        </div>
      </div>
    );
  }

  const isBusy = status === "paying" || status === "cancelling";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #eef4ff 0%, #f8fafc 48%, #e8f7ff 100%)", padding: "32px 18px", display: "grid", placeItems: "center" }}>
      <style>{`
        @keyframes mockSpin { to { transform: rotate(360deg); } }
        .mock-shell { width: min(1080px, 100%); display: grid; grid-template-columns: minmax(0, 1.1fr) 390px; gap: 22px; align-items: stretch; }
        .mock-card { background: rgba(255, 255, 255, 0.92); border: 1px solid rgba(148, 163, 184, 0.24); border-radius: 28px; box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12); overflow: hidden; }
        .mock-spinner { animation: mockSpin 0.8s linear infinite; }
        .mock-test-card { display: flex; gap: 14px; align-items: center; width: 100%; padding: 15px; border-radius: 18px; border: 1.5px solid #e2e8f0; background: #fff; cursor: pointer; text-align: left; transition: all 0.18s ease; }
        .mock-test-card:hover:not(:disabled) { transform: translateY(-1px); border-color: #0055c4; box-shadow: 0 12px 24px rgba(0, 85, 196, 0.1); }
        .mock-test-card.selected { border-color: #0055c4; background: #eff6ff; }
        .mock-test-card:disabled { opacity: 0.66; cursor: not-allowed; }
        .mock-actions { display: grid; grid-template-columns: 1fr 1.35fr; gap: 12px; }
        @media (max-width: 880px) { .mock-shell { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .mock-actions { grid-template-columns: 1fr; } .mock-card-main { padding: 22px !important; } }
      `}</style>

      <div className="mock-shell">
        <section className="mock-card">
          <div style={{ padding: "26px 30px", background: "linear-gradient(135deg, #003687, #0055c4)", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ background: "#fff", color: "#003687", borderRadius: 10, padding: "7px 12px", fontSize: 24, fontWeight: 950, letterSpacing: 0.5 }}>VNPAY</div>
              <div>
                <div style={{ fontWeight: 900 }}>Sandbox Payment Gateway</div>
                <div style={{ fontSize: 13, opacity: 0.78 }}>Môi trường mô phỏng tích hợp thanh toán</div>
              </div>
              <div style={{ marginLeft: "auto", background: "#f97316", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 900 }}>MOCK ONLY</div>
            </div>
          </div>

          <div className="mock-card-main" style={{ padding: 30, display: "grid", gap: 22 }}>
            <div style={{ padding: 16, borderRadius: 18, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontWeight: 750, lineHeight: 1.55 }}>
              Đây là môi trường mô phỏng VNPay Sandbox của PC Mall. Không có giao dịch ngân hàng thật, không trừ tiền và không gửi yêu cầu thanh toán ra hệ thống VNPay thật.
            </div>

            {status === "success" ? (
              <div style={{ textAlign: "center", padding: "36px 0" }}>
                <div style={{ width: 74, height: 74, borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "grid", placeItems: "center", margin: "0 auto 18px", fontSize: 34, fontWeight: 950 }}>✓</div>
                <h1 style={{ margin: "0 0 8px", fontSize: 28, color: "#14532d" }}>Thanh toán mô phỏng thành công</h1>
                <p style={{ margin: 0, color: "#64748b", fontWeight: 650 }}>Đơn hàng đã được cập nhật trạng thái đã thanh toán. Đang chuyển về trang đặt hàng thành công...</p>
              </div>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: 13, color: "#64748b", fontWeight: 900, marginBottom: 10 }}>Chọn thẻ test</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_CARDS.map((card) => (
                      <button
                        key={card.number}
                        type="button"
                        disabled={isBusy}
                        onClick={() => setSelectedCard(card.number)}
                        className={`mock-test-card ${selectedCard === card.number ? "selected" : ""}`}
                      >
                        <span style={{ width: 48, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #003687, #0074d9)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <span style={{ width: 24, height: 15, borderRadius: 4, background: "#facc15" }} />
                        </span>
                        <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                          <strong style={{ color: "#0f172a" }}>{card.label}</strong>
                          <small style={{ color: "#64748b", fontWeight: 700 }}>**** **** **** {card.number.slice(-4)} - {card.name}</small>
                        </span>
                        <span style={{ marginLeft: "auto", width: 24, height: 24, borderRadius: "50%", border: "1.5px solid #0055c4", background: selectedCard === card.number ? "#0055c4" : "#fff", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900 }}>{selectedCard === card.number ? "✓" : ""}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {errorMessage ? (
                  <div style={{ padding: 14, borderRadius: 16, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontWeight: 800 }}>{errorMessage}</div>
                ) : null}

                <div className="mock-actions">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isBusy}
                    style={{ minHeight: 54, borderRadius: 16, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 900, cursor: isBusy ? "not-allowed" : "pointer" }}
                  >
                    {status === "cancelling" ? "Đang hủy..." : "Hủy giao dịch"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={isBusy}
                    style={{ minHeight: 54, borderRadius: 16, border: "none", background: isBusy ? "#93c5fd" : "linear-gradient(135deg, #003687, #0055c4)", color: "#fff", fontWeight: 950, cursor: isBusy ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}
                  >
                    {status === "paying" ? <span className="mock-spinner" style={{ width: 18, height: 18, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.38)", borderTopColor: "#fff" }} /> : null}
                    {status === "paying" ? "Đang xác nhận..." : `Thanh toán ${formatCurrency(amount)} VND`}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="mock-card" style={{ padding: 26, display: "grid", gap: 22, alignContent: "start" }}>
          <div>
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 900, marginBottom: 8 }}>Số tiền thanh toán</div>
            <div style={{ fontSize: 36, fontWeight: 950, color: "#003687", letterSpacing: "-0.04em" }}>{formatCurrency(amount)} <span style={{ fontSize: 16 }}>VND</span></div>
          </div>

          <div style={{ display: "grid", gap: 12, padding: 16, borderRadius: 18, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <InfoRow label="Mã đơn hàng" value={`#${orderId}`} />
            <InfoRow label="Ngân hàng test" value={selectedCardInfo.bank} />
            <InfoRow label="Trạng thái" value={status === "paying" ? "Đang xử lý" : status === "cancelling" ? "Đang hủy" : "Chờ xác nhận"} />
          </div>

          <div>
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 900, marginBottom: 12 }}>Quy trình sandbox</div>
            <div style={{ display: "grid", gap: 12 }}>
              {timeline.map((item, index) => (
                <div key={item} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: index === 2 && status === "pending" ? "#e2e8f0" : "#dbeafe", color: "#0055c4", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 950 }}>{index + 1}</span>
                  <span style={{ color: "#334155", fontWeight: 800 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
      <span style={{ color: "#64748b", fontWeight: 750 }}>{label}</span>
      <strong style={{ color: "#0f172a", textAlign: "right" }}>{value}</strong>
    </div>
  );
}
