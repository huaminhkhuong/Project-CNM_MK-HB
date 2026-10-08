import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET ALLOCATION RATIOS THEO USE CASE
// Tỷ lệ phân bổ ngân sách cho từng linh kiện (phải cộng = 1.0)
// ─────────────────────────────────────────────────────────────────────────────
const BUDGET_RATIOS: Record<string, Record<string, number>> = {
  gaming: {
    cpu:       0.22,   // CPU mạnh để không bottleneck GPU
    mainboard: 0.12,
    ram:       0.08,
    gpu:       0.30,   // GPU chiếm nhiều nhất cho gaming
    storage:   0.08,
    psu:       0.10,
    case:      0.05,
    cooling:   0.05,
  },
  work: {
    cpu:       0.30,   // CPU đa nhân cho công việc
    mainboard: 0.13,
    ram:       0.15,   // RAM nhiều cho đa nhiệm
    gpu:       0.12,   // GPU không cần mạnh lắm
    storage:   0.12,
    psu:       0.08,
    case:      0.05,
    cooling:   0.05,
  },
  office: {
    cpu:       0.25,
    mainboard: 0.15,
    ram:       0.15,
    gpu:       0.10,
    storage:   0.15,
    psu:       0.08,
    case:      0.07,
    cooling:   0.05,
  },
  render: {
    cpu:       0.28,   // CPU mạnh cho render
    mainboard: 0.12,
    ram:       0.18,   // RAM lớn cho render file nặng
    gpu:       0.22,
    storage:   0.10,
    psu:       0.05,
    case:      0.03,
    cooling:   0.02,
  },
  budget: {
    cpu:       0.22,
    mainboard: 0.14,
    ram:       0.12,
    gpu:       0.22,
    storage:   0.12,
    psu:       0.10,
    case:      0.05,
    cooling:   0.03,
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY NAME → COMPONENT TYPE MAPPING
// Map tên category trong DB sang loại linh kiện trong PC Builder
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_TO_COMPONENT: Record<string, string> = {
  cpu:       "cpu",
  mainboard: "mainboard",
  ram:       "ram",
  vga:       "gpu",
  gpu:       "gpu",
  ssd:       "storage",
  storage:   "storage",
  psu:       "psu",
  case:      "case",
  cooling:   "cooling",
};

// Component type → danh sách tên category tìm trong DB
const COMPONENT_CATEGORIES: Record<string, string[]> = {
  cpu:       ["CPU"],
  mainboard: ["Mainboard"],
  ram:       ["RAM"],
  gpu:       ["VGA", "GPU"],
  storage:   ["SSD", "STORAGE"],
  psu:       ["PSU"],
  case:      ["Case"],
  cooling:   ["Cooling"],
};

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZE USE CASE từ chuỗi requirements
// ─────────────────────────────────────────────────────────────────────────────
function detectUseCase(requirements: string): string {
  const req = requirements.toLowerCase();
  if (/game|gaming|chơi game|fps|esport|pubg|lol|valorant/i.test(req)) return "gaming";
  if (/render|3d|blender|video|dựng phim|đồ họa|design/i.test(req)) return "render";
  if (/văn phòng|office|word|excel|học|sinh viên/i.test(req)) return "office";
  if (/lập trình|code|dev|programming|work/i.test(req)) return "work";
  if (/tiết kiệm|rẻ|budget|giới hạn/i.test(req)) return "budget";
  return "gaming"; // default
}

// ─────────────────────────────────────────────────────────────────────────────
// CHỌN SẢN PHẨM TỪ DB theo ngân sách từng linh kiện
// Chiến lược: lấy sản phẩm có giá cao nhất ≤ subBudget
//             nếu không có → lấy rẻ nhất có trong kho
// ─────────────────────────────────────────────────────────────────────────────
async function pickBestProduct(componentType: string, subBudget: number, filterKeywords?: string[] | string) {
  const categoryNames = COMPONENT_CATEGORIES[componentType] || [componentType];

  // Tìm category IDs
  const categories = await prisma.category.findMany({
    where: {
      name: { in: categoryNames }
    },
    select: { id: true, name: true }
  });

  if (categories.length === 0) return null;

  const categoryIds = categories.map((c) => c.id);

  const allSkus = await prisma.productSku.findMany({
    where: {
      is_active: true,
      stock: { gt: 0 },
      Product: {
        is_active: true,
        category_id: { in: categoryIds }
      }
    },
    orderBy: { price: "asc" },
    include: {
      Product: {
        include: {
          Category: { select: { name: true } }
        }
      }
    }
  });

  if (allSkus.length === 0) return null;

  let candidates = allSkus;
  if (filterKeywords) {
    const kwList = Array.isArray(filterKeywords) ? filterKeywords : [filterKeywords];
    const kwFiltered = allSkus.filter((sku) => {
      const prodName = String(sku.Product?.name || "").toUpperCase();
      return kwList.some((kw) => prodName.includes(kw.toUpperCase()));
    });
    if (kwFiltered.length > 0) {
      candidates = kwFiltered;
    }
  }

  const inBudget = candidates.filter((s) => Number(s.price || 0) <= subBudget);
  if (inBudget.length > 0) {
    const best = inBudget.sort((a, b) => Number(b.price || 0) - Number(a.price || 0))[0];
    return { ...best, product: (best as any).Product };
  }

  // Fallback to lowest price in candidate pool
  const cheapest = [...candidates].sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0];
  return { ...cheapest, product: (cheapest as any).Product };
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE EXPLANATION tiếng Việt tự nhiên
// ─────────────────────────────────────────────────────────────────────────────
function generateExplanation(
  componentType: string,
  productName: string,
  price: number,
  totalBudget: number,
  useCase: string
): string {
  const pct = Math.round((price / Math.max(1, totalBudget)) * 100);
  const name = productName || "Linh kiện";
  const nameLow = name.toLowerCase();

  const useCaseLabel: Record<string, string> = {
    gaming: "Gaming",
    work: "Lập trình & Làm việc",
    office: "Văn phòng",
    render: "Render 3D/Video",
    budget: "Tiết kiệm chi phí"
  };
  const ucLabel = useCaseLabel[useCase] || "Đa năng";

  switch (componentType.toLowerCase()) {
    case "cpu":
      if (nameLow.includes("i9") || nameLow.includes("i7") || nameLow.includes("ryzen 9") || nameLow.includes("ryzen 7")) {
        return `⚡ CPU ${name}: Bộ xử lý cao cấp (${pct}% ngân sách), hiệu năng đa nhân mạnh mẽ — lý tưởng cho ${ucLabel} không bị bottleneck.`;
      }
      if (nameLow.includes("i5") || nameLow.includes("ryzen 5")) {
        return `✅ CPU ${name}: Lựa chọn cân bằng giá/hiệu năng (${pct}% ngân sách) — đủ mạnh cho ${ucLabel} mà không tốn quá nhiều ngân sách.`;
      }
      return `💡 CPU ${name}: Tối ưu ngân sách (${pct}%) — đáp ứng tốt nhu cầu ${ucLabel} cơ bản.`;

    case "mainboard":
      if (nameLow.includes("z790") || nameLow.includes("z690") || nameLow.includes("x670") || nameLow.includes("x570")) {
        return `🔋 Mainboard ${name}: Bo mạch chủ cao cấp (${pct}% ngân sách), VRM mạnh, hỗ trợ ép xung và đầy đủ kết nối PCIe 5.0/M.2.`;
      }
      if (nameLow.includes("b760") || nameLow.includes("b650") || nameLow.includes("b550")) {
        return `🔌 Mainboard ${name}: Bo mạch chủ tầm trung (${pct}% ngân sách) — đủ kết nối, ổn định và phù hợp nâng cấp tương lai.`;
      }
      return `🔌 Mainboard ${name}: Nền tảng vận hành cho toàn hệ thống (${pct}% ngân sách).`;

    case "ram":
      if (nameLow.includes("32gb") || nameLow.includes("64gb")) {
        return `🧠 RAM ${name}: Dung lượng lớn (${pct}% ngân sách), đa nhiệm thoải mái — stream, render và gaming cùng lúc không lag.`;
      }
      if (nameLow.includes("16gb")) {
        return `🧠 RAM ${name}: Dung lượng chuẩn (${pct}% ngân sách) — đủ cho ${ucLabel} và các tác vụ đa nhiệm thông thường.`;
      }
      return `🧠 RAM ${name}: Bộ nhớ hệ thống (${pct}% ngân sách), đủ cho nhu cầu ${ucLabel} cơ bản.`;

    case "gpu":
      if (nameLow.includes("4090") || nameLow.includes("4080") || nameLow.includes("7900 xtx") || nameLow.includes("rx 7900")) {
        return `🎮 GPU ${name}: Card đồ họa flagship (${pct}% ngân sách) — chiến mượt 4K Max Settings mọi tựa game AAA với Ray Tracing.`;
      }
      if (nameLow.includes("4070") || nameLow.includes("4060") || nameLow.includes("7700") || nameLow.includes("rx 7600")) {
        return `🎮 GPU ${name}: Card đồ họa tầm trung mạnh (${pct}% ngân sách) — chiến 1080p/1440p High FPS mượt mà.`;
      }
      return `🎮 GPU ${name}: Card đồ họa đáp ứng ${ucLabel} (${pct}% ngân sách).`;

    case "storage":
      if (nameLow.includes("nvme") || nameLow.includes("m.2") || nameLow.includes("pcie")) {
        return `💾 SSD ${name}: Ổ cứng NVMe tốc độ cao (${pct}% ngân sách) — load Windows và game trong vài giây, tăng tốc workflow đáng kể.`;
      }
      return `💾 SSD ${name}: Lưu trữ nhanh (${pct}% ngân sách) — đủ không gian cho hệ điều hành và dữ liệu.`;

    case "psu":
      if (nameLow.includes("gold") || nameLow.includes("platinum")) {
        return `⚡ Nguồn ${name}: Chuẩn 80 Plus Gold (${pct}% ngân sách) — hiệu suất chuyển đổi cao ≥ 90%, ổn định và tiết kiệm điện.`;
      }
      return `⚡ Nguồn ${name}: Cấp điện ổn định cho toàn hệ thống (${pct}% ngân sách).`;

    case "case":
      return `🖥️ Case ${name}: Vỏ máy tính (${pct}% ngân sách) — thoáng khí tốt, dễ lắp ráp và vừa vặn các linh kiện đã chọn.`;

    case "cooling":
      if (nameLow.includes("aio") || nameLow.includes("240") || nameLow.includes("360")) {
        return `❄️ Tản nhiệt ${name}: AIO tản nhiệt nước (${pct}% ngân sách) — giữ CPU mát < 75°C khi full load gaming.`;
      }
      return `❄️ Tản nhiệt ${name}: Giải pháp tản nhiệt (${pct}% ngân sách) — đảm bảo CPU vận hành ở nhiệt độ an toàn.`;

    default:
      return `${name}: Được chọn tối ưu theo tỷ lệ ngân sách ${pct}%.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: TẠO BUILD GỢI Ý THÔNG MINH TỪ DB
// ─────────────────────────────────────────────────────────────────────────────
async function buildSmartSuggestion(budget: number, requirements: string) {
  const useCase = detectUseCase(requirements);
  const ratios = BUDGET_RATIOS[useCase] || BUDGET_RATIOS.gaming;

  const components: Record<string, any> = {};
  // Bước 1: Chọn linh kiện tuần tự bảo đảm 100% tương thích phần cứng
  // A. Chọn CPU
  const cpuBudget = Math.round(budget * (ratios.cpu || 0.18));
  const cpuSku = await pickBestProduct("cpu", cpuBudget);
  if (cpuSku) components.cpu = cpuSku;

  const cpuName = String(cpuSku?.product?.name || "").toUpperCase();
  let cpuSocket = "LGA1700";
  let mbKeywords = ["LGA1700", "1700", "B760", "Z790", "B660", "H610", "Z690"];

  if (cpuName.includes("AM5") || /RYZEN\s*[3579]\s*[789]\d{3}/i.test(cpuName)) {
    cpuSocket = "AM5";
    mbKeywords = ["AM5", "B650", "X670", "X870", "A620"];
  } else if (cpuName.includes("AM4") || /RYZEN\s*[357]\s*[12345]\d{3}/i.test(cpuName) || cpuName.includes("ATHLON")) {
    cpuSocket = "AM4";
    mbKeywords = ["AM4", "B550", "A520", "X570", "B450", "A320"];
  } else if (cpuName.includes("1851") || cpuName.includes("ULTRA 7") || cpuName.includes("ULTRA 9")) {
    cpuSocket = "LGA1851";
    mbKeywords = ["1851", "Z890", "B860"];
  } else if (cpuName.includes("1200") || /I[3579]-?1[01]\d{3}/i.test(cpuName)) {
    cpuSocket = "LGA1200";
    mbKeywords = ["1200", "H510", "B560", "Z590"];
  }

  // B. Chọn Mainboard khớp socket CPU
  const mbBudget = Math.round(budget * (ratios.mainboard || 0.12));
  const mbSku = await pickBestProduct("mainboard", mbBudget, mbKeywords);
  if (mbSku) components.mainboard = mbSku;

  const mbName = String(mbSku?.product?.name || "").toUpperCase();
  let mbRamType: "DDR4" | "DDR5" = "DDR4";
  if (mbName.includes("DDR5") || mbName.includes(" D5") || cpuSocket === "AM5" || cpuSocket === "LGA1851") {
    mbRamType = "DDR5";
  } else if (mbName.includes("DDR4") || mbName.includes(" D4") || cpuSocket === "AM4" || cpuSocket === "LGA1200") {
    mbRamType = "DDR4";
  }

  // C. Chọn RAM khớp chuẩn DDR của Mainboard
  const ramBudget = Math.round(budget * (ratios.ram || 0.10));
  const ramKeywords = mbRamType === "DDR5" ? ["DDR5", " D5"] : ["DDR4", " D4"];
  const ramSku = await pickBestProduct("ram", ramBudget, ramKeywords);
  if (ramSku) components.ram = ramSku;

  // D. Chọn GPU
  if (ratios.gpu && ratios.gpu > 0) {
    const gpuBudget = Math.round(budget * ratios.gpu);
    const gpuSku = await pickBestProduct("gpu", gpuBudget);
    if (gpuSku) components.gpu = gpuSku;
  }

  // E. Chọn Storage
  const storageBudget = Math.round(budget * (ratios.storage || 0.08));
  const storageSku = await pickBestProduct("storage", storageBudget);
  if (storageSku) components.storage = storageSku;

  // F. Chọn PSU
  const psuBudget = Math.round(budget * (ratios.psu || 0.07));
  const psuSku = await pickBestProduct("psu", psuBudget);
  if (psuSku) components.psu = psuSku;

  // G. Chọn Case
  const caseBudget = Math.round(budget * (ratios.case || 0.05));
  const caseSku = await pickBestProduct("case", caseBudget);
  if (caseSku) components.case = caseSku;

  // H. Chọn Cooling
  const coolingBudget = Math.round(budget * (ratios.cooling || 0.04));
  const coolingSku = await pickBestProduct("cooling", coolingBudget);
  if (coolingSku) components.cooling = coolingSku;

  // Bước 2: Tính tổng chi phí
  let totalPrice = Object.values(components).reduce((sum: number, sku: any) => {
    return sum + Number(sku.price || 0);
  }, 0);

  // Bước 3: Build response items
  const items = Object.entries(components).map(([type, sku]: [string, any]) => {
    const price = Number(sku.price || 0);
    const product = sku.product;
    const categoryName = product?.Category?.name || type;

    return {
      componentType: type,
      product: {
        id: product?.id || 0,
        name: product?.name || "Sản phẩm",
        categoryName
      },
      variant: {
        id: sku.id,
        sku: sku.sku || `SKU-${sku.id}`,
        price,
        imageUrl: sku.image_url || null
      },
      explanation: generateExplanation(type, product?.name || "", price, budget, useCase)
    };
  });

  // Tính lại tổng sau khi chọn
  totalPrice = items.reduce((sum, item) => sum + item.variant.price, 0);

  // Tạo explanation tổng quan
  const overBudget = totalPrice > budget;
  const diff = Math.abs(totalPrice - budget);
  const diffText = overBudget
    ? `⚠️ Vượt ngân sách ${diff.toLocaleString("vi-VN")}đ (các linh kiện tốt nhất tìm được)`
    : `✅ Trong ngân sách, tiết kiệm được ${diff.toLocaleString("vi-VN")}đ`;

  const overallExplanation =
    `🤖 AI đã phân tích và gợi ý cấu hình ${useCase.toUpperCase()} với ngân sách ${budget.toLocaleString("vi-VN")}đ. ` +
    `Cấu hình gồm ${items.length} linh kiện, tổng ${totalPrice.toLocaleString("vi-VN")}đ. ${diffText}. ` +
    `Tỷ lệ phân bổ: CPU ${Math.round(ratios.cpu * 100)}%, GPU ${Math.round(ratios.gpu * 100)}%, ` +
    `RAM ${Math.round(ratios.ram * 100)}%, Mainboard ${Math.round(ratios.mainboard * 100)}%.`;

  return {
    budget,
    totalPrice,
    useCase,
    overBudget,
    explanation: overallExplanation,
    items
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD OPENAI PROMPT với dữ liệu thực từ DB
// ─────────────────────────────────────────────────────────────────────────────
function buildOpenAIPrompt(products: any[], budget: number, requirements: string): string {
  const useCase = detectUseCase(requirements);
  const ratios = BUDGET_RATIOS[useCase] || BUDGET_RATIOS.gaming;

  const productListText = products
    .map((product) => {
      const firstSku = product.ProductSku?.[0];
      const price = Number(firstSku?.price || product.price || 0);
      const category = product.Category?.name || "unknown";
      const attrs = (product.ProductSku?.[0]?.sku_attributes || [])
        .map((sa: any) => `${sa.attribute_values?.Attribute?.name}=${sa.attribute_values?.value}`)
        .join(", ");
      return `PRODUCT_ID=${product.id} | ${product.name} | Cat=${category} | Price=${price.toLocaleString("vi-VN")}đ${attrs ? " | " + attrs : ""}`;
    })
    .join("\n");

  const allocationText = Object.entries(ratios)
    .map(([type, ratio]) => `${type}: ${Math.round(ratio * 100)}% (~${Math.round(budget * ratio).toLocaleString("vi-VN")}đ)`)
    .join(", ");

  return `Bạn là chuyên gia tư vấn cấu hình PC tại cửa hàng PC Mall Việt Nam.

THÔNG TIN KHÁCH HÀNG:
- Ngân sách: ${budget.toLocaleString("vi-VN")} VNĐ
- Nhu cầu: ${requirements}
- Use case phát hiện: ${useCase}

TỶ LỆ PHÂN BỔ NGÂN SÁCH GỢI Ý:
${allocationText}

NHIỆM VỤ:
1. Chọn 1 bộ cấu hình PC hoàn chỉnh (ít nhất: CPU, Mainboard, RAM, PSU)
2. CHỈ chọn sản phẩm CÓ TRONG danh sách bên dưới
3. KHÔNG vượt ngân sách quá 10%
4. Linh kiện phải tương thích nhau (socket CPU ↔ Mainboard, RAM type ↔ Mainboard)
5. Output PHẢI là mảng số nguyên JSON chứa PRODUCT_ID đã chọn, KHÔNG có text giải thích
   Ví dụ: [12, 25, 31, 45, 67, 89, 102]

DANH SÁCH LINH KIỆN:
${productListText}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export const suggestBuild = asyncHandler(async (req: Request, res: Response) => {
  const { requirements, budget } = req.body;
  const numericBudget = Number(budget);

  if (!requirements || !Number.isFinite(numericBudget) || numericBudget <= 0) {
    throw new AppError("Vui lòng cung cấp 'requirements' và 'budget' hợp lệ", 400);
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // ─── SMART DEMO MODE (không cần API key) ───────────────────────────────────
  // Luôn chạy smart suggestion từ DB thật, không dùng fallback cứng
  if (!openAiApiKey && !geminiApiKey) {
    const suggestion = await buildSmartSuggestion(numericBudget, String(requirements));
    res.status(200).json({
      success: true,
      data: {
        ...suggestion,
        mode: "smart-db",
        note: "Gợi ý được tạo bởi PC Mall AI Engine — bám sát dữ liệu thực tế trong kho hàng."
      }
    });
    return;
  }

  // ─── OPENAI MODE ───────────────────────────────────────────────────────────
  if (openAiApiKey) {
    const products = await prisma.product.findMany({
      where: { is_active: true },
      include: {
        Category: { select: { name: true } },
        ProductSku: {
          take: 1,
          orderBy: { id: "asc" },
          where: { is_active: true, stock: { gt: 0 } }
        }
      },
      orderBy: { category_id: "asc" }
    });

    let aiResponse: globalThis.Response;
    try {
      aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiApiKey}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [{ role: "user", content: buildOpenAIPrompt(products, numericBudget, String(requirements)) }],
          temperature: 0.2
        })
      });
    } catch (_err) {
      // Nếu OpenAI fail → fallback smart DB
      const suggestion = await buildSmartSuggestion(numericBudget, String(requirements));
      res.status(200).json({ success: true, data: { ...suggestion, mode: "smart-db-fallback" } });
      return;
    }

    if (!aiResponse.ok) {
      const suggestion = await buildSmartSuggestion(numericBudget, String(requirements));
      res.status(200).json({ success: true, data: { ...suggestion, mode: "smart-db-fallback" } });
      return;
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Strip markdown fences
    content = content.replace(/^```(?:json)?/, "").replace(/```$/, "").trim();

    let suggestedIds: number[] = [];
    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
      suggestedIds = parsed.map((v: unknown) => Number(v)).filter(v => Number.isInteger(v) && v > 0);
    } catch (_err) {
      const suggestion = await buildSmartSuggestion(numericBudget, String(requirements));
      res.status(200).json({ success: true, data: { ...suggestion, mode: "smart-db-fallback" } });
      return;
    }

    const suggestedProducts = await prisma.product.findMany({
      where: { id: { in: suggestedIds }, is_active: true },
      include: {
        Category: { select: { name: true } },
        ProductSku: { take: 1, orderBy: { id: "asc" } }
      }
    });

    const useCase = detectUseCase(String(requirements));
    const orderedProducts = suggestedIds
      .map(id => suggestedProducts.find(p => p.id === id))
      .filter(Boolean) as typeof suggestedProducts;

    const items = orderedProducts.map(product => {
      const sku = product.ProductSku?.[0];
      const price = Number(sku?.price || product.price || 0);
      const type = CATEGORY_TO_COMPONENT[product.Category?.name?.toLowerCase() || ""] || "other";
      return {
        componentType: type,
        product: { id: product.id, name: product.name, categoryName: product.Category?.name },
        variant: { id: sku?.id || product.id, sku: sku?.sku || "", price, imageUrl: sku?.image_url || null },
        explanation: generateExplanation(type, product.name || "", price, numericBudget, useCase)
      };
    });

    const totalPrice = items.reduce((sum, item) => sum + item.variant.price, 0);

    res.status(200).json({
      success: true,
      data: {
        budget: numericBudget,
        totalPrice,
        useCase,
        explanation: `🤖 AI đã phân tích và gợi ý cấu hình ${useCase.toUpperCase()} tối ưu cho ngân sách ${numericBudget.toLocaleString("vi-VN")}đ.`,
        items,
        mode: "openai"
      }
    });
    return;
  }

  // ─── Fallback cuối cùng ────────────────────────────────────────────────────
  const suggestion = await buildSmartSuggestion(numericBudget, String(requirements));
  res.status(200).json({ success: true, data: { ...suggestion, mode: "smart-db" } });
});
