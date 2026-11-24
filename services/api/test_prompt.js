require("dotenv").config({ path: __dirname + "/.env" });

async function run() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
  console.log("API Key exists:", Boolean(apiKey));
  const model = "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const prompt = `Khách hàng cần xây dựng dàn PC với thông số sau:
- Ngân sách mục tiêu: 20.000.000 VNĐ
- Nhu cầu chính: LÀM VIỆC VỚI EXCEL RẤT NHIỀU
- Độ phân giải mục tiêu: 1080P
- Yêu cầu cụ thể của khách hàng: "Làm việc với excel rất nhiều"

NHIỆM VỤ CỦA BẠN:
1. ĐÁNH GIÁ NGHIÊM KHẮC & KHÔNG THIÊN VỊ:
Phân đoạn từng mục linh kiện trên một dòng riêng biệt theo đúng cấu trúc tiêu đề:
1. BỘ VI XỬ LÝ (CPU)
2. CARD ĐỒ HỌA (GPU)
3. BO MẠCH CHỦ (MAINBOARD)
4. BỘ NHỚ RAM
5. Ổ CỨNG LƯU TRỮ (SSD)
6. NGUỒN MÁY TÍNH (PSU)
7. VỎ THÙNG MÁY (CASE)
8. TẢN NHIỆT (COOLING)
- Dùng dấu gạch đầu dòng '-' hoặc '•' cho các phân tích cụ thể bên dưới mỗi mục.

3. BẮT BUỘC Ở CUỐI PHẢN HỒI:
Xuất một khối JSON khép kín:
\`\`\`json
{
  "selectedSkuIds": {
    "cpu": 585,
    "gpu": 400,
    "mainboard": 300,
    "ram": 200,
    "storage": 100,
    "psu": 50,
    "case": 60,
    "cooling": 70
  }
}
\`\`\`
Bắt đầu bài phân tích:`;

  console.log("Calling Gemini...");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 3000 }
    })
  });

  console.log("Status:", res.status);
  if (!res.ok) {
    const err = await res.text();
    console.error("Error response:", err);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulatedText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.substring(5).trim();
      if (dataStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(dataStr);
        const chunkText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const finishReason = parsed?.candidates?.[0]?.finishReason;
        if (finishReason) console.log("\n[Finish Reason]:", finishReason);
        if (chunkText) {
          process.stdout.write(chunkText);
          accumulatedText += chunkText;
        }
      } catch (e) {
        console.error("Parse err:", e.message);
      }
    }
  }
  console.log("\n[REMAINING BUFFER AFTER LOOP]:", buffer);
  if (buffer && buffer.startsWith("data:")) {
    try {
      const parsed = JSON.parse(buffer.substring(5).trim());
      console.log("[PARSED FROM REMAINING BUFFER]:", JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log("[BUFFER PARSE ERROR]:", e.message);
    }
  }
  console.log("\n\n=== TOTAL RECEIVED LENGTH ===", accumulatedText.length);
}

run().catch(console.error);
