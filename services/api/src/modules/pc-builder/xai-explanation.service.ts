export type SeverityLevel = "BLOCKER" | "WARNING" | "ADVISORY" | "INFO";

export interface RawCheckResult {
  key: string;
  ok: boolean;
  detail: string;
  meta?: Record<string, any>;
}

export interface XaiExplanation {
  ruleId: string;
  short: string;
  long: string;
  suggestion?: string;
  level: "success" | "warning" | "error" | "info";
  severity: SeverityLevel;
}

export interface EnrichedCheckResult extends RawCheckResult {
  ruleId: string;
  severity: SeverityLevel;
  explanation: XaiExplanation;
}

export interface PerformanceEstimate {
  score: number;
  grade: "Entry-level" | "Mid-range" | "High-end" | "Enthusiast";
  estimatedFps: {
    esports1080p: number; // e.g. CS2 / Valorant / LoL
    aaa1080p: number;     // e.g. Cyberpunk 2077 / Black Myth Wukong
    rendering4k: string;  // e.g. "Mượt 60fps" / "Trung bình"
  };
}

export interface FiveDimensionalScorecard {
  compatibilityScore: number;    // 0 - 100
  performanceScore: number;      // 0 - 100
  valueScore: number;            // 0 - 100
  powerThermalScore: number;     // 0 - 100
  upgradeScore: number;          // 0 - 100
  requirementMatchScore: number; // 0 - 100
}

export type BuildReadiness = "READY" | "WARNINGS_ACKNOWLEDGED" | "BLOCKED";

export interface XaiSummary {
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  blockerCount: number;
  warningCount: number;
  advisoryCount: number;
  buildReadiness: BuildReadiness;
  overallMessage: string;
  recommendationNote: string;
}

export interface CompleteXaiReport {
  compatible: boolean;
  score: number;
  buildReadiness: BuildReadiness;
  scores: FiveDimensionalScorecard;
  checks: EnrichedCheckResult[];
  summary: XaiSummary;
  performanceEstimate: PerformanceEstimate;
}

/**
 * XAI Explanation Service — Knowledge-based AI Decision Support System Engine.
 * Implements COMP-001 to COMP-010 hardware rules with 4 Severity Levels:
 * BLOCKER, WARNING, ADVISORY, INFO.
 */
class XaiExplanationService {
  /**
   * Trích xuất Mã Luật (COMP-001 -> COMP-010) và Mức độ Severity
   */
  resolveRuleMeta(key: string, ok: boolean): { ruleId: string; severity: SeverityLevel } {
    switch (key) {
      case "socket":
        return { ruleId: "COMP-001", severity: ok ? "INFO" : "BLOCKER" };
      case "ram":
        return { ruleId: "COMP-002", severity: ok ? "INFO" : "BLOCKER" };
      case "gpu_slot":
        return { ruleId: "COMP-003", severity: ok ? "INFO" : "WARNING" };
      case "gpu_clearance":
        return { ruleId: "COMP-004", severity: ok ? "INFO" : "BLOCKER" };
      case "cooling_required":
        return { ruleId: "COMP-005", severity: ok ? "INFO" : "BLOCKER" };
      case "cooling_socket":
        return { ruleId: "COMP-005", severity: ok ? "INFO" : "WARNING" };
      case "cooling_tdp":
        return { ruleId: "COMP-005", severity: ok ? "INFO" : "WARNING" };
      case "radiator_fit":
        return { ruleId: "COMP-006", severity: ok ? "INFO" : "BLOCKER" };
      case "cooler_height":
        return { ruleId: "COMP-006", severity: ok ? "INFO" : "BLOCKER" };
      case "psu":
        return { ruleId: "COMP-007", severity: ok ? "INFO" : "BLOCKER" };
      case "psu_connectors":
        return { ruleId: "COMP-008", severity: ok ? "INFO" : "BLOCKER" };
      case "storage_m2":
        return { ruleId: "COMP-009", severity: ok ? "INFO" : "WARNING" };
      case "case_form_factor":
        return { ruleId: "COMP-010", severity: ok ? "INFO" : "BLOCKER" };
      case "ram_slots":
        return { ruleId: "COMP-002", severity: ok ? "INFO" : "BLOCKER" };
      case "bottleneck":
        return { ruleId: "COMP-003", severity: ok ? "INFO" : "ADVISORY" };
      case "multi_cpu_mb_vrm":
        return { ruleId: "COMP-MULTI-001", severity: ok ? "INFO" : "WARNING" };
      case "multi_gpu_psu_case":
        return { ruleId: "COMP-MULTI-002", severity: ok ? "INFO" : "BLOCKER" };
      case "multi_cpu_cooling_case":
        return { ruleId: "COMP-MULTI-003", severity: ok ? "INFO" : "WARNING" };
      default:
        return { ruleId: "COMP-000", severity: ok ? "INFO" : "ADVISORY" };
    }
  }

  /**
   * Tạo giải thích XAI có cấu trúc cho từng luật kiểm tra
   */
  generateCheckExplanation(check: RawCheckResult): XaiExplanation {
    const key = check.key;
    const ok = check.ok;
    const detail = check.detail || "";
    const meta = this.resolveRuleMeta(key, ok);

    switch (key) {
      case "socket":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-001] Socket CPU & Mainboard hoàn toàn tương thích",
            long: `Chân cắm CPU và khe cắm trên Mainboard đều khớp chuẩn (${detail}). Đảm bảo CPU có thể lắp vừa vặn và hoạt động ổn định trên bo mạch chủ.`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "BLOCKER",
          short: "❌ [COMP-001] [BLOCKER] Xung đột Socket CPU và Mainboard",
          long: `CPU và Mainboard bạn chọn không cùng loại chân cắm (${detail}). Việc cố tình lắp ráp sẽ gây cong chân socket hoặc không cắm vừa.`,
          suggestion: "Vui lòng đổi Mainboard hoặc CPU sao cho cùng chuẩn socket (ví dụ: Intel LGA1700 hoặc AMD AM5). [Xem các Mainboard phù hợp →]",
          level: "error"
        };

      case "ram":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-002] Đã khớp chuẩn RAM và Mainboard",
            long: `Loại bộ nhớ RAM và bo mạch chủ hỗ trợ cùng chuẩn (${detail}). Tốc độ bus và chuẩn DDR sẽ hoạt động tối ưu.`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "BLOCKER",
          short: "❌ [COMP-002] [BLOCKER] Chuẩn RAM không khớp với Mainboard",
          long: `RAM và Mainboard không cùng chuẩn DDR (${detail}). RAM DDR4 không thể cắm vào khe DDR5 và ngược lại do vị trí chốt khóa khác nhau.`,
          suggestion: "Chọn loại RAM cùng chuẩn DDR mà Mainboard hỗ trợ (DDR4 / DDR5). [Xem các RAM phù hợp →]",
          level: "error"
        };

      case "psu":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-007] Công suất nguồn (PSU) đáp ứng tốt",
            long: `Bộ nguồn cung cấp đủ điện áp (${detail}). Dung lượng nguồn dư ra 20-30% giúp hệ thống chạy mát, hoạt động bền bỉ khi full load.`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "BLOCKER",
          short: "❌ [COMP-007] [BLOCKER] Bộ nguồn quá yếu cho cấu hình này",
          long: `Tổng công suất tiêu thụ của các linh kiện vượt quá khả năng cấp điện an toàn của nguồn (${detail}). Điều này gây nguy cơ tự tắt máy khi chơi game nặng hoặc làm hỏng linh kiện.`,
          suggestion: "Nâng cấp lên bộ nguồn có công suất thực lớn hơn (khuyên dùng nguồn đạt chứng nhận 80 Plus Gold). [Xem các PSU phù hợp →]",
          level: "error"
        };

      case "gpu_clearance":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-004] Kích thước Card màn hình vừa vặn với Vỏ ca-bin (Case)",
            long: `Chiều dài Card đồ họa nằm trong giới hạn không gian cho phép của Vỏ máy (${detail}).`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "BLOCKER",
          short: "❌ [COMP-004] [BLOCKER] Card màn hình quá dài so với Vỏ Case",
          long: `Card màn hình (${detail}) dài hơn khoảng trống bên trong Case. Card sẽ bị cấn vào quạt mặt trước hoặc khung ổ cứng.`,
          suggestion: "Chọn Vỏ Case kích thước Mid-Tower/Full-Tower rộng hơn hoặc chọn phiên bản Card 2 quạt ngắn hơn. [Xem các Case phù hợp →]",
          level: "error"
        };

      case "cooling_required":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-005] Đã có giải pháp tản nhiệt phù hợp cho CPU",
            long: `CPU đã có tản nhiệt kèm theo sẵn từ nhà sản xuất hoặc bạn đã chọn tản nhiệt rời chuyên dụng.`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "BLOCKER",
          short: "❌ [COMP-005] [BLOCKER] CPU dòng cao cấp thiếu Tản nhiệt rời",
          long: `Dòng CPU bạn chọn (dòng K/KF hoặc hiệu năng cao) không đi kèm tản nhiệt nguyên hộp. Nếu chạy không tản nhiệt, CPU sẽ quá nhiệt và tự ngắt sau vài giây.`,
          suggestion: "Bắt buộc thêm một Tản nhiệt khí hoặc Tản nhiệt nước AIO vào danh sách linh kiện. [Xem các Tản nhiệt phù hợp →]",
          level: "error"
        };

      case "cooling_socket":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-005] Tản nhiệt hỗ trợ đúng chân cắm CPU",
            long: `Bộ gá (bracket) của tản nhiệt vừa vặn với kích thước socket CPU (${detail}).`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "WARNING",
          short: "⚠️ [COMP-005] [WARNING] Tản nhiệt không có ngàm gắn cho Socket CPU này",
          long: `Tản nhiệt bạn chọn thiếu bộ ngàm tương thích với socket CPU (${detail}), làm tản nhiệt không áp sát vào bề mặt CPU được.`,
          suggestion: "Chọn tản nhiệt có ghi rõ hỗ trợ socket của CPU hiện tại. [Xem các Tản nhiệt phù hợp →]",
          level: "warning"
        };

      case "cooling_tdp":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-005] Hiệu suất giải nhiệt của tản tốt",
            long: `Công suất giải nhiệt (TDP Cooling) cao hơn lượng nhiệt CPU tỏa ra (${detail}), giữ nhiệt độ ổn định < 75°C.`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "WARNING",
          short: "⚠️ [COMP-005] [WARNING] Tản nhiệt yếu hơn lượng nhiệt CPU phát ra",
          long: `Khả năng giải nhiệt của tản (${detail}) thấp hơn mức tỏa nhiệt tối đa của CPU, làm CPU bị giảm xung (thermal throttling) khi tải nặng.`,
          suggestion: "Nâng cấp lên Tản nhiệt khí 4-6 ống đồng hoặc Tản nhiệt nước 240mm/360mm. [Xem các Tản nhiệt phù hợp →]",
          level: "warning"
        };

      case "radiator_fit":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-006] Kích thước Két nước AIO lắp vừa vặn vào Case",
            long: `Vỏ máy hỗ trợ kích thước Radiator (${detail}) ở mặt trên hoặc mặt trước.`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "BLOCKER",
          short: "❌ [COMP-006] [BLOCKER] Radiator Tản nước quá lớn so với Vỏ Case",
          long: `Kích thước Radiator (${detail}) vượt quá khoảng không gian Case hỗ trợ lắp đặt.`,
          suggestion: "Chọn Case lớn hơn hoặc giảm kích thước tản AIO xuống (ví dụ 360mm ➔ 240mm). [Xem các Case phù hợp →]",
          level: "error"
        };

      case "cooler_height":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-006] Chiều cao tản khí không cấn nắp kính Case",
            long: `Chiều cao tháp tản nhiệt nằm trong giới hạn chiều rộng của Vỏ máy (${detail}).`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "BLOCKER",
          short: "❌ [COMP-006] [BLOCKER] Tản nhiệt khí quá cao, không đóng được nắp Case",
          long: `Tản nhiệt tháp đôi (${detail}) cao hơn khoảng trống cho phép, sẽ va vào nắp kính hông của Case.`,
          suggestion: "Chọn tản nhiệt khí dạng gầm thấp (Low-profile) hoặc chọn Case có bề ngang rộng hơn. [Xem các Case phù hợp →]",
          level: "error"
        };

      case "psu_connectors":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-008] Đầu nguồn cấp điện (PCIe 8-pin / 12VHPWR) đầy đủ",
            long: `Bộ nguồn cung cấp đầy đủ các đầu cắm nguồn 8-pin PCIe / 12V-2x6 chuẩn ATX 3.0 cho Card đồ họa và 8-pin EPS cho CPU (${detail}). Đảm bảo truyền tải điện an toàn không cần qua đầu chuyển.`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "BLOCKER",
          short: "❌ [COMP-008] [BLOCKER] Thiếu đầu cắm nguồn mở rộng cho GPU / CPU",
          long: `Bộ nguồn thiếu số lượng dây cáp cắm nguồn PCIe 8-pin hoặc cổng 12VHPWR cấp cho GPU (${detail}). Việc dùng dây nối chuyển Molex/SATA rất rủi ro và dễ gây cháy nổ.`,
          suggestion: "Nâng cấp lên bộ nguồn chuẩn ATX 3.0 có sẵn dây 12VHPWR hoặc đủ số đầu 8-pin PCIe độc lập. [Xem các PSU phù hợp →]",
          level: "error"
        };

      case "storage_m2":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-009] Khe cắm M.2 NVMe & SATA trên Mainboard đáp ứng đủ",
            long: `Bo mạch chủ có đủ số lượng khe M.2 PCIe NVMe và cổng SATA3 để lắp đặt toàn bộ ổ cứng bạn đã chọn (${detail}).`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "WARNING",
          short: "⚠️ [COMP-009] [WARNING] Số lượng ổ cứng M.2/SATA vượt quá cổng Mainboard",
          long: `Số lượng ổ cứng SSD/HDD (${detail}) vượt quá số khe cắm M.2 NVMe hoặc cổng SATA3 khả dụng trên bo mạch chủ.`,
          suggestion: "Gộp dung lượng vào 1 ổ SSD NVMe dung lượng lớn (1TB/2TB) hoặc chọn Mainboard có 3-4 khe M.2. [Xem các Mainboard phù hợp →]",
          level: "warning"
        };

      case "case_form_factor":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-010] Kích thước Mainboard hoàn toàn vừa vặn với Vỏ Case",
            long: `Chuẩn form factor của Mainboard khớp chuẩn chân ốc chêm (standoff) và không gian lắp đặt bên trong Vỏ Case (${detail}).`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "BLOCKER",
          short: "❌ [COMP-010] [BLOCKER] Kích thước Mainboard quá to so với Vỏ Case",
          long: `Mainboard chuẩn ATX/E-ATX (${detail}) quá lớn không thể cắm vừa vào thùng Case chuẩn mATX hoặc Mini-ITX.`,
          suggestion: "Chọn Vỏ Case lớn hơn (chuẩn Mid-Tower / Full-Tower) hoặc chọn Mainboard chuẩn mATX nhỏ gọn. [Xem các Case phù hợp →]",
          level: "error"
        };

      case "ram_slots":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-002] Số thanh RAM nằm trong số khe cắm khả dụng",
            long: `Mainboard có đủ khe cắm cho số lượng thanh RAM bạn chọn (${detail}).`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "BLOCKER",
          short: "❌ [COMP-002] [BLOCKER] Số thanh RAM vượt quá số khe cắm Mainboard",
          long: `Bạn chọn nhiều thanh RAM hơn số khe cắm vật lý trên bo mạch chủ (${detail}).`,
          suggestion: "Giảm số lượng thanh RAM và tăng dung lượng mỗi thanh (ví dụ: 4x8GB ➔ 2x16GB). [Xem các RAM phù hợp →]",
          level: "error"
        };

      case "bottleneck":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-003] Cân bằng hiệu năng CPU và GPU tốt",
            long: `Sự kết hợp giữa CPU và GPU rất đồng bộ, hạn chế hiện tượng nghẽn cổ chai khi xử lý dữ liệu nặng.`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "ADVISORY",
          short: "ℹ️ [COMP-003] [ADVISORY] Cảnh báo chênh lệch hiệu năng CPU / GPU",
          long: `Chênh lệch sức mạnh giữa CPU và GPU khá lớn (${detail}). Một trong hai thành phần sẽ phải chờ thành phần kia xử lý xong khi tải nặng.`,
          suggestion: "Cân đối lại ngân sách giữa CPU và GPU để đạt hiệu năng tối ưu nhất.",
          level: "info"
        };

      case "multi_cpu_mb_vrm":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-MULTI-001] Pha nguồn VRM bo mạch chủ & CPU đồng bộ",
            long: `Bo mạch chủ trang bị dàn phase VRM đủ khỏe và tản nhiệt nhôm để duy trì xung nhịp ổn định cho CPU (${detail}).`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "WARNING",
          short: "⚠️ [COMP-MULTI-001] [WARNING] Bo mạch chủ phổ thông VRM yếu đi cùng CPU công suất lớn",
          long: `Tổ hợp CPU TDP cao kết hợp Mainboard giá rẻ không có heatsink VRM sẽ khiến mạch nguồn quá nhiệt, gây sụt xung (thermal throttling) và tụt hiệu năng đột ngột (${detail}).`,
          suggestion: "Nâng cấp Mainboard lên chipset B760/Z790 (Intel) hoặc B650/X670 (AMD) có dàn VRM từ 10+2 phase trở lên.",
          level: "warning"
        };

      case "multi_gpu_psu_case":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-MULTI-002] Tổ hợp GPU + Nguồn PSU + Vỏ Case tối ưu hoàn chỉnh",
            long: `Bộ nguồn dư tải bảo vệ chống sụt áp và thùng máy đảm bảo lưu thông gió thông thoáng cho GPU (${detail}).`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "BLOCKER",
          short: "❌ [COMP-MULTI-002] [BLOCKER] Xung đột tổ hợp Nguồn / Vỏ case với Card đồ họa cao cấp",
          long: `Card đồ họa công suất lớn đòi hỏi nguồn chuẩn ATX 3.0 chịu dòng xung kích (transient spikes) và không gian vỏ máy đối lưu gió tốt (${detail}).`,
          suggestion: "Nâng cấp bộ nguồn lên 850W+ ATX 3.0 và sử dụng vỏ case chuẩn Mid-Tower/Full-Tower có tối thiểu 3 quạt hút gió.",
          level: "error"
        };

      case "multi_cpu_cooling_case":
        if (ok) {
          return {
            ruleId: meta.ruleId,
            severity: "INFO",
            short: "✅ [COMP-MULTI-003] Tổ hợp CPU + Tản nhiệt + Thùng máy giải nhiệt xuất sắc",
            long: `Giải pháp tản nhiệt và hướng gió trong thùng máy phối hợp hoàn hảo giúp CPU luôn chạy hết công suất mà không bị quá nhiệt (${detail}).`,
            level: "success"
          };
        }
        return {
          ruleId: meta.ruleId,
          severity: "WARNING",
          short: "⚠️ [COMP-MULTI-003] [WARNING] CPU đầu bảng cần tản nhiệt nước AIO 360mm",
          long: `Dòng CPU đầu bảng (TDP >200W) sinh nhiệt lượng cực lớn, tản nhiệt khí phổ thông trong thùng máy kín sẽ không kịp giải nhiệt (${detail}).`,
          suggestion: "Trang bị tản nhiệt nước AIO 360mm gắn nóc thùng case để thoát nhiệt trực tiếp ra ngoài.",
          level: "warning"
        };

      default:
        return {
          ruleId: meta.ruleId,
          severity: meta.severity,
          short: ok ? `✅ [${meta.ruleId}] Kiểm tra ${key}: Đạt` : `⚠️ [${meta.ruleId}] Kiểm tra ${key}: Cần lưu ý`,
          long: detail || "Không có chi tiết kỹ thuật thêm.",
          level: ok ? "success" : "warning"
        };
    }
  }

  /**
   * Tính toán bộ 5 điểm số Scorecard (Build Health 5-Dimensional Scores)
   */
  calculateFiveDimensionalScorecard(
    checks: EnrichedCheckResult[],
    performanceScore: number
  ): FiveDimensionalScorecard {
    const blockers = checks.filter((c) => c.severity === "BLOCKER");
    const warnings = checks.filter((c) => c.severity === "WARNING");
    const advisories = checks.filter((c) => c.severity === "ADVISORY");

    const compatibilityScore = blockers.length > 0 ? 0 : Math.max(20, Math.round(100 - warnings.length * 15 - advisories.length * 5));
    const perfScore = Math.min(100, Math.max(30, performanceScore));
    const valueScore = Math.min(98, Math.round(perfScore * 0.95 + (compatibilityScore > 80 ? 8 : 0)));
    const powerThermalFailures = checks.filter((c) => (c.key === "psu" || c.key.startsWith("cooling") || c.key === "radiator_fit") && !c.ok).length;
    const powerThermalScore = Math.max(25, Math.round(100 - powerThermalFailures * 25));
    const upgradeScore = Math.min(95, Math.max(40, Math.round(compatibilityScore * 0.4 + perfScore * 0.5 + 10)));
    const requirementMatchScore = blockers.length > 0 ? 30 : Math.round((compatibilityScore + perfScore) / 2);

    return {
      compatibilityScore,
      performanceScore: perfScore,
      valueScore,
      powerThermalScore,
      upgradeScore,
      requirementMatchScore
    };
  }

  /**
   * Ước tính hiệu năng và chỉ số FPS dựa trên GPU/CPU
   */
  estimatePerformance(checks: RawCheckResult[], componentsMap: Record<string, any>): PerformanceEstimate {
    let score = 50;
    const gpuName = String(componentsMap?.gpu?.productName || "").toLowerCase();

    if (gpuName.includes("4090") || gpuName.includes("7900 xtx")) score = 98;
    else if (gpuName.includes("4080") || gpuName.includes("4070 ti")) score = 90;
    else if (gpuName.includes("4070") || gpuName.includes("7800 xt")) score = 82;
    else if (gpuName.includes("4060 ti") || gpuName.includes("3070")) score = 75;
    else if (gpuName.includes("4060") || gpuName.includes("3060")) score = 68;
    else if (gpuName.includes("1650") || gpuName.includes("6600")) score = 55;
    else if (!gpuName) score = 35;

    let grade: PerformanceEstimate["grade"] = "Entry-level";
    if (score >= 88) grade = "Enthusiast";
    else if (score >= 78) grade = "High-end";
    else if (score >= 62) grade = "Mid-range";

    return {
      score,
      grade,
      estimatedFps: {
        esports1080p: Math.round(score * 2.8),
        aaa1080p: Math.max(30, Math.round(score * 0.95)),
        rendering4k: score >= 75 ? "Rất mượt (Dưới 5 phút)" : score >= 60 ? "Khá mượt (5-15 phút)" : "Cơ bản"
      }
    };
  }

  /**
   * Tạo báo cáo tổng hợp XAI hoàn chỉnh với 4 Severity Levels & 5 Scorecards
   */
  buildCompleteReport(
    checks: RawCheckResult[],
    componentsMap: Record<string, any> = {}
  ): CompleteXaiReport {
    const enrichedChecks: EnrichedCheckResult[] = checks.map((c) => {
      const meta = this.resolveRuleMeta(c.key, c.ok);
      return {
        ...c,
        ruleId: meta.ruleId,
        severity: meta.severity,
        explanation: this.generateCheckExplanation(c)
      };
    });

    const blockerCount = enrichedChecks.filter((c) => c.severity === "BLOCKER").length;
    const warningCount = enrichedChecks.filter((c) => c.severity === "WARNING").length;
    const advisoryCount = enrichedChecks.filter((c) => c.severity === "ADVISORY").length;
    const passedCount = enrichedChecks.filter((c) => c.ok).length;

    let buildReadiness: BuildReadiness = "READY";
    if (blockerCount > 0) buildReadiness = "BLOCKED";
    else if (warningCount > 0) buildReadiness = "WARNINGS_ACKNOWLEDGED";

    const performanceEstimate = this.estimatePerformance(checks, componentsMap);
    const scores = this.calculateFiveDimensionalScorecard(enrichedChecks, performanceEstimate.score);

    let overallMessage = "🎉 Cấu hình đạt trạng thái BUILD READY! Tương thích hoàn hảo và sẵn sàng đặt hàng.";
    if (blockerCount > 0) {
      overallMessage = `❌ Trạng thái BLOCKED: Phát hiện ${blockerCount} lỗi xung đột nghiêm trọng cần sửa trước khi mua.`;
    } else if (warningCount > 0) {
      overallMessage = `⚠️ Trạng thái WARNINGS: Cấu hình hoạt động được nhưng có ${warningCount} điểm lưu ý cần tối ưu.`;
    }

    return {
      compatible: blockerCount === 0,
      score: scores.compatibilityScore,
      buildReadiness,
      scores,
      checks: enrichedChecks,
      summary: {
        passedChecks: passedCount,
        failedChecks: blockerCount,
        warningChecks: warningCount,
        blockerCount,
        warningCount,
        advisoryCount,
        buildReadiness,
        overallMessage,
        recommendationNote: "Dữ liệu được phân tích bởi Engine Tri thức & XAI của PC Mall theo chuẩn Unified Baseline."
      },
      performanceEstimate
    };
  }
}

export const xaiExplanationService = new XaiExplanationService();
export default xaiExplanationService;
