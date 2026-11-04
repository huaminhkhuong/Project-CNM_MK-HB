import { Footer } from "../components/marketplace/Footer";
import { MainHeader } from "../components/marketplace/MainHeader";
import { TopBar } from "../components/marketplace/TopBar";
import { AiChatWidget } from "../components/chat/AiChatWidget";
import { Outlet, useLocation } from "react-router-dom";

export function PublicLayout() {
  const location = useLocation();
  const isBuilder = location.pathname.includes("pc-builder") || location.pathname.includes("pcbuilder");
  const isAiChat = location.pathname.includes("ai-chat") || location.pathname.includes("ai-advisor");

  return (
    <div className={`market-shell ${isAiChat ? "market-shell--aichat" : ""}`}>
      <div className="market-sticky">
        <TopBar />
        <MainHeader />
      </div>
      <main className={`market-main ${isAiChat ? "market-main--aichat" : ""}`}>
        <div className={isBuilder ? "market-container market-container--wide" : isAiChat ? "market-container market-container--aichat" : "market-container"}>
          <Outlet />
        </div>
      </main>
      {!isAiChat && <Footer />}
      {/* 🤖 Floating AI Widget — ẩn trên PC Builder và trang chuyên biệt AI Chat/Advisor */}
      {!isBuilder && !isAiChat && <AiChatWidget />}
      {isAiChat && (
        <style>{`
          .market-shell--aichat {
            height: 100vh;
            max-height: 100dvh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: #f1f5f9;
          }
          .market-main--aichat {
            flex: 1;
            min-height: 0;
            padding: 16px 20px 20px !important;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .market-container--aichat {
            flex: 1;
            min-height: 0;
            max-width: 1060px !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 auto !important;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
        `}</style>
      )}
    </div>
  );
}



