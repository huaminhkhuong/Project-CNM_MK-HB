import { prisma } from "../../config/prisma";

export interface UserHardwareContext {
  userId?: number | null;
  hasActiveBuild: boolean;
  buildId?: number;
  buildName?: string;
  buildTotalPrice?: number;
  buildComponents?: Array<{
    type: string;
    name: string;
    price: number;
    sku: string;
    specs?: string;
  }>;
  missingComponents?: string[];
  hasCart: boolean;
  cartItemCount?: number;
  cartTotalPrice?: number;
  cartItems?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  recentOrders?: Array<{
    orderId: number;
    status: string;
    totalAmount: number;
  }>;
  activeWarranties?: Array<{
    code: string;
    productName: string;
  }>;
  formattedContextText: string;
}

const REQUIRED_PC_COMPONENTS = ["cpu", "mainboard", "ram", "storage", "psu", "case"];

/**
 * AiContextService — Unified User Hardware & Commerce Context Aggregator
 * Fuses user active PC build, shopping cart items, recent orders, and warranties
 * into a single unified context accessible to Chatbot, AI Advisor, and PC Builder.
 */
export class AiContextService {
  /**
   * Aggregate all available user context from database
   */
  public static async aggregateUserContext(
    userId?: number | null,
    sessionId?: string | null
  ): Promise<UserHardwareContext> {
    const result: UserHardwareContext = {
      userId: userId || null,
      hasActiveBuild: false,
      hasCart: false,
      formattedContextText: ""
    };

    if (!userId || !Number.isInteger(Number(userId)) || Number(userId) <= 0) {
      return result;
    }

    const cleanUserId = Number(userId);

    try {
      // 1. Fetch Latest Active/Saved PC Build
      const activeBuild = await prisma.pcBuild.findFirst({
        where: { user_id: cleanUserId },
        orderBy: [{ updated_at: "desc" }, { id: "desc" }],
        include: {
          PcBuildItem: {
            include: {
              ProductSku: {
                include: {
                  Product: {
                    select: { name: true, price: true }
                  }
                }
              }
            }
          }
        }
      });

      if (activeBuild) {
        const buildId = activeBuild.id;
        const components = (activeBuild.PcBuildItem || []).map((row) => {
          const sku = row.ProductSku;
          const product = sku?.Product;
          const price = sku?.price != null ? Number(sku.price) : (product?.price != null ? Number(product.price) : 0);
          const name = product?.name || row.component_type || "";
          return {
            type: String(row.component_type || "").toUpperCase(),
            name,
            price,
            sku: sku?.sku || ""
          };
        });

        const existingTypes = new Set(
          (activeBuild.PcBuildItem || []).map((r) => String(r.component_type || "").toLowerCase())
        );
        const missingComponents = REQUIRED_PC_COMPONENTS.filter(
          (req) => !existingTypes.has(req)
        );

        result.hasActiveBuild = components.length > 0;
        result.buildId = buildId;
        result.buildName = activeBuild.name || "Cấu hình PC của tôi";
        result.buildTotalPrice = Number(activeBuild.total_price || components.reduce((sum, c) => sum + c.price, 0));
        result.buildComponents = components;
        result.missingComponents = missingComponents;
      }

      // 2. Fetch User Shopping Cart Items
      const userCart = await prisma.cart.findFirst({
        where: { user_id: cleanUserId },
        include: {
          CartItem: {
            include: {
              ProductSku: {
                include: {
                  Product: {
                    select: { name: true, price: true }
                  }
                }
              }
            }
          }
        }
      });

      if (userCart && userCart.CartItem.length > 0) {
        result.hasCart = true;
        result.cartItemCount = userCart.CartItem.reduce((acc, item) => acc + Number(item.quantity || 1), 0);
        result.cartTotalPrice = userCart.CartItem.reduce((acc, item) => {
          const price = item.ProductSku?.price != null ? Number(item.ProductSku.price) : (item.ProductSku?.Product?.price != null ? Number(item.ProductSku.Product.price) : 0);
          return acc + price * Number(item.quantity || 1);
        }, 0);
        result.cartItems = userCart.CartItem.map((ci) => {
          const price = ci.ProductSku?.price != null ? Number(ci.ProductSku.price) : (ci.ProductSku?.Product?.price != null ? Number(ci.ProductSku.Product.price) : 0);
          return {
            name: ci.ProductSku?.Product?.name || "Sản phẩm",
            quantity: Number(ci.quantity || 1),
            price
          };
        });
      }

      // 3. Fetch Recent Orders (latest 2)
      const orderRows = await prisma.order.findMany({
        where: { user_id: cleanUserId },
        orderBy: { id: "desc" },
        take: 2,
        select: {
          id: true,
          status: true,
          total_price: true
        }
      });
      if (orderRows && orderRows.length > 0) {
        result.recentOrders = orderRows.map((o) => ({
          orderId: o.id,
          status: o.status || "",
          totalAmount: Number(o.total_price || 0)
        }));
      }

      // 4. Fetch Active Warranties
      const warrRows = await prisma.warrantyItem.findMany({
        where: { user_id: cleanUserId, status: "ACTIVE" },
        take: 2,
        select: {
          warranty_code: true,
          OrderItem: {
            select: {
              name_snapshot: true,
              ProductSku: {
                select: {
                  Product: {
                    select: { name: true }
                  }
                }
              }
            }
          }
        }
      });
      if (warrRows && warrRows.length > 0) {
        result.activeWarranties = warrRows.map((w) => ({
          code: w.warranty_code,
          productName: w.OrderItem?.name_snapshot || w.OrderItem?.ProductSku?.Product?.name || "Linh kiện"
        }));
      }

      // 5. Format unified markdown context string
      result.formattedContextText = this.buildContextMarkdown(result);
    } catch (err) {
      console.warn("[AiContextService] Failed to aggregate full user context:", err);
    }

    return result;
  }

  /**
   * Format context into high-value, token-efficient Markdown prompt section
   */
  public static buildContextMarkdown(context: UserHardwareContext): string {
    const sections: string[] = [];

    // Active PC Build
    if (context.hasActiveBuild && context.buildComponents && context.buildComponents.length > 0) {
      const compLines = context.buildComponents.map(
        (c) => `  • [${c.type}] ${c.name} — ${c.price > 0 ? c.price.toLocaleString("vi-VN") + "đ" : "Đã có"}`
      );
      const missingStr = context.missingComponents && context.missingComponents.length > 0
        ? `\n  ⚠️ Linh kiện còn thiếu trong dàn máy: ${context.missingComponents.join(", ").toUpperCase()}`
        : "\n  ✅ Dàn máy đã đầy đủ linh kiện cốt lõi.";

      sections.push(
        `[CẤU HÌNH PC KHÁCH ĐANG BUILD TẠI PC BUILDER]:\n` +
        `- Tên cấu hình: "${context.buildName}" (ID #${context.buildId})\n` +
        `- Tổng giá trị cấu hình: ${Number(context.buildTotalPrice || 0).toLocaleString("vi-VN")}đ\n` +
        `- Danh sách linh kiện đã chọn:\n${compLines.join("\n")}` +
        missingStr
      );
    }

    // Shopping Cart
    if (context.hasCart && context.cartItems && context.cartItems.length > 0) {
      const cartLines = context.cartItems.map(
        (ci) => `  • ${ci.quantity}x ${ci.name} (${ci.price.toLocaleString("vi-VN")}đ)`
      );
      sections.push(
        `[GIỎ HÀNG HIỆN TẠI CỦA KHÁCH]:\n` +
        `- Tổng: ${context.cartItemCount} sản phẩm, trị giá ${Number(context.cartTotalPrice || 0).toLocaleString("vi-VN")}đ\n` +
        cartLines.join("\n")
      );
    }

    // Recent Orders
    if (context.recentOrders && context.recentOrders.length > 0) {
      const orderLines = context.recentOrders.map(
        (o) => `  • Đơn #${o.orderId}: Trạng thái ${o.status} (${o.totalAmount.toLocaleString("vi-VN")}đ)`
      );
      sections.push(`[ĐƠN HÀNG GẦN ĐÂY]:\n${orderLines.join("\n")}`);
    }

    // Active Warranties
    if (context.activeWarranties && context.activeWarranties.length > 0) {
      const warrLines = context.activeWarranties.map(
        (w) => `  • Mã ${w.code}: ${w.productName}`
      );
      sections.push(`[BẢO HÀNH ĐANG HIỆU LỰC]:\n${warrLines.join("\n")}`);
    }

    if (sections.length === 0) {
      return "";
    }

    return (
      `\n\n═══════════════════════════════════════════════════════\n` +
      `NGỮ CẢNH NGƯỜI DÙNG HIỆN TẠI (SHARED USER CONTEXT):\n` +
      sections.join("\n\n") +
      `\n═══════════════════════════════════════════════════════\n` +
      `HƯỚNG DẪN AI: Nếu câu hỏi của khách hàng liên quan đến "cấu hình này", "máy tôi", "nguồn có đủ không", "giỏ hàng", "nâng cấp", hãy sử dụng trực tiếp các linh kiện trong ngữ cảnh trên để trả lời chính xác 100%!`
    );
  }

  /**
   * Generates a high-density, structured Handoff Briefing for Human Sales Staff.
   * Compiles customer intent, budget, active PC build, cart items, and AI Q&A history
   * so human staff never has to re-interview the customer from scratch.
   */
  public static buildHandoffBriefing(options: HandoffOptions): HandoffBriefingResult {
    const userContext = options.userContext || {
      hasActiveBuild: false,
      hasCart: false,
      formattedContextText: ""
    };
    const criteria = options.criteria || {};
    const aiHistory = options.aiHistory || [];
    const clientBuild = options.clientBuild;

    // 1. Nhu cầu & Tiêu chí
    const purposeMap: Record<string, string> = {
      gaming: "Chơi Game & Esports",
      rendering: "Đồ Họa, Thiết Kế & Render 3D",
      graphics: "Đồ Họa & Dựng Phim",
      office: "Văn Phòng & Học Tập",
      coding: "Lập Trình, AI & Server",
      workstation: "Workstation Chuyên Nghiệp"
    };

    const purposeStr = criteria.purpose
      ? purposeMap[criteria.purpose.toLowerCase()] || criteria.purpose
      : "Tư vấn cấu hình PC tối ưu";

    const budgetVal = Number(criteria.budget || 0);
    const budgetStr = budgetVal > 0 ? `${budgetVal.toLocaleString("vi-VN")} đ` : "Chưa xác định cụ thể";

    const resMap: Record<string, string> = {
      "1080p": "FHD (1080p) 144Hz - 240Hz",
      "2k": "2K QHD (1440p) 144Hz - 165Hz",
      "4k": "4K UHD Cao cấp"
    };
    const resStr = criteria.resolution ? resMap[criteria.resolution.toLowerCase()] || criteria.resolution : null;

    const ownedParts = Array.isArray(criteria.ownedList) && criteria.ownedList.length > 0
      ? criteria.ownedList.join(", ")
      : null;

    // 2. Cấu hình PC đang xem xét
    let buildName = userContext.buildName;
    let buildPrice = userContext.buildTotalPrice || 0;
    let buildComponents: Array<{ type: string; name: string; price: number }> = userContext.buildComponents || [];
    let missingComponents: string[] = userContext.missingComponents || [];

    // Fallback sang clientBuild nếu khách chưa đăng nhập / build lưu trên frontend
    if (!userContext.hasActiveBuild && clientBuild) {
      buildName = clientBuild.name || "Cấu hình khách đang tự ráp";
      buildPrice = Number(clientBuild.totalPrice || 0);

      const rawComps = clientBuild.components || {};
      if (Array.isArray(rawComps)) {
        buildComponents = rawComps.map((c: any) => ({
          type: String(c.componentType || c.type || "OTHER").toUpperCase(),
          name: c.name || c.product_name || "Linh kiện",
          price: Number(c.price || 0)
        }));
      } else if (typeof rawComps === "object") {
        buildComponents = Object.entries(rawComps).map(([slot, c]: [string, any]) => {
          const p = c?.product || c?.Product || c?.variant?.product || c || {};
          const v = c?.variant || c?.ProductVariant || c?.sku || {};
          return {
            type: slot.toUpperCase(),
            name: p.product_name || p.name || c?.name || slot.toUpperCase(),
            price: Number(v.price || c?.price || p.price || 0)
          };
        });
      }

      if (buildPrice === 0 && buildComponents.length > 0) {
        buildPrice = buildComponents.reduce((sum, c) => sum + c.price, 0);
      }

      const existingTypes = new Set(buildComponents.map((c) => c.type.toLowerCase()));
      missingComponents = REQUIRED_PC_COMPONENTS.filter((req) => !existingTypes.has(req));
    }

    const hasActiveBuild = buildComponents.length > 0;

    // 3. Tóm tắt trao đổi với AI
    const conversationTurns: Array<{ q: string; a: string }> = [];
    const normalizedMsgs = aiHistory.map((m) => {
      const sender = String(m.sender || m.role || "").toLowerCase();
      const isCustomer = sender === "customer" || sender === "user";
      const isAi = sender === "ai" || sender === "assistant";
      const text = String(m.content || m.text || "").trim();
      return { isCustomer, isAi, text };
    }).filter((m) => m.text.length > 0);

    let currentQ = "";
    for (const msg of normalizedMsgs) {
      if (msg.isCustomer) {
        currentQ = msg.text;
      } else if (msg.isAi && currentQ) {
        // Rút gọn câu trả lời AI tối đa 200 ký tự cho súc tích
        const truncatedA = msg.text.length > 200 ? msg.text.slice(0, 197) + "..." : msg.text;
        conversationTurns.push({ q: currentQ, a: truncatedA });
        currentQ = "";
      }
    }

    // 4. Ghép thành bản tóm tắt Markdown chuyên nghiệp
    const lines: string[] = [
      "📋 **TÓM TẮT NGỮ CẢNH TƯ VẤN (AI ➔ NHÂN VIÊN BÁN HÀNG)**",
      "────────────────────────────────────────",
      "🎯 **Nhu cầu & Tiêu chí khách hàng:**",
      `• Mục đích: ${purposeStr}`,
      `• Ngân sách dự kiến: ${budgetStr}`
    ];

    if (resStr) {
      lines.push(`• Target độ phân giải: ${resStr}`);
    }
    if (ownedParts) {
      lines.push(`• Linh kiện đã có sẵn ở nhà: ${ownedParts}`);
    }
    if (criteria.ownedNotes) {
      lines.push(`• Ghi chú linh kiện có sẵn: ${criteria.ownedNotes}`);
    }

    if (hasActiveBuild) {
      lines.push("");
      lines.push("🖥️ **Cấu hình PC đang xây dựng (PC Builder):**");
      lines.push(`• Dàn máy: "${buildName || "Dàn máy tùy chỉnh"}" (Tổng: ${buildPrice.toLocaleString("vi-VN")} đ)`);
      lines.push("• Linh kiện đã chọn:");
      for (const comp of buildComponents) {
        lines.push(`  - [${comp.type}] ${comp.name} (${comp.price > 0 ? comp.price.toLocaleString("vi-VN") + " đ" : "Đã có sẵn"})`);
      }
      if (missingComponents.length > 0) {
        lines.push(`• ⚠️ Linh kiện còn thiếu cần tư vấn: ${missingComponents.map((c) => c.toUpperCase()).join(", ")}`);
      } else {
        lines.push("• ✅ Cấu hình đã đầy đủ các linh kiện cốt lõi.");
      }
    }

    if (userContext.hasCart && userContext.cartItems && userContext.cartItems.length > 0) {
      lines.push("");
      lines.push("🛒 **Giỏ hàng hiện tại của khách:**");
      lines.push(`• ${userContext.cartItemCount} sản phẩm — Tổng: ${(userContext.cartTotalPrice || 0).toLocaleString("vi-VN")} đ`);
      for (const item of userContext.cartItems.slice(0, 3)) {
        lines.push(`  - ${item.quantity}x ${item.name} (${item.price.toLocaleString("vi-VN")} đ)`);
      }
    }

    if (conversationTurns.length > 0) {
      lines.push("");
      lines.push("💬 **Tóm tắt trao đổi với AI trước đó:**");
      // Lấy 3 turns gần nhất
      const recentTurns = conversationTurns.slice(-3);
      recentTurns.forEach((turn, idx) => {
        lines.push(`${idx + 1}. Khách hỏi: "${turn.q}"`);
        lines.push(`   ↳ AI trả lời: "${turn.a}"`);
      });
    }

    if (options.note) {
      lines.push("");
      lines.push(`📌 **Ghi chú thêm khi chuyển giao:** "${options.note}"`);
    }

    lines.push("");
    lines.push("💡 **Khuyến nghị cho nhân viên bán hàng:**");
    lines.push("👉 Khách hàng đã được AI tư vấn tương thích và ngân sách. Nhân viên ưu tiên kiểm tra tồn kho tại showroom, tư vấn chốt đơn hoặc điều chỉnh linh kiện còn thiếu, KHÔNG CẦN hỏi lại từ đầu!");

    const briefingText = lines.join("\n");

    const metadata = {
      isHandoffSummary: true,
      criteria: criteria || null,
      hasActiveBuild,
      buildName: buildName || undefined,
      buildTotalPrice: buildPrice || undefined,
      componentsCount: buildComponents.length,
      missingComponents: missingComponents.length > 0 ? missingComponents : undefined,
      hasCart: userContext.hasCart || false,
      cartItemCount: userContext.cartItemCount || 0,
      cartTotalPrice: userContext.cartTotalPrice || 0,
      aiTurnsCount: conversationTurns.length,
      handoffTimestamp: new Date().toISOString()
    };

    return { briefingText, metadata };
  }
}

export interface HandoffOptions {
  userContext?: UserHardwareContext | null;
  aiHistory?: Array<{
    role?: string;
    sender?: string;
    content?: string;
    text?: string;
    build?: any;
    buildPayload?: any;
    products?: any[];
  }>;
  criteria?: {
    purpose?: string;
    budget?: number | string;
    resolution?: string;
    ownedList?: string[];
    ownedNotes?: string;
    [key: string]: any;
  };
  clientBuild?: {
    name?: string;
    totalPrice?: number;
    components?: Record<string, any> | Array<any>;
    [key: string]: any;
  };
  note?: string;
}

export interface HandoffBriefingResult {
  briefingText: string;
  metadata: Record<string, any>;
}

