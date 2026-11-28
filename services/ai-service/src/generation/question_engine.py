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

PC_CONTEXT_KEYWORDS = [
    "máy", "pc", "laptop", "mua", "học", "cấu hình", "dùng", "chạy", "cần",
    "tìm", "tư vấn", "làm việc", "văn phòng", "chơi", "con", "giá", "học sinh", "sinh viên", "nhà hàng", "quán"
]

def check_input_guardrail(text: str) -> Dict[str, Any]:
    """Kiểm tra nội dung đầu vào thông minh với whitelist ngữ cảnh PC."""
    cleaned = (text or "").strip()
    if len(cleaned) < 2:
        return {"is_valid": False, "is_off_topic": True}
    
    cleaned_lower = cleaned.lower()
    # Nếu câu hỏi có chứa ngữ cảnh tìm máy tính / học tập / làm việc -> Không bị chặn
    has_pc_context = any(k in cleaned_lower for k in PC_CONTEXT_KEYWORDS)
    if has_pc_context:
        return {"is_valid": True, "is_off_topic": False}

    if OFF_TOPIC_PATTERN.search(cleaned):
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
    if any(k in p_lower for k in [
        "văn phòng", "kế toán", "office", "word", "excel", "bán hàng", "thu ngân",
        "nhập liệu", "power bi", "powerbi", "tableau", "sql", "dữ liệu",
        "học tập", "học sinh", "sinh viên", "cho con", "bài tập", "giải toán", "nhà hàng", "quản lý"
    ]):
        return "office"
    return "general"

def generate_dynamic_questions(
    purpose: str,
    budget: Optional[int] = 20000000,
    previous_answers: Optional[Dict[str, Any]] = None,
    step: int = 1
) -> Dict[str, Any]:
    """
    Sinh câu hỏi trắc nghiệm ĐỘNG 100% qua LLM (với chuỗi fallback dự phòng).
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
                        {"value": "gaming", "label": "Chơi Game giải trí (Esports như LMHT, Valorant, FO4 hoặc Game bom tấn 3D)"},
                        {"value": "office", "label": "Học tập & Làm việc văn phòng (Word, Excel, duyệt web, kế toán, bán hàng)"},
                        {"value": "editing", "label": "Thiết kế đồ họa & Dựng video (Photoshop, Premiere, Canva, CapCut)"},
                        {"value": "ai_tech", "label": "Lập trình phần mềm, chạy máy ảo hoặc Trí tuệ nhân tạo (AI)"}
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
  + Trải nghiệm màn hình (Màn Full HD thông thường vs Màn hình 2K sắc nét vs 4K).
  + Mức độ mượt mà mong muốn (60 khung hình/giây phổ thông vs 144+ khung hình/giây cực mượt).""",

        "office": """- ĐÂY LÀ NHU CẦU VĂN PHÒNG & HỌC TẬP.
- TUYỆT ĐỐI KHÔNG HỎI VỀ CARD MÀN HÌNH KHỦNG HOẶC GAME NẶNG.
- Tập trung vào:
  + Loại hình công việc (Soạn thảo văn bản, kế toán, duyệt web vs Xử lý bảng tính Excel lớn, Power BI, báo cáo dữ liệu).
  + Nhu cầu xuất màn hình làm việc (1 màn hình tiêu chuẩn vs 2 màn hình song song).
  + Độ bền bỉ và tính ổn định khi chạy liên tục cả ngày.""",

        "editing": """- ĐÂY LÀ NHU CẦU ĐỒ HỌA & DỰNG PHIM.
- Tập trung vào:
  + Phần mềm hay dùng (Photoshop/Illustrator 2D vs Premiere/CapCut dựng video vs Blender/AutoCAD 3D).
  + Độ phân giải video/ảnh thành phẩm (Full HD vs 4K Ultra HD).
  + Tần suất render/xuất video dự án.""",

        "ai_programming": """- ĐÂY LÀ NHU CẦU LẬP TRÌNH & AI.
- Tập trung vào:
  + Lĩnh vực phát triển (Web/Backend vs Lập trình Mobile chạy máy ảo Android Studio/iOS vs Nghiên cứu AI/Data Science).
  + Nhu cầu tăng tốc phần cứng (Chỉ cần CPU biên dịch code thông thường vs Cần GPU VRAM lớn để huấn luyện AI hoặc đồ họa máy ảo).""",

        "general": """- Khảo sát các nhu cầu cơ bản nhất, cân bằng chi phí và độ bền bỉ."""
    }.get(domain, "")

    # 3. Xây dựng Prompt tương ứng cho từng bước (Step 1 hoặc Step 2)
    if step == 1:
        prompt = f"""Bạn là Chuyên gia Tư vấn Cấu hình Máy tính tận tâm tại PC Mall.
Khách hàng vừa chia sẻ nhu cầu:
- Nhu cầu/mục đích cụ thể: "{purpose_clean}"
- Mức ngân sách dự kiến: {budget_val:,} VNĐ
- Phân loại lĩnh vực: {domain.upper()}

BỘ LỌC NGỮ CẢNH & PHÂN TÍCH NHU CẦU THÔNG MINH TẠI PROMPT:
1. PHÂN TÍCH NHU CẦU ĐỜI THƯỜNG THỰC TẾ:
   - Nếu khách hàng nêu nhu cầu gia đình, học tập, công việc (ví dụ: "mua máy cho con học bài tập và giải toán", "máy cho nhà hàng quản lý order"):
     Hãy nhận diện đây là nhu cầu HỌC TẬP / VĂN PHÒNG / KINH DOANH thực tế.
     Sinh các câu hỏi bám sát vào: loại tác vụ học tập/làm việc hàng ngày, nhu cầu bảo vệ mắt/kích thước màn hình và độ ổn định lâu dài.
2. NẾU CÂU HỎI VƯỢT QUA GUARDRAIL VÀ HOÀN TOÀN NGOÀI LỀ (ví dụ: người dùng cố tình chỉ hỏi bói toán, nấu ăn, thơ ca):
   - TUYỆT ĐỐI KHÔNG sinh câu hỏi về nấu ăn hay bói toán.
   - HÃY TỰ ĐỘNG CHUYỂN HƯỚNG VỀ BỘ CÂU HỎI ĐỊNH HƯỚNG NHU CẦU MÁY TÍNH: Hỏi khách hàng xem có dự định dùng máy tính cho mục đích nào (Gaming giải trí, Văn phòng học tập, Đồ họa dựng video, hay Lập trình AI) kèm lời mời thân thiện.

HƯỚNG DẪN BẮT BUỘC CHO LĨNH VỰC NÀY:
{domain_guidelines}

QUY TẮC PHÂN BỔ CÂU HỎI VÒNG 1 (TỐI ĐA 5 CÂU - TỔNG 2 VÒNG KHÔNG QUÁ 10 CÂU):
1. ĐÚNG TRỌNG TÂM & BAO QUÁT: Tập trung hỏi về mục đích cốt lõi, phần mềm/tựa game cụ thể, độ phân giải & tần số quét màn hình, cường độ tải công việc hoặc yêu cầu đặc thù (ví dụ: máy ảo, AI VRAM, render 4K, stream...) để không lọt lỗ hổng.
2. ĐỂ DÀNH CHI TIẾT NGOẠI VI CHO VÒNG 2: Không hỏi sâu về màu sắc vỏ case, đèn LED hay dung lượng SSD chi tiết ở Vòng 1 (sẽ hỏi ở Vòng 2).
3. DỄ HIỂU, KHÔNG DÙNG THUẬT NGỮ KHÓ: Hỏi bằng tiếng Việt tự nhiên, gần gũi, người không biết gì về máy tính cũng trả lời được ngay.
4. KHÔNG TỰ ĐẨY GIÁ TIỀN: Tuyệt đối không gợi ý ngân sách cao hơn {budget_val:,}đ. Mọi phương án xoay quanh mức ngân sách ban đầu của khách hàng.
5. SỐ LƯỢNG: Tự sinh từ 3 đến 5 câu hỏi trắc nghiệm (tối đa 5 câu ở Vòng 1), mỗi câu 2-4 phương án rõ ràng.
6. BẮT BUỘC NGÔN NGỮ: Toàn bộ văn bản (title, description, label, options) PHẢI viết bằng tiếng Việt CÓ DẤU ĐẦY ĐỦ (UTF-8 chuẩn). Tuyệt đối KHÔNG viết tiếng Việt không dấu.
7. ĐỊNH DẠNG: Trả về DUY NHẤT một chuỗi JSON hợp lệ theo đúng cấu trúc mẫu. TUYỆT ĐỐI KHÔNG dùng emoji (biểu tượng cảm xúc) và KHÔNG dùng ký tự Markdown '#' trong toàn bộ nội dung.

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
                context_lines.append(f"  + Lựa chọn Vòng 1 [{k}]: {v}")
        context_str = "\n".join(context_lines) if context_lines else "  + Đã hoàn thành vòng 1."

        prompt = f"""Bạn là Chuyên gia Tư vấn Máy tính PC Mall, chuyên lắng nghe và thấu hiểu khách hàng phổ thông.
Khách hàng đã hoàn thành VÒNG 1:
- Nhu cầu ban đầu: "{purpose_clean}"
- Ngân sách: {budget_val:,} VNĐ
- Phân loại lĩnh vực: {domain.upper()}
- Các lựa chọn ở Vòng 1 của khách:
{context_str}

Giai đoạn hiện tại: VÒNG 2 (ĐÀO SÂU CHI TIẾT CÒN THIẾU DỰA TRÊN NGỮ CẢNH VÒNG 1)

QUY TẮC BẮT BUỘC VÒNG 2:
1. BÁM SÁT NGỮ CẢNH VÒNG 1 & KHÔNG TRÙNG LẶP:
   - Đọc kỹ các lựa chọn Vòng 1 ở trên để sinh câu hỏi nối tiếp hợp lý, KHÔNG hỏi lại những gì khách đã trả lời ở Vòng 1.
2. BAO QUÁT KHÔNG LỌT LỖ HỔNG (TỰ SINH LINH HOẠT):
   - Tổng câu hỏi của cả 2 vòng tối đa 10 câu (Vòng 2 tối đa 5 câu).
   - Hãy tự rà soát xem từ nhu cầu "{purpose_clean}" + câu trả lời Vòng 1 còn thiếu thông tin gì để chốt đủ 8 linh kiện (RAM đa nhiệm, dung lượng lưu trữ SSD/HDD, yêu cầu tản nhiệt/độ ồn 24/7, khả năng nâng cấp tương lai, số màn hình/cổng kết nối, kích thước/màu sắc/thẩm mỹ thùng máy) rồi tự sinh các câu hỏi sát thực tế nhất.
   - Cấm hỏi các câu vô nghĩa rập khuôn như Wi-Fi vs dây mạng LAN nếu khách không yêu cầu.
3. NGÔN NGỮ PHỔ THÔNG 100% (CỰC KỲ QUAN TRỌNG):
   - Khách hàng là NGƯỜI DÙNG PHỔ THÔNG không rành kỹ thuật.
   - TUYỆT ĐỐI CẤM dùng các từ chuyên môn phần cứng trong cả câu hỏi lẫn các phương án trả lời: CẤM ghi "RAM 16GB/32GB", "SSD/HDD/NVMe/500GB/1TB", "HDMI/DisplayPort", "card rời/card tích hợp", "socket", "DDR4/DDR5", "TDP", "Watt", "AIO".
   - Hãy mô tả bằng TRẢI NGHIỆM ĐỜI THƯỜNG dễ hiểu: ví dụ "mở 5-10 tab web và 1-2 file Excel" vs "mở hàng chục tab và nhiều file Excel nặng cùng lúc"; "lưu trữ tài liệu cơ bản" vs "lưu trữ kho dữ liệu nhiều năm, ảnh/video"; "cắm 2 màn hình văn phòng thông thường" vs "cần màn hình lớn độ nét cao"; "máy chạy êm ái, gọn gàng" vs "hiện đại có đèn trang trí".
4. BẮT BUỘC NGÔN NGỮ: Toàn bộ văn bản (title, description, label, options) PHẢI viết bằng tiếng Việt CÓ DẤU ĐẦY ĐỦ (UTF-8 chuẩn). Tuyệt đối KHÔNG viết tiếng Việt không dấu.
5. TUYỆT ĐỐI KHÔNG dùng emoji (biểu tượng cảm xúc) và KHÔNG dùng ký tự Markdown '#' trong toàn bộ kết quả.
6. SỐ LƯỢNG: Tự sinh từ 3 đến 5 câu hỏi trắc nghiệm (tối đa 5 câu ở Vòng 2), không áp cứng một mẫu cố định cho mọi khách hàng.

CẤU TRÚC JSON MẪU:
{{
  "purpose": "{purpose_clean}",
  "title": "Chi tiết tối ưu cấu hình ({purpose_clean})",
  "description": "Khảo sát chuyên sâu các yếu tố phần cứng còn thiếu dựa trên lựa chọn Vòng 1",
  "step": 2,
  "total_steps": 2,
  "questions": [
    {{
      "id": "ten_id_ngan_gon",
      "label": "Câu hỏi chuyên sâu nối tiếp ngữ cảnh Vòng 1 bằng tiếng Việt có dấu?",
      "type": "single_select",
      "required": true,
      "options": [
        {{"value": "opt_1", "label": "Mô tả lựa chọn 1 rõ ràng, sát nhu cầu"}},
        {{"value": "opt_2", "label": "Mô tả lựa chọn 2 rõ ràng, sát nhu cầu"}}
      ]
    }}
  ]
}}"""

    # 4. Gọi Gemini API với cơ chế Fallback các model thực đang hoạt động
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("LLM_API_KEY", "")
    models_to_try = [
        os.environ.get("LLM_MODEL") or "gemini-2.5-flash",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        os.environ.get("LLM_FALLBACK_MODEL") or "gemini-3-flash-preview",
        "gemini-flash-latest"
    ]

    for model_name in dict.fromkeys(m for m in models_to_try if m):
        if not api_key:
            break
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            gen_cfg = {
                "response_mime_type": "application/json",
                "temperature": 0.3,
                "maxOutputTokens": 2048
            }
            if model_name.startswith("gemini-3-flash"):
                gen_cfg["thinkingConfig"] = {"thinkingBudget": 0}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": gen_cfg
            }
            res = requests.post(url, json=payload, timeout=15)
            if res.status_code == 200:
                data = res.json()
                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                raw_text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
                parsed = json.loads(raw_text)
                if isinstance(parsed, dict) and "questions" in parsed and len(parsed["questions"]) > 0:
                    # Chạy tầng lọc khử trùng lặp nghiêm ngặt giữa Vòng 1 và Vòng 2
                    parsed["questions"] = deduplicate_and_clean_questions(
                        parsed["questions"], step, prev_ans, domain, budget_val
                    )
                    parsed["is_valid"] = True
                    parsed["step"] = step
                    parsed["total_steps"] = 2
                    return parsed
        except Exception as ex:
            print(f"⚠️ [QuestionEngine] Model {model_name} lỗi: {ex}. Đang thử fallback...")

    # 5. Fallback thông minh theo đúng Domain khi mất kết nối mạng
    fallback_res = _build_resilient_fallback(purpose_clean, budget_val, step, domain)
    if "questions" in fallback_res:
        fallback_res["questions"] = deduplicate_and_clean_questions(
            fallback_res["questions"], step, prev_ans, domain, budget_val
        )
    return fallback_res

def deduplicate_and_clean_questions(
    questions: List[Dict[str, Any]],
    step: int,
    prev_ans: Dict[str, Any],
    domain: str,
    budget: int
) -> List[Dict[str, Any]]:
    """
    Loại bỏ triệt để trùng lặp giữa Vòng 1 và Vòng 2 và giới hạn tối đa 5 câu mỗi vòng (tổng <= 10 câu).
    """
    if not questions:
        return []

    if step == 1:
        return questions[:5]

    # Step == 2: Chỉ lọc trùng lặp với Vòng 1 và giới hạn tối đa 5 câu (không áp cứng thêm câu hỏi)
    prev_keys = [str(k).lower() for k in (prev_ans or {}).keys()]
    clean_v2 = []
    seen_ids = set()

    for q in questions:
        qid = str(q.get("id", "")).lower().strip()
        if not qid or qid in prev_keys or qid in seen_ids:
            continue
        seen_ids.add(qid)
        clean_v2.append(q)
        if len(clean_v2) >= 5:
            break

    return clean_v2 if clean_v2 else questions[:5]

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
                        "id": "target_fps",
                        "label": "Mức độ mượt mà khung hình mong muốn khi chơi game:",
                        "type": "single_select",
                        "options": [
                            {"value": "fps_60", "label": "60 FPS tiêu chuẩn - Trải nghiệm đồ họa đẹp mắt, ổn định"},
                            {"value": "fps_144_plus", "label": "144+ FPS cực mượt - Chuyên biệt cho game đối kháng, phản xạ tức thì"}
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
                            {"value": "stealth_black", "label": "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái"},
                            {"value": "aquarium_rgb", "label": "Mặt kính trong suốt có đèn LED: Hiện đại, ánh sáng lung linh tạo cảm hứng"},
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
                        "id": "work_type",
                        "label": "Loại hình công việc chính bạn xử lý hàng ngày:",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "basic_office", "label": "Soạn thảo văn bản Word, duyệt web, email, kế toán hóa đơn cơ bản"},
                            {"value": "data_analysis", "label": "Xử lý bảng tính Excel lớn, Power BI, báo cáo thống kê dữ liệu chuyên sâu"},
                            {"value": "business_store", "label": "Bán hàng đa kênh, quản lý kho hàng và phần mềm doanh nghiệp"}
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
                        "id": "multitask_habit",
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
                    },
                    {
                        "id": "render_frequency",
                        "label": "Tần suất xuất file và Render dự án của bạn:",
                        "type": "single_select",
                        "options": [
                            {"value": "render_intermittent", "label": "Thỉnh thoảng xuất file ngắn cho mạng xã hội"},
                            {"value": "render_continuous", "label": "Xuất file liên tục hàng ngày, render timeline phức tạp nhiều layer"}
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
                        "id": "multitask_habit",
                        "label": "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ram_32gb", "label": "Nhiều & Thoải mái: Mở đồng thời Photoshop, Premiere, hàng chục tab web và nghe nhạc (Khuyên dùng)"},
                            {"value": "ram_64gb", "label": "Rất nhiều: Dựng After Effects kỹ xảo nặng, Render 4K và nhiều ứng dụng đồ họa cực mượt"}
                        ]
                    },
                    {
                        "id": "storage_capacity",
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
                        "id": "case_style",
                        "label": "Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?",
                        "type": "single_select",
                        "options": [
                            {"value": "stealth_black", "label": "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái"},
                            {"value": "pure_white", "label": "Tone màu Trắng trang nhã: Tinh tế, hiện đại, làm sáng không gian sáng tạo"},
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
                        "label": "Lĩnh vực công nghệ hoặc định hướng phát triển chính của bạn:",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "mobile_app", "label": "Lập trình ứng dụng Android (Android Studio) / Mobile đa nền tảng (Flutter, React Native)"},
                            {"value": "web_backend", "label": "Lập trình Web Fullstack, Backend, Microservices và Container Linux"},
                            {"value": "ai_data", "label": "Nghiên cứu Trí tuệ nhân tạo (AI), Machine Learning, PyTorch, Data Science"}
                        ]
                    },
                    {
                        "id": "dev_platform_env",
                        "label": "Bạn chủ yếu làm ứng dụng cho nền tảng nào và môi trường chạy thử:",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "emulator_heavy", "label": "Chạy máy ảo giả lập điện thoại di động (Android Studio Emulator)"},
                            {"value": "container_light", "label": "Chạy máy chủ cục bộ hoặc Docker Container Linux"},
                            {"value": "multi_env", "label": "Cả giả lập điện thoại và các công cụ phát triển nhẹ khác"}
                        ]
                    },
                    {
                        "id": "gpu_hardware_accel",
                        "label": "Mức độ cần Card đồ họa (GPU) để tăng tốc công việc của bạn:",
                        "type": "single_select",
                        "options": [
                            {"value": "cpu_focused", "label": "Chủ yếu biên dịch mã nguồn và chạy máy ảo (Ưu tiên CPU và độ bền)"},
                            {"value": "gpu_heavy", "label": "Cần Card đồ họa mạnh hỗ trợ huấn luyện AI, render giả lập hoặc xử lý dữ liệu nặng"}
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
                        "id": "multitask_habit",
                        "label": "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ram_32gb", "label": "Nhiều & Thoải mái: Chạy Docker, VS Code, hàng chục tab web mượt mà (Khuyên dùng)"},
                            {"value": "ram_64gb", "label": "Rất nhiều: Chạy đồng thời nhiều máy ảo nặng, xử lý dữ liệu lớn không lo giật lag"}
                        ]
                    },
                    {
                        "id": "storage_capacity",
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
                        "id": "case_style",
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
                        "id": "multitask_habit",
                        "label": "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            {"value": "ram_16gb", "label": "Vừa phải: Mở vài ứng dụng cơ bản và 10-15 tab web"},
                            {"value": "ram_32gb", "label": "Nhiều & Thoải mái: Mở hàng chục tab web, chạy đồng thời ứng dụng làm việc mượt mà (Khuyên dùng)"}
                        ]
                    },
                    {
                        "id": "storage_capacity",
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
                        "id": "case_style",
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
