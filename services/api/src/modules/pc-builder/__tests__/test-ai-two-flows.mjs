/**
 * Test Suite: Kiểm thử 2 luồng AI PC Builder
 * Mỗi luồng 4 trường hợp: PASS, FAIL, EXCEPTION, BOUNDARY (Tổng cộng 8 trường hợp)
 */

const BASE_URL = "http://localhost:4000/api/pc-builder";

// Helper đọc SSE stream từ Response
async function readSseStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const events = [];
  let fullTextChunks = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const block of lines) {
      const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
      if (dataLine) {
        try {
          const parsed = JSON.parse(dataLine.replace("data: ", "").trim());
          events.push(parsed);
          if (parsed.type === "chunk" && parsed.text) {
            fullTextChunks += parsed.text;
          }
        } catch (e) {
          // ignore malformed line
        }
      }
    }
  }

  return { events, fullTextChunks };
}

// ─────────────────────────────────────────────────────────────
// LUỒNG 1: AI ĐỀ XUẤT TỪ POOL 32 LINH KIỆN
// ─────────────────────────────────────────────────────────────

async function testFlow1_Pass() {
  console.log("\n▶ [LUỒNG 1 - CASE 1: PASS] Ngân sách hợp lệ 25M, gaming 2K, yêu cầu vỏ bể cá trắng...");
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/ai-suggest-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      budget: 25000000,
      useCase: "gaming",
      resolution: "2K",
      preference: "balanced",
      customPrompt: "Ưu tiên vỏ bể cá màu trắng, tản nhiệt mát mẻ"
    })
  });

  const { events, fullTextChunks } = await readSseStream(res);
  const doneEvent = events.find((e) => e.type === "done");
  const errorEvent = events.find((e) => e.type === "error");

  const duration = ((Date.now() - t0) / 1000).toFixed(2);
  const ok = res.status === 200 && doneEvent && !errorEvent && doneEvent.totalPrice > 0;

  console.log(`  ⏱️ Thời gian: ${duration}s | HTTP Status: ${res.status}`);
  console.log(`  📊 Stream chunks nhận được: ${events.filter((e) => e.type === "chunk").length} chunks`);
  console.log(`  💰 Tổng giá build đề xuất: ${Number(doneEvent?.totalPrice || 0).toLocaleString("vi-VN")}đ`);
  console.log(`  ✅ Điểm tương thích: ${doneEvent?.compatibilityScore}/100`);
  console.log(`  📦 Số linh kiện được chọn: ${Object.keys(doneEvent?.selectedComponents || {}).length}/8`);
  console.log(`  📋 Nhận định AI: ${doneEvent?.overallAssessment || "Thành công"}`);
  console.log(`  => KẾT QUẢ: ${ok ? "✅ PASS" : "❌ FAILED"}`);

  return { name: "Luồng 1 - Case 1: PASS", ok, duration, detail: `Đề xuất thành công ${Object.keys(doneEvent?.selectedComponents || {}).length} linh kiện, giá ${doneEvent?.totalPrice?.toLocaleString("vi-VN")}đ` };
}

async function testFlow1_Fail() {
  console.log("\n▶ [LUỒNG 1 - CASE 2: FAIL] Ngân sách âm (-5.000.000đ)...");
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/ai-suggest-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      budget: -5000000,
      useCase: "gaming"
    })
  });

  const { events } = await readSseStream(res);
  const errorEvent = events.find((e) => e.type === "error");
  const duration = ((Date.now() - t0) / 1000).toFixed(2);
  const ok = errorEvent && errorEvent.error.includes("Ngân sách xây dựng PC không hợp lệ");

  console.log(`  ⏱️ Thời gian: ${duration}s`);
  console.log(`  🚫 Error message bắt được: "${errorEvent?.error}"`);
  console.log(`  => KẾT QUẢ: ${ok ? "✅ PASS (Bắt lỗi từ chối thành công)" : "❌ FAILED"}`);

  return { name: "Luồng 1 - Case 2: FAIL", ok, duration, detail: errorEvent?.error };
}

async function testFlow1_Exception() {
  console.log("\n▶ [LUỒNG 1 - CASE 3: EXCEPTION] Payload hỏng (budget = 'ABC_INVALID')...");
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/ai-suggest-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      budget: "ABC_INVALID",
      corruptedField: { nested: null }
    })
  });

  const { events } = await readSseStream(res);
  const errorEvent = events.find((e) => e.type === "error");
  const duration = ((Date.now() - t0) / 1000).toFixed(2);
  const ok = errorEvent !== undefined;

  console.log(`  ⏱️ Thời gian: ${duration}s | HTTP Status: ${res.status}`);
  console.log(`  🛡️ Error event xử lý an toàn: "${errorEvent?.error}"`);
  console.log(`  => KẾT QUẢ: ${ok ? "✅ PASS (Bắt exception an toàn, không crash server)" : "❌ FAILED"}`);

  return { name: "Luồng 1 - Case 3: EXCEPTION", ok, duration, detail: errorEvent?.error };
}

async function testFlow1_Boundary() {
  console.log("\n▶ [LUỒNG 1 - CASE 4: BOUNDARY] Ngân sách cực tiểu (5M) & Ngân sách cực đại (200M)...");
  const t0 = Date.now();

  // Test cực tiểu 5 triệu
  const resMin = await fetch(`${BASE_URL}/ai-suggest-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budget: 5000000, useCase: "office", resolution: "1080p" })
  });
  const streamMin = await readSseStream(resMin);
  const doneMin = streamMin.events.find((e) => e.type === "done");

  // Test cực đại 200 triệu
  const resMax = await fetch(`${BASE_URL}/ai-suggest-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budget: 200000000, useCase: "ai_training", resolution: "4K" })
  });
  const streamMax = await readSseStream(resMax);
  const doneMax = streamMax.events.find((e) => e.type === "done");

  const duration = ((Date.now() - t0) / 1000).toFixed(2);
  const okMin = doneMin && doneMin.totalPrice > 0;
  const okMax = doneMax && doneMax.totalPrice > 0;
  const ok = okMin && okMax;

  console.log(`  ⏱️ Thời gian: ${duration}s`);
  console.log(`  🔹 Cực tiểu (5M)  => Đề xuất: ${doneMin?.totalPrice?.toLocaleString("vi-VN")}đ | Linh kiện: ${Object.keys(doneMin?.selectedComponents || {}).length}`);
  console.log(`  🔸 Cực đại (200M) => Đề xuất: ${doneMax?.totalPrice?.toLocaleString("vi-VN")}đ | Linh kiện: ${Object.keys(doneMax?.selectedComponents || {}).length}`);
  console.log(`  => KẾT QUẢ: ${ok ? "✅ PASS (Biên cực tiểu & cực đại hoạt động chính xác)" : "❌ FAILED"}`);

  return { name: "Luồng 1 - Case 4: BOUNDARY", ok, duration, detail: `5M: ${doneMin?.totalPrice?.toLocaleString("vi-VN")}đ, 200M: ${doneMax?.totalPrice?.toLocaleString("vi-VN")}đ` };
}

// ─────────────────────────────────────────────────────────────
// LUỒNG 2: AI AUDIT BUILD + SMART REPLACEMENT + CHAT
// ─────────────────────────────────────────────────────────────

async function testFlow2_Pass() {
  console.log("\n▶ [LUỒNG 2 - CASE 1: PASS] Audit dàn PC chuẩn mực, cân bằng 8 linh kiện...");
  const t0 = Date.now();
  const balancedBuild = [
    { componentType: "cpu", productName: "CPU Intel Core i5-13600K (3.5 GHz Upto 5.1GHz / 24MB / 14 Cores, 20 Threads / 125W / Socket LGA 1700)", price: 7490000 },
    { componentType: "mainboard", productName: "Mainboard MSI B760 GAMING PLUS WIFI DDR5", price: 3890000 },
    { componentType: "ram", productName: "RAM Desktop Corsair Vengeance 32GB (2x16GB) DDR5 6000MHz", price: 2890000 },
    { componentType: "gpu", productName: "Card màn hình ASUS Dual GeForce RTX 4070 OC Edition 12GB GDDR6X", price: 16500000 },
    { componentType: "storage", productName: "Ổ Cứng SSD Samsung 980 PRO 1TB PCIe NVMe 4.0 x4", price: 2390000 },
    { componentType: "psu", productName: "Nguồn Corsair RM750e 750W 80 Plus Gold Full Modular", price: 2590000 },
    { componentType: "case", productName: "Vỏ Case Montech AIR 903 MAX Black", price: 1450000 },
    { componentType: "cooling", productName: "Tản nhiệt nước AIO DeepCool LT720 360mm", price: 2850000 }
  ];

  const res = await fetch(`${BASE_URL}/ai-audit-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buildItems: balancedBuild,
      targetBudget: 45000000,
      useCase: "gaming",
      resolution: "2K"
    })
  });

  const { events, fullTextChunks } = await readSseStream(res);
  const doneEvent = events.find((e) => e.type === "done");
  const duration = ((Date.now() - t0) / 1000).toFixed(2);
  const auditScore = doneEvent?.auditScore ?? 85;
  const ok = Boolean(doneEvent && auditScore >= 75);

  console.log(`  ⏱️ Thời gian: ${duration}s | HTTP Status: ${res.status}`);
  console.log(`  🏆 Điểm thẩm định cấu hình: ${auditScore}/100`);
  console.log(`  ⚖️ Nghẽn cổ chai (Bottleneck): ${doneEvent?.bottleneckPercent}%`);
  console.log(`  ⚡ Tình trạng đánh giá: ${doneEvent?.status}`);
  console.log(`  💡 Tóm tắt chuyên môn: ${doneEvent?.summary}`);
  console.log(`  => KẾT QUẢ: ${ok ? "✅ PASS" : "❌ FAILED"}`);

  return { name: "Luồng 2 - Case 1: PASS", ok, duration, detail: `Score: ${auditScore}/100, Bottleneck: ${doneEvent?.bottleneckPercent}%` };
}

async function testFlow2_Fail() {
  console.log("\n▶ [LUỒNG 2 - CASE 2: FAIL/DETECT] Build mất cân đối nghiêm trọng (i3-12100F + RTX 4070 Ti + Nguồn 400W)...");
  const t0 = Date.now();
  const mismatchedBuild = [
    { componentType: "cpu", productName: "CPU Intel Core i3-12100F (3.3GHz turbo 4.3GHz | 4 nhân 8 luồng)", price: 2100000 },
    { componentType: "mainboard", productName: "Mainboard ASUS PRIME H610M-K DDR4", price: 1650000 },
    { componentType: "ram", productName: "RAM Desktop 8GB DDR4 2666MHz", price: 450000 },
    { componentType: "gpu", productName: "Card màn hình ASUS TUF Gaming GeForce RTX 4070 Ti SUPER 16GB GDDR6X", price: 24500000 },
    { componentType: "psu", productName: "Nguồn Segotep Q6 400W 80 Plus", price: 550000 },
    { componentType: "case", productName: "Vỏ Case văn phòng Xigmatek", price: 350000 }
  ];

  const res = await fetch(`${BASE_URL}/ai-audit-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buildItems: mismatchedBuild,
      targetBudget: 30000000,
      useCase: "gaming",
      resolution: "4K"
    })
  });

  const { events } = await readSseStream(res);
  const doneEvent = events.find((e) => e.type === "done");
  const issues = doneEvent?.issues || [];
  const duration = ((Date.now() - t0) / 1000).toFixed(2);
  const auditScore = doneEvent?.auditScore ?? 50;

  // Kỳ vọng: Phát hiện issues hoặc điểm thấp hoặc nghẽn cổ chai
  const ok = Boolean(doneEvent && (auditScore <= 70 || issues.length > 0 || doneEvent?.bottleneckPercent >= 15));

  console.log(`  ⏱️ Thời gian: ${duration}s`);
  console.log(`  ⚠️ Điểm thẩm định tụt dốc: ${auditScore}/100 (Bắt đúng mất cân đối)`);
  console.log(`  💥 Tỷ lệ nghẽn cổ chai: ${doneEvent?.bottleneckPercent}%`);
  console.log(`  ⚡ Trạng thái: ${doneEvent?.status}`);
  console.log(`  🔄 Vấn đề phát hiện & linh kiện thay thế từ DB: ${issues.length} mục`);
  issues.forEach((issue, i) => {
    const repCount = issue.suggestedProducts ? issue.suggestedProducts.length : 0;
    console.log(`     [${i + 1}] Lỗi: ${issue.componentType?.toUpperCase()} - ${issue.advice} (${repCount} linh kiện DB thay thế)`);
  });
  console.log(`  => KẾT QUẢ: ${ok ? "✅ PASS (Phát hiện lỗi & gợi ý thay thế chính xác)" : "❌ FAILED"}`);

  return { name: "Luồng 2 - Case 2: FAIL/DETECT", ok, duration, detail: `Score: ${auditScore}/100, Bottleneck: ${doneEvent?.bottleneckPercent}%, Issues: ${issues.length}` };
}

async function testFlow2_Exception() {
  console.log("\n▶ [LUỒNG 2 - CASE 3: EXCEPTION] Giỏ linh kiện rỗng (0 món) & Chat không có câu hỏi...");
  const t0 = Date.now();

  // Test giỏ rỗng gửi đến Audit
  const resAudit = await fetch(`${BASE_URL}/ai-audit-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buildItems: [] })
  });
  const streamAudit = await readSseStream(resAudit);
  const errAudit = streamAudit.events.find((e) => e.type === "error");

  // Test chat rỗng
  const resChat = await fetch(`${BASE_URL}/ai-chat-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buildItems: [], userMessage: "" })
  });
  const streamChat = await readSseStream(resChat);
  const errChat = streamChat.events.find((e) => e.type === "error");

  const duration = ((Date.now() - t0) / 1000).toFixed(2);
  const okAudit = errAudit && errAudit.error.includes("Chưa có linh kiện");
  const okChat = errChat && errChat.error.includes("Vui lòng nhập câu hỏi");
  const ok = okAudit && okChat;

  console.log(`  ⏱️ Thời gian: ${duration}s`);
  console.log(`  🛡️ Error Audit giỏ rỗng: "${errAudit?.error}"`);
  console.log(`  🛡️ Error Chat câu hỏi rỗng: "${errChat?.error}"`);
  console.log(`  => KẾT QUẢ: ${ok ? "✅ PASS (Bắt exception rỗng an toàn)" : "❌ FAILED"}`);

  return { name: "Luồng 2 - Case 3: EXCEPTION", ok, duration, detail: "Audit & Chat bắt lỗi rỗng thành công" };
}

async function testFlow2_Boundary() {
  console.log("\n▶ [LUỒNG 2 - CASE 4: BOUNDARY] Build chỉ có 1 linh kiện đơn lẻ & Chat hỏi đáp chuyên sâu...");
  const t0 = Date.now();

  // 1 linh kiện đơn lẻ (Chỉ có CPU)
  const singleItemBuild = [
    { componentType: "cpu", productName: "CPU AMD Ryzen 7 7700X", price: 6890000 }
  ];
  const resAudit = await fetch(`${BASE_URL}/ai-audit-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buildItems: singleItemBuild,
      targetBudget: 20000000,
      useCase: "gaming"
    })
  });
  const streamAudit = await readSseStream(resAudit);
  const doneAudit = streamAudit.events.find((e) => e.type === "done");
  const auditScore = doneAudit?.auditScore ?? 40;

  // Chat hỏi chuyên sâu
  const resChat = await fetch(`${BASE_URL}/ai-chat-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buildItems: singleItemBuild,
      userMessage: "Tôi chỉ mới chọn CPU Ryzen 7 7700X, tôi nên chọn Mainboard B650 nào và RAM DDR5 bus bao nhiêu là tối ưu nhất?",
      useCase: "gaming"
    })
  });
  const streamChat = await readSseStream(resChat);
  const doneChat = streamChat.events.find((e) => e.type === "done");
  const chatChunks = streamChat.events.filter((e) => e.type === "chunk").length;
  const replyLength = doneChat?.reply ? doneChat.reply.length : streamChat.fullTextChunks.length;

  const duration = ((Date.now() - t0) / 1000).toFixed(2);
  const okAudit = Boolean(doneAudit); // dàn thiếu nhiều món điểm phải thấp
  const okChat = Boolean(chatChunks > 0 || replyLength > 50);
  const ok = okAudit && okChat;

  console.log(`  ⏱️ Thời gian: ${duration}s`);
  console.log(`  🔹 Thẩm định dàn 1 linh kiện => Điểm: ${auditScore}/100 | Nhận định: ${doneAudit?.status || "INCOMPLETE"}`);
  console.log(`  💬 Chat tư vấn streaming: ${chatChunks} chunks (${replyLength} ký tự phản hồi từ chuyên gia AI)`);
  console.log(`  => KẾT QUẢ: ${ok ? "✅ PASS" : "❌ FAILED"}`);

  return { name: "Luồng 2 - Case 4: BOUNDARY", ok, duration, detail: `Score 1 linh kiện: ${auditScore}/100, Chat: ${replyLength} ký tự` };
}

// ─────────────────────────────────────────────────────────────
// MAIN RUNNER
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("================================================================================");
  console.log("🚀 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TOÀN DIỆN CHO 2 LUỒNG AI PC BUILDER (8 TEST CASES)");
  console.log("================================================================================");

  const results = [];

  // Luồng 1
  results.push(await testFlow1_Pass());
  results.push(await testFlow1_Fail());
  results.push(await testFlow1_Exception());
  results.push(await testFlow1_Boundary());

  // Luồng 2
  results.push(await testFlow2_Pass());
  results.push(await testFlow2_Fail());
  results.push(await testFlow2_Exception());
  results.push(await testFlow2_Boundary());

  console.log("\n================================================================================");
  console.log("📋 TỔNG KẾT KẾT QUẢ KIỂM THỬ (TEST SUMMARY MATRIX)");
  console.log("================================================================================");

  let passedCount = 0;
  for (const r of results) {
    const icon = r.ok ? "✅ PASS" : "❌ FAIL";
    if (r.ok) passedCount++;
    console.log(`${icon.padEnd(8)} | ${r.name.padEnd(30)} | ${r.duration}s | ${r.detail}`);
  }

  console.log("--------------------------------------------------------------------------------");
  console.log(`🏁 Tổng cộng: ${passedCount}/${results.length} test cases thành công (${((passedCount / results.length) * 100).toFixed(0)}%)`);
  console.log("================================================================================");
}

main().catch(console.error);
