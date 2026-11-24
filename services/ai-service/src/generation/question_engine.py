import os
import json
import re
import requests
from typing import List, Dict, Any, Optional

# Regex nhận diện nội dung ngoài lề
OFF_TOPIC_PATTERN = re.compile(
    r"\b(nấu ăn|công thức|món ăn|chiên|xào|luộc|nướng|giải toán|bài tập|làm thơ|viết thơ|viết văn|soạn văn|xem bói|tử vi|cung hoàng đạo|phong thủy|tarot|xổ số|lô đề|đánh đề|soi cầu|đánh bạc|baccarat|kê đơn|chữa bệnh|khám bệnh|uống thuốc)\b",
    re.IGNORECASE
)

def check_input_guardrail(text: str) -> Dict[str, Any]:
    """Kiểm tra nội dung đầu vào."""
    cleaned = (text or "").strip()
    if len(cleaned) < 2 or OFF_TOPIC_PATTERN.search(cleaned):
        return {"is_valid": False, "is_off_topic": True}
    return {"is_valid": True, "is_off_topic": False}

def detect_domain(purpose: str) -> str:
    """Xác định lĩnh vực trọng tâm để khóa chặt phạm vi câu hỏi."""
    p_lower = purpose.lower()
    if any(k in p_lower for k in ["game", "gaming", "gta", "lol", "esports", "aaa", "fifa", "pubg", "valorant", "csgo", "cs2", "wukong", "chơi game"]):
        return "gaming"
    if any(k in p_lower for k in ["đồ họa", "video", "photoshop", "premiere", "edit", "render", "3d", "blender", "autocad", "thiết kế"]):
        return "editing"
    if any(k in p_lower for k in ["ai", "deep learning", "docker", "lập trình", "code", "python", "data", "machine learning"]):
        return "ai_programming"
    if any(k in p_lower for k in ["văn phòng", "kế toán", "office", "word", "excel", "bán hàng", "thu ngân", "nhập liệu", "power bi", "powerbi", "tableau", "sql", "dữ liệu"]):
        return "office"
    return "general"

def generate_dynamic_questions(
    purpose: str,
    budget: Optional[int] = 20000000,
    previous_answers: Optional[Dict[str, Any]] = None,
    step: int = 1
) -> Dict[str, Any]:
    """
    Sinh câu hỏi trắc nghiệm ĐỘNG 100% qua mô hình Gemini 3.5 Flash-Lite (với fallback 3.1 Flash-Lite).
    Tuân thủ nghiêm ngặt:
    1. ĐÚNG TRỌNG TÂM: Nhu cầu Gaming tuyệt đối không hỏi văn phòng/kế toán.
    2. NGÔN NGỮ PHỔ THÔNG: Dành cho người dùng phổ thông, không dùng từ ngữ kỹ thuật khó hiểu.
    3. KHÓA NGÂN SÁCH: Xoay quanh mức ngân sách của khách hàng (+-5%), không đẩy ngân sách lên cao.
    4. THÂN THIỆN: Khi đầu vào ngoài lề, tự động fallback sang bộ câu hỏi định hướng nhu cầu ban đầu thay vì chặn người dùng.
    """
    purpose_clean = (purpose or "Tư vấn cấu hình máy tính").strip()
    budget_val = int(budget) if budget and int(budget) > 0 else 20000000
    prev_ans = previous_answers or {}
    domain = detect_domain(purpose_clean)

    # 1. Kiểm tra guardrail: Nếu nhập nội dung ngoài lề thì fallback sang bộ câu hỏi khởi đầu thân thiện
    guard = check_input_guardrail(purpose_clean)
    if not guard["is_valid"]:
        return {
            "is_valid": True,
            "fallback_onboarding": True,
            "purpose": "Tư vấn cấu hình máy tính phù hợp",
            "title": "Chào bạn! Hãy cho PC Mall biết nhu cầu của bạn",
            "description": "Để gợi ý cấu hình tối ưu nhất cho bạn, vui lòng chọn nhanh các thông tin sau:",
            "step": 1,
            "total_steps": 2,
            "questions": [
                {
                    "id": "primary_purpose",
                    "label": "Mục đích sử dụng máy tính chính của bạn là gì?",
                    "type": "single_select",
                    "required": True,
                    "options": [
                        {"value": "gaming", "label": "🎮 Chơi Game giải trí (Esports như LMHT, Valorant, FO4 hoặc Game bom tấn 3D)"},
                        {"value": "office", "label": "💼 Học tập & Làm việc văn phòng (Word, Excel, duyệt web, kế toán, bán hàng)"},
                        {"value": "editing", "label": "🎬 Thiết kế đồ họa & Dựng video (Photoshop, Premiere, Canva, CapCut)"},
                        {"value": "ai_tech", "label": "💻 Lập trình phần mềm, chạy máy ảo hoặc Trí tuệ nhân tạo (AI)"}
                    ]
                },
                {
                    "id": "has_monitor",
                    "label": "Bạn đã có sẵn màn hình máy tính chưa?",
                    "type": "single_select",
                    "required": True,
                    "options": [
                        {"value": "already_have", "label": "Đã có sẵn màn hình (Toàn bộ ngân sách chỉ dành để mua thùng máy PC)"},
                        {"value": "need_monitor", "label": "Chưa có màn hình (Cần chia bớt ngân sách để mua thêm màn hình)"}
                    ]
                },
                {
                    "id": "workspace_size",
                    "label": "Không gian đặt máy tính của bạn như thế nào?",
                    "type": "single_select",
                    "options": [
                        {"value": "standard", "label": "Bàn làm việc tiêu chuẩn, thoải mái đặt thùng máy cỡ vừa"},
                        {"value": "compact", "label": "Góc bàn nhỏ gọn, cần thùng máy gọn gàng, tiết kiệm diện tích"}
                    ]
                }
            ]
        }

    # 2. Xây dựng hướng dẫn chuyên biệt theo từng Domain
    domain_guidelines = {
        "gaming": """- ĐÂY LÀ NHU CẦU CHƠI GAME (GAMING).
- TUYỆT ĐỐI KHÔNG HỎI CÁC CÂU VĂN PHÒNG, WORD, EXCEL, KẾ TOÁN, BÁN HÀNG.
- Tập trung vào:
  + Thể loại tựa game yêu thích (Game nhẹ/Esports như LMHT/Valorant/CS2 vs Game bom tấn thế giới mở đồ họa nặng như GTA V, Black Myth Wukong, Cyberpunk).
  + Trải nghiệm màn hình (Màn Full HD thông thường vs Màn hình 2K sắc nét).
  + Mức độ mượt mà (60 khung hình/giây phổ thông vs 144+ khung hình/giây cực mượt).
  + Bạn có thường vừa chơi game vừa livestream hoặc gọi Discord với bạn bè không?""",

        "office": """- ĐÂY LÀ NHU CẦU VĂN PHÒNG & HỌC TẬP.
- TUYỆT ĐỐI KHÔNG HỎI VỀ CARD MÀN HÌNH KHỦNG HOẶC GAME NẶNG.
- Tập trung vào:
  + Cường độ làm việc (Tác vụ nhẹ nhàng cơ bản vs Xử lý file dữ liệu lớn, nhiều tab trình duyệt).
  + Yêu cầu về độ êm ái khi chạy liên tục ban ngày / ban đêm.
  + Kích thước thùng máy gọn gàng cho bàn làm việc.""",

        "editing": """- ĐÂY LÀ NHU CẦU ĐỒ HỌA & DỰNG PHIM.
- Tập trung vào:
  + Phần mềm hay dùng (Photoshop/Illustrator 2D vs Premiere/CapCut dựng video vs Blender/AutoCAD 3D).
  + Độ phân giải video/ảnh cần làm việc (Full HD vs 4K).
  + Dung lượng lưu trữ dự án cần thiết.""",

        "ai_programming": """- ĐÂY LÀ NHU CẦU LẬP TRÌNH & AI.
- Tập trung vào:
  + Môi trường phát triển (Web/App thông thường vs Chạy Docker, máy ảo, mô hình AI/Machine Learning).
  + Dung lượng bộ nhớ RAM và Card đồ họa hỗ trợ xử lý dữ liệu.""",

        "general": """- Khảo sát các nhu cầu cơ bản nhất, cân bằng chi phí và độ bền bỉ."""
    }.get(domain, "")

    # 3. Xây dựng Prompt tương ứng cho từng bước (Step 1 hoặc Step 2)
    if step == 1:
        prompt = f"""Bạn là Chuyên gia Tư vấn Cấu hình Máy tính tận tâm tại PC Mall.
Khách hàng vừa chia sẻ nhu cầu:
- Nhu cầu/mục đích cụ thể: "{purpose_clean}"
- Mức ngân sách dự kiến: {budget_val:,} VNĐ
- Phân loại lĩnh vực: {domain.upper()}

HƯỚNG DẪN BẮT BUỘC CHO LĨNH VỰC NÀY:
{domain_guidelines}

QUY TẮC TẠO CÂU HỎI CHO NGƯỜI DÙNG PHỔ THÔNG (BƯỚC 1):
1. ĐÚNG TRỌNG TÂM: Câu hỏi phải bám sát chính xác nhu cầu "{purpose_clean}". Nếu là chơi game, CHỈ hỏi về trải nghiệm game, TUYỆT ĐỐI KHÔNG hỏi về văn phòng hay kế toán.
2. DỄ HIỂU, KHÔNG DÙNG THUẬT NGỮ KHÓ: Hỏi bằng tiếng Việt tự nhiên, gần gũi, người không biết gì về linh kiện máy tính cũng trả lời được ngay.
3. KHÔNG TỰ ĐẨY GIÁ TIỀN: Tuyệt đối không gợi ý ngân sách cao hơn {budget_val:,}đ. Mọi phương án xoay quanh mức ngân sách ban đầu của khách hàng.
4. SỐ LƯỢNG: Tạo đúng từ 3 đến 4 câu hỏi trắc nghiệm, mỗi câu 3-4 phương án dễ chọn.
5. ĐỊNH DẠNG: Trả về DUY NHẤT một chuỗi JSON hợp lệ theo đúng cấu trúc mẫu, TUYỆT ĐỐI KHÔNG dùng ký tự Markdown '#' trong toàn bộ nội dung.

CẤU TRÚC JSON MẪU:
{{
  "purpose": "{purpose_clean}",
  "title": "Khảo sát trải nghiệm mong muốn ({purpose_clean})",
  "description": "Giúp tối ưu hóa bộ máy tính đúng nhu cầu thực tế của bạn",
  "step": 1,
  "total_steps": 2,
  "questions": [
    {{
      "id": "target_experience",
      "label": "Câu hỏi hỏi bằng ngôn ngữ tự nhiên, dễ hiểu?",
      "type": "single_select",
      "required": true,
      "options": [
        {{"value": "opt_1", "label": "Mô tả lựa chọn rõ ràng, thân thiện"}},
        {{"value": "opt_2", "label": "Mô tả lựa chọn rõ ràng, thân thiện"}}
      ]
    }}
  ]
}}"""
    else:
        # Step 2: Hardware & Component Deep-dive (Strictly distinct from Step 1)
        context_lines = []
        if isinstance(prev_ans, dict):
            for k, v in prev_ans.items():
                context_lines.append(f"  + Lựa chọn Bước 1 [{k}]: {v}")
        context_str = "\n".join(context_lines) if context_lines else "  + Đã hoàn thành bước 1."

        prompt = f"""Bạn là Chuyên gia Tư vấn Máy tính PC Mall, chuyên lắng nghe và thấu hiểu khách hàng phổ thông.
Khách hàng đã hoàn thành BƯỚC 1:
- Nhu cầu ban đầu: "{purpose_clean}"
- Ngân sách: {budget_val:,} VNĐ
- Phân loại lĩnh vực: {domain.upper()}
- Các lựa chọn ở Bước 1 của khách:
{context_str}

Giai đoạn hiện tại: BƯỚC 2 (TÙY CHỌN THÓI QUEN SỬ DỤNG & KHÔNG GIAN BÀN LÀM VIỆC)

QUY TẮC BẮT BUỘC BƯỚC 2 CHO NGƯỜI DÙNG PHỔ THÔNG:
1. TUYỆT ĐỐI KHÔNG HỎI LẠI CÁC CÂU ĐÃ HỎI Ở BƯỚC 1 (Không hỏi lại về phần mềm hay tác vụ đã chọn).
2. TUYỆT ĐỐI KHÔNG DÙNG THUẬT NGỮ KỸ THUẬT KHÓ HIỂU:
   CẤM dùng các từ kỹ thuật như "SSD NVMe", "Tản nhiệt", "Bus", "Socket", "VRM", "CUDA", "PCIe".
   Thay vào đó, HÃY HỎI VỀ TRẢI NGHIỆM VÀ NHU CẦU THỰC TẾ:
   - Câu 1: Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?
     Options:
       + Vừa phải (Mở vài ứng dụng cơ bản và 10-15 tab web)
       + Nhiều & Thoải mái (Mở hàng chục tab web, chạy đồng thời ứng dụng làm việc, Zalo, nghe nhạc mượt mà không sợ đơ máy)
       + Rất nhiều (Xử lý đồng thời khối lượng công việc cực lớn)
   - Câu 2: Nhu cầu lưu trữ tài liệu, hình ảnh và phần mềm của bạn?
     Options:
       + Lưu trữ cơ bản (Đủ dùng cho hệ điều hành, tài liệu văn phòng và phần mềm thường dùng)
       + Lưu trữ thoải mái (Tha hồ lưu trữ ảnh, video kỷ niệm, tải nhiều phần mềm và tài liệu nặng)
       + Lưu trữ khổng lồ (Cần kho lưu trữ mênh mông cho phim ảnh hoặc dự án dài hạn)
   - Câu 3: Vị trí đặt máy tính của bạn kết nối Internet bằng hình thức nào?
     Options:
       + Bắt sóng Wi-Fi không dây (Gọn gàng, không cần kéo dây mạng và có Bluetooth tiện lợi)
       + Cắm dây mạng trực tiếp (Đã kéo sẵn dây mạng LAN tới bàn)
       + Cần cả hai để linh hoạt di chuyển
   - Câu 4: Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?
     Options:
       + Đen tối giản, kín đáo (Không đèn màu, êm ái, tập trung tối đa)
       + Mặt kính trong suốt có đèn LED (Hiện đại, ánh sáng lung linh tạo cảm hứng)
       + Tone màu Trắng trang nhã (Sang trọng, làm sáng góc làm việc)
3. TUYỆT ĐỐI KHÔNG dùng ký tự Markdown '#' trong toàn bộ kết quả.
4. Số lượng: Tạo đúng 3 đến 4 câu hỏi trắc nghiệm, mỗi câu 2-3 lựa chọn rõ ràng và tự nhiên.

CẤU TRÚC JSON MẪU:
{{
  "purpose": "{purpose_clean}",
  "title": "Thói quen sử dụng & Không gian ({purpose_clean})",
  "description": "Lựa chọn thói quen đa nhiệm, nhu cầu lưu trữ, kết nối mạng và kiểu dáng thùng máy",
  "step": 2,
  "total_steps": 2,
  "questions": [
    {{
      "id": "multitask_habit",
      "label": "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
      "type": "single_select",
      "required": true,
      "options": [
        {{"value": "ram_16gb", "label": "Vừa phải: Mở vài ứng dụng cơ bản và 10-15 tab web"}},
        {{"value": "ram_32gb", "label": "Nhiều & Thoải mái: Mở hàng chục tab web, chạy đồng thời Zalo, nhạc và ứng dụng nặng không sợ giật lag (Khuyên dùng)"}}
      ]
    }}
  ]
}}"""

    # 4. Gọi Gemini API với cơ chế Fallback
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("LLM_API_KEY", "")
    models_to_try = [
        os.environ.get("LLM_MODEL") or "gemini-3.5-flash-lite",
        os.environ.get("LLM_FALLBACK_MODEL") or "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash"
    ]

    for model_name in models_to_try:
        if not api_key:
            break
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "response_mime_type": "application/json",
                    "temperature": 0.3,
                    "maxOutputTokens": 2048
                }
            }
            res = requests.post(url, json=payload, timeout=12)
            if res.status_code == 200:
                data = res.json()
                raw_text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                parsed = json.loads(raw_text)
                if isinstance(parsed, dict) and "questions" in parsed and len(parsed["questions"]) > 0:
                    parsed["is_valid"] = True
                    parsed["step"] = step
                    parsed["total_steps"] = 2
                    return parsed
        except Exception as ex:
            print(f"⚠️ [QuestionEngine] Model {model_name} lỗi: {ex}. Đang thử fallback...")

    # 5. Fallback thông minh theo đúng Domain khi mất kết nối mạng
    return _build_resilient_fallback(purpose_clean, budget_val, step, domain)

def _build_resilient_fallback(purpose: str, budget: int, step: int, domain: str) -> Dict[str, Any]:
    """Tạo bộ câu hỏi fallback thông minh được chia rạch ròi theo domain và thân thiện cho end-user."""
    if domain == "gaming":
        if step == 1:
            return {
                "is_valid": True,
                "purpose": purpose,
                "title": f"Tối ưu trải nghiệm chơi game ({purpose})",
                "description": f"Khảo sát để tối ưu sức mạnh đồ họa và tốc độ khung hình cho ngân sách {budget:,}đ",
                "step": 1,
                "total_steps": 2,
                "questions": [
                    {
                        "id": "game_genre",
                        "label": "Thể loại game bạn dự định chơi nhiều nhất là gì?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "esports", "label": "Game đối kháng Esports mượt mà (LMHT, Valorant, CS2, FO4, Dota 2)"},
                            {"value": "aaa_openworld", "label": "Game thế giới mở đồ họa bom tấn 3D (GTA V, Black Myth Wukong, Cyberpunk, Genshin)"},
                            {"value": "multi_game", "label": "Chơi đa dạng mọi thể loại, kết hợp giải trí đa phương tiện"}
                        ]
                    },
                    {
                        "id": "monitor_resolution",
                        "label": "Màn hình bạn đang dùng hoặc dự định kết nối có độ phân giải nào?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "1080p_standard", "label": "Màn hình Full HD (1080p) - Phổ biến, nhẹ nhàng và tiết kiệm chi phí"},
                            {"value": "2k_sharp", "label": "Màn hình 2K (1440p) - Hình ảnh sắc nét, chi tiết cao"},
                            {"value": "4k_max", "label": "Màn hình 4K hoặc Tivi lớn - Trải nghiệm hình ảnh chân thực đỉnh cao"}
                        ]
                    },
                    {
                        "id": "stream_recording",
                        "label": "Bạn có nhu cầu Livestream hoặc quay lại video trận đấu khi chơi game không?",
                        "type": "single_select",
                        "options": [
                            {"value": "no_stream", "label": "Không, chỉ tập trung chơi game giải trí một mình"},
                            {"value": "voice_chat", "label": "Có bật Discord, nghe nhạc Spotify chạy nền khi chơi"},
                            {"value": "livestream", "label": "Có Livestream trên TikTok, Facebook, YouTube hoặc quay video highlight"}
                        ]
                    }
                ]
            }
        else:
            return {
                "is_valid": True,
                "purpose": purpose,
                "title": f"Thói quen chơi game & Không gian giải trí ({purpose})",
                "description": "Lựa chọn thói quen đa nhiệm, lưu trữ và kiểu dáng thùng máy",
                "step": 2,
                "total_steps": 2,
                "questions": [
                    {
                        "id": "multitask_habit",
                        "label": "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ram_16gb", "label": "Vừa phải: Chỉ tập trung chơi game và mở 1 vài ứng dụng nhẹ"},
                            {"value": "ram_32gb", "label": "Nhiều & Thoải mái: Vừa chơi game nặng vừa mở Discord, nghe nhạc, hàng chục tab web (Khuyên dùng)"}
                        ]
                    },
                    {
                        "id": "storage_capacity",
                        "label": "Nhu cầu lưu trữ game và dữ liệu giải trí của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ssd_500gb", "label": "Lưu trữ cơ bản: Đủ cài 3-5 tựa game phổ biến"},
                            {"value": "ssd_1tb", "label": "Lưu trữ thoải mái: Cài 10-15 game nặng mà không lo đầy bộ nhớ (Khuyên dùng)"},
                            {"value": "ssd_2tb", "label": "Lưu trữ khổng lồ: Thư viện game bom tấn mênh mông"}
                        ]
                    },
                    {
                        "id": "network_connection",
                        "label": "Vị trí đặt máy tính của bạn kết nối Internet bằng hình thức nào?",
                        "type": "single_select",
                        "options": [
                            {"value": "lan_cable", "label": "Cắm dây mạng trực tiếp: Độ trễ thấp, ping thấp tối đa khi chơi game"},
                            {"value": "wifi_bt", "label": "Bắt sóng Wi-Fi không dây: Tiện lợi, không cần kéo dây mạng và có Bluetooth"},
                            {"value": "both", "label": "Cả hai hình thức để linh hoạt sử dụng"}
                        ]
                    },
                    {
                        "id": "case_style",
                        "label": "Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?",
                        "type": "single_select",
                        "options": [
                            {"value": "aquarium_rgb", "label": "Mặt kính trong suốt có đèn LED: Hiện đại, ánh sáng lung linh tạo cảm hứng"},
                            {"value": "stealth_black", "label": "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái"},
                            {"value": "pure_white", "label": "Tone màu Trắng trang nhã: Sang trọng, làm sáng góc giải trí"}
                        ]
                    }
                ]
            }
    elif domain == "office":
        if step == 1:
            return {
                "is_valid": True,
                "purpose": purpose,
                "title": f"Tối ưu máy tính làm việc & xử lý dữ liệu ({purpose})",
                "description": f"Đảm bảo máy chạy nhanh, mượt và bền bỉ trong ngân sách {budget:,}đ",
                "step": 1,
                "total_steps": 2,
                "questions": [
                    {
                        "id": "work_intensity",
                        "label": "Cường độ làm việc và xử lý dữ liệu của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "data_analysis", "label": "Xử lý dữ liệu lớn, Power BI, Excel nặng nhiều macro, Power Query"},
                            {"value": "basic_office", "label": "Soạn thảo Word, duyệt web, email, hóa đơn kế toán cơ bản"},
                            {"value": "multitask", "label": "Mở liên tục 40-60 tab trình duyệt, Zalo, CRM bán hàng đồng thời"}
                        ]
                    },
                    {
                        "id": "monitor_count",
                        "label": "Bạn có nhu cầu xuất ra bao nhiêu màn hình làm việc?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "single_monitor", "label": "1 Màn hình làm việc tiêu chuẩn"},
                            {"value": "dual_monitor", "label": "2 Màn hình song song để xem báo cáo và đối chiếu số liệu"},
                            {"value": "triple_plus", "label": "3 Màn hình trở lên hoặc màn hình độ phân giải siêu rộng 2K/4K"}
                        ]
                    }
                ]
            }
        else:
            return {
                "is_valid": True,
                "purpose": purpose,
                "title": f"Thói quen sử dụng & Không gian làm việc ({purpose})",
                "description": "Lựa chọn thói quen đa nhiệm, lưu trữ và kiểu dáng máy tính",
                "step": 2,
                "total_steps": 2,
                "questions": [
                    {
                        "id": "ram_preference",
                        "label": "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ram_16gb", "label": "Vừa phải: Mở vài ứng dụng cơ bản và 10-15 tab web"},
                            {"value": "ram_32gb", "label": "Nhiều & Thoải mái: Mở hàng chục tab web, chạy đồng thời Zalo, nghe nhạc và làm việc mượt mà (Khuyên dùng)"},
                            {"value": "ram_64gb", "label": "Rất nhiều: Xử lý file Excel cực nặng, Power BI và máy ảo đồng thời"}
                        ]
                    },
                    {
                        "id": "storage_capacity",
                        "label": "Nhu cầu lưu trữ tài liệu, hình ảnh và phần mềm của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ssd_500gb", "label": "Lưu trữ cơ bản: Đủ dùng cho hệ điều hành, tài liệu văn phòng và phần mềm thường dùng"},
                            {"value": "ssd_1tb", "label": "Lưu trữ thoải mái: Tha hồ lưu ảnh, tài liệu nặng và dữ liệu nhiều năm (Khuyên dùng)"},
                            {"value": "ssd_2tb", "label": "Lưu trữ khổng lồ: Kho dữ liệu lớn, an tâm làm việc lâu dài"}
                        ]
                    },
                    {
                        "id": "network_connection",
                        "label": "Vị trí đặt máy tính của bạn kết nối Internet bằng hình thức nào?",
                        "type": "single_select",
                        "options": [
                            {"value": "wifi_bt", "label": "Bắt sóng Wi-Fi không dây: Gọn gàng, tiện lợi và có sẵn Bluetooth"},
                            {"value": "lan_cable", "label": "Cắm dây mạng trực tiếp: Ổn định tối đa, tốc độ cao"},
                            {"value": "both", "label": "Linh hoạt cả hai hình thức"}
                        ]
                    },
                    {
                        "id": "case_style",
                        "label": "Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?",
                        "type": "single_select",
                        "options": [
                            {"value": "stealth_black", "label": "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái"},
                            {"value": "pure_white", "label": "Tone màu Trắng trang nhã: Sang trọng, làm sáng góc làm việc"},
                            {"value": "aquarium_rgb", "label": "Mặt kính trong suốt có đèn LED: Hiện đại, ánh sáng tạo cảm hứng"}
                        ]
                    }
                ]
            }
    elif domain == "editing":
        if step == 1:
            return {
                "is_valid": True,
                "purpose": purpose,
                "title": f"Tối ưu máy tính đồ họa & dựng phim ({purpose})",
                "description": f"Khảo sát để tối ưu sức mạnh CPU và Card đồ họa cho ngân sách {budget:,}đ",
                "step": 1,
                "total_steps": 2,
                "questions": [
                    {
                        "id": "editing_tasks",
                        "label": "Tác vụ thiết kế & dựng video chính của bạn là gì?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "photo_2d", "label": "Chỉnh sửa ảnh Photoshop, Lightroom, vẽ Illustrator, thiết kế Canva"},
                            {"value": "video_production", "label": "Dựng và cắt ghép video Premiere Pro, CapCut, After Effects kỹ xảo"},
                            {"value": "3d_arch", "label": "Diễn họa kiến trúc 3D, AutoCAD, Blender, SketchUp, Lumion"}
                        ]
                    },
                    {
                        "id": "video_resolution",
                        "label": "Độ phân giải video hoặc kích thước file dự án bạn làm việc:",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "fhd_project", "label": "Full HD (1080p) - Các video TikTok, Reels, YouTube tiêu chuẩn"},
                            {"value": "4k_project", "label": "4K Ultra HD - Video chất lượng cao hoặc file ảnh RAW dung lượng lớn"}
                        ]
                    }
                ]
            }
        else:
            return {
                "is_valid": True,
                "purpose": purpose,
                "title": f"Thói quen làm việc & Thẩm mỹ đồ họa ({purpose})",
                "description": "Lựa chọn thói quen đa nhiệm, lưu trữ và phong cách góc làm việc",
                "step": 2,
                "total_steps": 2,
                "questions": [
                    {
                        "id": "editing_ram",
                        "label": "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ram_32gb", "label": "Nhiều & Thoải mái: Mở đồng thời Photoshop, Premiere, hàng chục tab web và nghe nhạc (Khuyên dùng)"},
                            {"value": "ram_64gb", "label": "Rất nhiều: Dựng After Effects kỹ xảo nặng, Render 4K và nhiều ứng dụng đồ họa cực mượt"}
                        ]
                    },
                    {
                        "id": "editing_storage",
                        "label": "Nhu cầu lưu trữ tài liệu, hình ảnh và phần mềm của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ssd_1tb", "label": "Lưu trữ thoải mái: Chứa thoải mái các file thiết kế, video dự án (Khuyên dùng)"},
                            {"value": "ssd_2tb", "label": "Lưu trữ khổng lồ: Kho thư viện hình ảnh và video chất lượng cao nhiều năm"}
                        ]
                    },
                    {
                        "id": "network_connection",
                        "label": "Vị trí đặt máy tính của bạn kết nối Internet bằng hình thức nào?",
                        "type": "single_select",
                        "options": [
                            {"value": "lan_cable", "label": "Cắm dây mạng trực tiếp: Ổn định và tải file tài liệu dung lượng lớn nhanh chóng"},
                            {"value": "wifi_bt", "label": "Bắt sóng Wi-Fi không dây: Tiện lợi, không cần kéo dây mạng và có sẵn Bluetooth"},
                            {"value": "both", "label": "Linh hoạt cả hai hình thức"}
                        ]
                    },
                    {
                        "id": "editing_case",
                        "label": "Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?",
                        "type": "single_select",
                        "options": [
                            {"value": "pure_white", "label": "Tone màu Trắng trang nhã: Tinh tế, hiện đại, làm sáng không gian sáng tạo"},
                            {"value": "stealth_black", "label": "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái"},
                            {"value": "aquarium_rgb", "label": "Mặt kính trong suốt có đèn LED: Sang trọng, ánh sáng tạo cảm hứng"}
                        ]
                    }
                ]
            }
    elif domain == "ai_programming":
        if step == 1:
            return {
                "is_valid": True,
                "purpose": purpose,
                "title": f"Tối ưu máy tính Lập trình & Trí tuệ nhân tạo ({purpose})",
                "description": f"Đảm bảo khả năng chạy container, build code và AI trong ngân sách {budget:,}đ",
                "step": 1,
                "total_steps": 2,
                "questions": [
                    {
                        "id": "dev_stack",
                        "label": "Lĩnh vực lập trình hoặc công nghệ AI bạn đang theo đuổi:",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "web_mobile_dev", "label": "Lập trình Web/Mobile, Backend, chạy Docker, máy ảo giả lập Android"},
                            {"value": "ai_ml_data", "label": "Nghiên cứu AI, Huấn luyện mô hình Machine Learning, chạy Local LLM, PyTorch"}
                        ]
                    },
                    {
                        "id": "container_load",
                        "label": "Mức độ chạy đồng thời nhiều tác vụ nặng trên máy:",
                        "type": "single_select",
                        "options": [
                            {"value": "moderate_load", "label": "Chạy 3-5 container Docker và 1-2 IDE lập trình đồng thời"},
                            {"value": "heavy_load", "label": "Chạy nhiều cụm microservices, huấn luyện mô hình liên tục nhiều giờ"}
                        ]
                    }
                ]
            }
        else:
            return {
                "is_valid": True,
                "purpose": purpose,
                "title": f"Thói quen sử dụng & Không gian lập trình ({purpose})",
                "description": "Lựa chọn thói quen đa nhiệm, lưu trữ và phong cách bàn làm việc",
                "step": 2,
                "total_steps": 2,
                "questions": [
                    {
                        "id": "dev_ram",
                        "label": "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ram_32gb", "label": "Nhiều & Thoải mái: Chạy Docker, VS Code, hàng chục tab web mượt mà (Khuyên dùng)"},
                            {"value": "ram_64gb", "label": "Rất nhiều: Chạy đồng thời nhiều máy ảo nặng, xử lý dữ liệu lớn không lo giật lag"}
                        ]
                    },
                    {
                        "id": "dev_storage",
                        "label": "Nhu cầu lưu trữ tài liệu, hình ảnh và phần mềm của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ssd_1tb", "label": "Lưu trữ thoải mái: Chứa thoải mái mã nguồn, container và dữ liệu (Khuyên dùng)"},
                            {"value": "ssd_2tb", "label": "Lưu trữ khổng lồ: Kho dữ liệu huấn luyện lớn, an tâm lâu dài"}
                        ]
                    },
                    {
                        "id": "network_connection",
                        "label": "Vị trí đặt máy tính của bạn kết nối Internet bằng hình thức nào?",
                        "type": "single_select",
                        "options": [
                            {"value": "lan_cable", "label": "Cắm dây mạng trực tiếp: Ổn định và tải dữ liệu nhanh chóng"},
                            {"value": "wifi_bt", "label": "Bắt sóng Wi-Fi không dây: Tiện lợi và có sẵn Bluetooth"},
                            {"value": "both", "label": "Cả hai hình thức để linh hoạt sử dụng"}
                        ]
                    },
                    {
                        "id": "dev_case",
                        "label": "Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?",
                        "type": "single_select",
                        "options": [
                            {"value": "stealth_black", "label": "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái, tập trung code"},
                            {"value": "pure_white", "label": "Tone màu Trắng trang nhã: Sang trọng, làm sáng góc làm việc"},
                            {"value": "aquarium_rgb", "label": "Mặt kính trong suốt có đèn LED: Hiện đại, ánh sáng tạo cảm hứng"}
                        ]
                    }
                ]
            }
    else:
        # General
        if step == 1:
            return {
                "is_valid": True,
                "purpose": purpose,
                "title": f"Tối ưu cấu hình máy tính đa năng ({purpose})",
                "description": f"Xác định nhu cầu sử dụng thực tế trong ngân sách {budget:,}đ",
                "step": 1,
                "total_steps": 2,
                "questions": [
                    {
                        "id": "daily_need",
                        "label": "Nhu cầu sử dụng máy tính hàng ngày của bạn:",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "office_study", "label": "Học tập, văn phòng, tra cứu tài liệu và xem phim giải trí"},
                            {"value": "creative_gaming", "label": "Vừa làm việc vừa chơi game hoặc sáng tạo nội dung đa phương tiện"},
                            {"value": "long_term_speed", "label": "Cần máy siêu bền bỉ, khởi động nhanh, dùng ổn định 5-7 năm"}
                        ]
                    },
                    {
                        "id": "monitor_resolution",
                        "label": "Màn hình bạn đang dùng hoặc dự định kết nối:",
                        "type": "single_select",
                        "options": [
                            {"value": "fhd", "label": "Full HD (1080p) - Chuẩn phổ thông"},
                            {"value": "2k_4k", "label": "Màn hình 2K hoặc 4K sắc nét cao"}
                        ]
                    }
                ]
            }
        else:
            return {
                "is_valid": True,
                "purpose": purpose,
                "title": f"Thói quen sử dụng & Không gian bàn làm việc ({purpose})",
                "description": "Lựa chọn thói quen đa nhiệm, lưu trữ và phong cách thùng máy",
                "step": 2,
                "total_steps": 2,
                "questions": [
                    {
                        "id": "general_ram",
                        "label": "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ram_16gb", "label": "Vừa phải: Mở vài ứng dụng cơ bản và 10-15 tab web"},
                            {"value": "ram_32gb", "label": "Nhiều & Thoải mái: Mở hàng chục tab web, chạy đồng thời ứng dụng làm việc mượt mà (Khuyên dùng)"}
                        ]
                    },
                    {
                        "id": "general_storage",
                        "label": "Nhu cầu lưu trữ tài liệu, hình ảnh và phần mềm của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ssd_500gb", "label": "Lưu trữ cơ bản: Đủ dùng cho hệ điều hành, tài liệu và ứng dụng thường dùng"},
                            {"value": "ssd_1tb", "label": "Lưu trữ thoải mái: Thoải mái lưu ảnh, video kỷ niệm và dữ liệu lớn (Khuyên dùng)"}
                        ]
                    },
                    {
                        "id": "network_connection",
                        "label": "Vị trí đặt máy tính của bạn kết nối Internet bằng hình thức nào?",
                        "type": "single_select",
                        "options": [
                            {"value": "wifi_bt", "label": "Bắt sóng Wi-Fi không dây: Tiện lợi, không cần kéo dây mạng và có sẵn Bluetooth"},
                            {"value": "lan_cable", "label": "Cắm dây mạng trực tiếp: Ổn định và tốc độ cao"},
                            {"value": "both", "label": "Linh hoạt cả hai hình thức"}
                        ]
                    },
                    {
                        "id": "general_case",
                        "label": "Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?",
                        "type": "single_select",
                        "options": [
                            {"value": "stealth_black", "label": "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái"},
                            {"value": "pure_white", "label": "Tone màu Trắng trang nhã: Sang trọng, tinh tế"},
                            {"value": "aquarium_rgb", "label": "Mặt kính trong suốt có đèn LED: Hiện đại, ánh sáng lung linh"}
                        ]
                    }
                ]
            }
