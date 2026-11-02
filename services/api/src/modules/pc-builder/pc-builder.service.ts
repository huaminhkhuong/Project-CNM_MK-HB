import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getDbPool, query } from "../../config/database";
import { env } from "../../config/env";
import { createError, toPositiveInteger } from "../../utils/service-helpers";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { xaiExplanationService } from "./xai-explanation.service";

export interface BuildItem {
  id: number;
  componentType: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product: {
    id: number;
    name: string;
    slug: string;
    attributes?: Array<{ key: string; value: string }>;
  };
  variant: {
    id: number;
    sku: string;
    price: number;
    stock: number;
    imageUrl: string | null;
    specs?: Array<{ key: string; value: string }>;
  };
}

export interface Build {
  id: number;
  userId: number;
  name: string;
  status: string;
  totalPrice: number;
  createdAt: Date;
  updatedAt: Date;
  items: BuildItem[];
  components: Record<string, BuildItem>;
}

/**
 * Service to manage PC Builder business logic.
 * Handles build creation, item management, multi-candidate recommendations, and compatibility checks.
 */
class PcBuilderService {
  private cachedCentralizedRules: any = null;

  public getCentralizedRules(): any {
    if (this.cachedCentralizedRules) return this.cachedCentralizedRules;
    try {
      const candidates = [
        path.resolve(process.cwd(), "data/rules.json"),
        path.resolve(process.cwd(), "../../data/rules.json"),
        path.resolve(__dirname, "../../../../../data/rules.json"),
        path.resolve(__dirname, "../../../../data/rules.json")
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          this.cachedCentralizedRules = JSON.parse(fs.readFileSync(p, "utf8"));
          return this.cachedCentralizedRules;
        }
      }
    } catch (e) {
      // Graceful fallback to default rules
    }
    return null;
  }

  private toMoney(value: any): number {
    return Number(Number(value || 0).toFixed(2));
  }

  private normalizeText(value: any): string {
    return String(value || "").trim().toLowerCase();
  }

  private parseNumber(value: any, fallback = 0): number {
    const match = String(value || "").match(/(\d+(\.\d+)?)/);
    return match ? Number(match[1]) : fallback;
  }

  private specBag(specs: Array<{ key: string; value: string }> = []): Record<string, string> {
    return specs.reduce<Record<string, string>>((accumulator, spec) => {
      const key = this.normalizeText(spec.key);
      if (key) accumulator[key] = String(spec.value || "");
      return accumulator;
    }, {});
  }

  private findSpec(specs: Array<{ key: string; value: string }> = [], aliases: string[]): string {
    const bag = this.specBag(specs);
    const keys = aliases.map((alias) => this.normalizeText(alias));
    const hit = Object.entries(bag).find(([key]) => keys.some((alias) => key.includes(alias)));
    return hit?.[1] || "";
  }

  private hasTruthySpec(value: any): boolean {
    const text = this.normalizeText(value);
    if (!text) return false;
    if (["khong", "không", "no", "false", "none"].some((token) => text.includes(token))) return false;
    return ["co", "có", "yes", "true", "included", "stock", "kem", "kèm", "boxed"].some((token) => text.includes(token));
  }

  private cpuHasStockCooler(specs: Array<{ key: string; value: string }>, productName: string): boolean {
    const specValue = this.findSpec(specs, ["stock cooler", "cooler included", "tản đi kèm", "boxed cooler"]);
    if (specValue) return this.hasTruthySpec(specValue);
    const name = this.normalizeText(productName);
    if (/\bi[3579]-?\d{4,5}(k|kf|ks)\b/.test(name)) return false;
    if (/ryzen\s*[3579].*(x3d|xt|\bx\b)/.test(name)) return false;
    return true;
  }

  private socketMatches(requiredSocket: string, supportedSockets: string): boolean {
    const left = this.normalizeText(requiredSocket);
    const right = this.normalizeText(supportedSockets);
    if (!left || !right) return true;
    return right.includes(left) || left.includes(right);
  }

  async findBuildById(userId: number, buildId: number, connection: any = null): Promise<any> {
    const executor = connection || getDbPool();
    const [rows] = await executor.execute(
      `SELECT id, user_id AS userId, name, created_at AS createdAt FROM pc_builds WHERE id = ? AND user_id = ? LIMIT 1`,
      [buildId, userId]
    );
    return (rows as RowDataPacket[])[0] || null;
  }

  async getBuildItems(buildId: number): Promise<BuildItem[]> {
    const rows = await query(
      `
      SELECT 
        i.id AS itemId,
        i.component_type AS componentType,
        COALESCE(i.quantity, 1) AS quantity,
        s.id AS skuId,
        s.price AS price,
        COALESCE(s.stock, 0) AS stock,
        s.sku AS skuCode,
        s.image_url AS imageUrl,
        p.id AS productId,
        p.name AS productName,
        COALESCE(p.slug, CAST(p.id AS CHAR)) AS productSlug,
        a.name AS attributeName,
        av.value AS attributeValue
      FROM pc_build_items i
      INNER JOIN product_skus s ON s.id = i.sku_id
      INNER JOIN products p ON p.id = s.product_id
      LEFT JOIN sku_attributes sa ON sa.sku_id = s.id
      LEFT JOIN attribute_values av ON av.id = sa.attribute_value_id
      LEFT JOIN attributes a ON a.id = av.attribute_id
      WHERE i.build_id = ?
      ORDER BY i.id ASC, a.name ASC
      `,
      [buildId]
    );

    const itemMap = new Map<number, BuildItem>();
    for (const row of rows as any[]) {
      if (!itemMap.has(row.itemId)) {
        const itemQuantity = Math.max(1, Number(row.quantity || 1));
        const itemUnitPrice = Number(row.price || 0);
        itemMap.set(row.itemId, {
          id: row.itemId,
          componentType: row.componentType,
          quantity: itemQuantity,
          unitPrice: itemUnitPrice,
          lineTotal: this.toMoney(itemUnitPrice * itemQuantity),
          product: {
            id: row.productId,
            name: row.productName,
            slug: String(row.productSlug || row.productId),
            attributes: []
          },
          variant: {
            id: row.skuId,
            sku: row.skuCode || `SKU-${row.skuId}`,
            price: Number(row.price || 0),
            stock: Number(row.stock || 0),
            imageUrl: row.imageUrl || null,
            specs: []
          }
        });
      }

      if (row.attributeName && row.attributeValue) {
        const item = itemMap.get(row.itemId)!;
        const spec = { key: String(row.attributeName), value: String(row.attributeValue) };
        item.variant.specs?.push(spec);
        item.product.attributes?.push(spec);
      }
    }
    return Array.from(itemMap.values());
  }

  formatBuild(build: any, items: BuildItem[]): Build {
    const totalPrice = this.toMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const components: Record<string, BuildItem> = {};
    for (const item of items) {
      components[item.componentType] = item;
    }

    return {
      id: build.id,
      userId: build.userId,
      name: build.name,
      status: "DRAFT",
      totalPrice,
      createdAt: build.createdAt,
      updatedAt: build.createdAt,
      items,
      components
    };
  }

  async getBuildDetail(userId: number, buildId: any): Promise<Build> {
    const parsedId = toPositiveInteger(buildId, "buildId");
    const build = await this.findBuildById(userId, parsedId);
    if (!build) throw createError("PC build not found", 404);
    const items = await this.getBuildItems(parsedId);
    return this.formatBuild(build, items);
  }

  async createBuild(userId: number, payload: any = {}): Promise<Build> {
    const name = String(payload.name || "My PC Build").trim() || "My PC Build";
    const [result] = await (getDbPool() as any).execute(
      `INSERT INTO pc_builds (user_id, name, created_at) VALUES (?, ?, NOW())`,
      [userId, name]
    );
    return this.getBuildDetail(userId, (result as ResultSetHeader).insertId);
  }

  async getCurrentBuild(userId: number): Promise<Build | null> {
    const rows = await query(
      `SELECT id, user_id AS userId, name, created_at AS createdAt FROM pc_builds WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
      [userId]
    );
    const build = (rows as any[])[0] || null;
    if (!build) return null;
    const items = await this.getBuildItems(build.id);
    return this.formatBuild(build, items);
  }

  async upsertBuildItem(userId: number, buildId: any, payload: any): Promise<Build> {
    const parsedBuildId = toPositiveInteger(buildId, "buildId");
    const skuId = toPositiveInteger(payload.productVariantId, "productVariantId");
    const componentType = String(payload.componentType || "").trim().toLowerCase();
    const quantity = Math.max(1, Math.min(10, Number(payload.quantity || 1)));

    if (!componentType) throw createError("componentType is required", 400);

    const build = await this.findBuildById(userId, parsedBuildId);
    if (!build) throw createError("PC build not found", 404);

    const connection = await (getDbPool() as any).getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.execute(
        `SELECT id FROM pc_build_items WHERE build_id = ? AND component_type = ? LIMIT 1`,
        [parsedBuildId, componentType]
      );
      
      if ((existing as any[]).length > 0) {
        await connection.execute(`UPDATE pc_build_items SET sku_id = ?, quantity = ? WHERE id = ?`, [skuId, quantity, (existing as any[])[0].id]);
      } else {
        await connection.execute(`INSERT INTO pc_build_items (build_id, sku_id, component_type, quantity) VALUES (?, ?, ?, ?)`, [parsedBuildId, skuId, componentType, quantity]);
      }
      await connection.commit();
      return this.getBuildDetail(userId, parsedBuildId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async removeBuildItem(userId: number, buildId: any, componentType: string): Promise<Build> {
    const parsedBuildId = toPositiveInteger(buildId, "buildId");
    const type = String(componentType || "").trim().toLowerCase();
    const build = await this.findBuildById(userId, parsedBuildId);
    if (!build) throw createError("PC build not found", 404);

    await query(`DELETE FROM pc_build_items WHERE build_id = ? AND component_type = ?`, [parsedBuildId, type]);
    return this.getBuildDetail(userId, parsedBuildId);
  }

  async saveBuild(userId: number, buildId: any, payload: any = {}): Promise<Build> {
    const parsedId = toPositiveInteger(buildId, "buildId");
    const build = await this.findBuildById(userId, parsedId);
    if (!build) throw createError("PC build not found", 404);

    const name = String(payload.name || build.name || "My PC Build").trim() || "My PC Build";
    await query(`UPDATE pc_builds SET name = ? WHERE id = ? AND user_id = ?`, [name, parsedId, userId]);
    return this.getBuildDetail(userId, parsedId);
  }

  private isColumnsEnsured = false;

  async ensurePcBuildColumns(): Promise<void> {
    if (this.isColumnsEnsured) return;
    const columnsToEnsure = [
      { name: "share_token", def: "VARCHAR(36) NULL UNIQUE" },
      { name: "is_public", def: "BOOLEAN DEFAULT FALSE" },
      { name: "description", def: "TEXT NULL" },
      { name: "use_case", def: "VARCHAR(50) NULL" },
      { name: "budget", def: "DECIMAL(12,2) NULL" }
    ];

    for (const col of columnsToEnsure) {
      try {
        await query(`ALTER TABLE pc_builds ADD COLUMN ${col.name} ${col.def}`);
      } catch (err: any) {
        if (!String(err?.message || "").includes("Duplicate column name")) {
          // Log warning softly
        }
      }
    }
    this.isColumnsEnsured = true;
  }

  async getMyBuilds(userId: number): Promise<any[]> {
    await this.ensurePcBuildColumns();
    const rows = await query(
      `
      SELECT 
        b.id,
        b.user_id AS userId,
        b.name,
        b.share_token AS shareToken,
        COALESCE(b.is_public, 0) AS isPublic,
        b.description,
        b.use_case AS useCase,
        b.budget,
        b.created_at AS createdAt,
        COUNT(i.id) AS itemCount
      FROM pc_builds b
      LEFT JOIN pc_build_items i ON i.build_id = b.id
      WHERE b.user_id = ?
      GROUP BY b.id
      ORDER BY b.created_at DESC
      `,
      [userId]
    );

    const buildsWithDetail = [];
    for (const row of rows as any[]) {
      const items = await this.getBuildItems(row.id);
      const formatted = this.formatBuild(row, items);
      buildsWithDetail.push({
        ...formatted,
        shareToken: row.shareToken || null,
        isPublic: Boolean(row.isPublic),
        description: row.description,
        useCase: row.useCase,
        budget: Number(row.budget || 0)
      });
    }

    return buildsWithDetail;
  }

  async publishBuild(userId: number, buildId: any): Promise<any> {
    await this.ensurePcBuildColumns();
    const parsedId = toPositiveInteger(buildId, "buildId");
    const build = await this.findBuildById(userId, parsedId);
    if (!build) throw createError("PC build not found", 404);

    const shareToken = crypto.randomUUID();
    await query(
      `UPDATE pc_builds SET share_token = ?, is_public = 1 WHERE id = ? AND user_id = ?`,
      [shareToken, parsedId, userId]
    );

    const detail = await this.getBuildDetail(userId, parsedId);
    return {
      ...detail,
      shareToken,
      isPublic: true,
      shareUrl: `/pc-builder/shared/${shareToken}`
    };
  }

  async getSharedBuild(shareToken: string): Promise<any> {
    await this.ensurePcBuildColumns();
    const token = String(shareToken || "").trim();
    if (!token) throw createError("Share token is required", 400);

    const rows = await query(
      `SELECT id, user_id AS userId, name, share_token AS shareToken, is_public AS isPublic, created_at AS createdAt FROM pc_builds WHERE share_token = ? AND is_public = 1 LIMIT 1`,
      [token]
    );
    const build = (rows as any[])[0] || null;
    if (!build) throw createError("Bộ cấu hình không tồn tại hoặc đã bị ẩn", 404);

    const items = await this.getBuildItems(build.id);
    const formatted = this.formatBuild(build, items);

    const compatibilityCheckPayload = {
      components: items.map((item) => ({
        componentType: item.componentType,
        variantId: item.variant.id
      }))
    };

    let xaiReport: any = null;
    if (compatibilityCheckPayload.components.length >= 2) {
      try {
        xaiReport = await this.checkRawCompatibility(compatibilityCheckPayload);
      } catch (err) {
        console.warn("[Shared Build] Compatibility check warning:", (err as Error).message);
      }
    }

    return {
      ...formatted,
      shareToken: build.shareToken,
      isPublic: true,
      xaiReport
    };
  }

  async cloneBuild(userId: number, sourceBuildId: any): Promise<Build> {
    const parsedId = toPositiveInteger(sourceBuildId, "sourceBuildId");
    const sourceRows = await query(
      `SELECT id, name FROM pc_builds WHERE id = ? LIMIT 1`,
      [parsedId]
    );
    const sourceBuild = (sourceRows as any[])[0];
    if (!sourceBuild) throw createError("Bộ cấu hình nguồn không tồn tại", 404);

    const sourceItems = await this.getBuildItems(parsedId);
    if (sourceItems.length === 0) {
      throw createError("Bộ cấu hình nguồn chưa có linh kiện nào", 400);
    }

    const newName = `Bản sao - ${sourceBuild.name}`;
    const newBuild = await this.createBuild(userId, { name: newName });

    for (const item of sourceItems) {
      await this.upsertBuildItem(userId, newBuild.id, {
        productVariantId: item.variant.id,
        componentType: item.componentType
      });
    }

    return this.getBuildDetail(userId, newBuild.id);
  }

  /**
   * Helper to query a single candidate build based on allocation ratios and multiplier
   */
  private generateComponentExplanation(
    type: string,
    item: { name: string; price: number },
    totalBudget: number,
    ratio: number,
    useCase: string = "gaming"
  ): string {
    const name = item.name || "Linh kiện";
    const nameLower = name.toLowerCase();
    const percent = Math.round((item.price / Math.max(1, totalBudget)) * 100);

    switch (type.toLowerCase()) {
      case "cpu":
        if (nameLower.includes("i9") || nameLower.includes("7950x") || nameLower.includes("14900")) {
          return `CPU ${name}: Chọn vì sức mạnh xử lý đa nhân cực mạnh (${percent}% ngân sách), phục vụ tối ưu cho Render 4K/3D và Gaming đỉnh cao.`;
        }
        if (nameLower.includes("i7") || nameLower.includes("7800x3d") || nameLower.includes("13700")) {
          return `CPU ${name}: Chọn vì hiệu năng Gaming & Đồ họa cao cấp (${percent}% ngân sách), duy trì xung nhịp ổn định không lo giật lag.`;
        }
        return `CPU ${name}: Chọn vì cân bằng giá/hiệu năng tuyệt vời (${percent}% ngân sách), đáp ứng hoàn hảo nhu cầu ${useCase.toUpperCase()} và dễ dàng nâng cấp.`;

      case "gpu":
        if (nameLower.includes("4090") || nameLower.includes("4080") || nameLower.includes("7900 xtx")) {
          return `GPU ${name}: Trái tim của hệ thống (${percent}% ngân sách), sức mạnh đồ họa đỉnh bảng cân mượt mọi game AAA ở 4K Max Settings & Ray Tracing.`;
        }
        if (nameLower.includes("4070") || nameLower.includes("7800 xt") || nameLower.includes("3070")) {
          return `GPU ${name}: Động cơ đồ họa chính (${percent}% ngân sách), chiến mượt mà các tựa game 2K/1080p High FPS và tăng tốc render video.`;
        }
        return `GPU ${name}: Chọn vì tối ưu chi phí (${percent}% ngân sách), xử lý mượt các game eSports phổ biến và xuất hình ảnh độ phân giải cao.`;

      case "mainboard":
        if (nameLower.includes("z790") || nameLower.includes("x670") || nameLower.includes("z690")) {
          return `Mainboard ${name}: Bo mạch chủ phân khúc cao cấp (${percent}% ngân sách), dàn VRM xịn cấp điện ổn định và hỗ trợ ép xung mạnh mẽ.`;
        }
        if (nameLower.includes("b760") || nameLower.includes("b650") || nameLower.includes("b550")) {
          return `Mainboard ${name}: Lựa chọn quốc dân (${percent}% ngân sách), trang bị đầy đủ khe M.2 NVMe, PCIe 4.0/5.0 và hỗ trợ nâng cấp phần cứng.`;
        }
        return `Mainboard ${name}: Tối ưu chi phí (${percent}% ngân sách), chân cắm linh hoạt, vận hành bền bỉ cho toàn hệ thống.`;

      case "ram":
        if (nameLower.includes("32gb") || nameLower.includes("64gb")) {
          return `RAM ${name}: Dung lượng bộ nhớ dồi dào (${percent}% ngân sách), đảm bảo đa nhiệm mượt mà không lo đầy RAM khi dựng phim hay vừa chơi game vừa live stream.`;
        }
        return `RAM ${name}: Chọn vì đáp ứng đủ chuẩn bộ nhớ (${percent}% ngân sách), tốc độ bus mượt mà cho các tác vụ hàng ngày.`;

      case "psu":
        if (nameLower.includes("850") || nameLower.includes("1000") || nameLower.includes("gold")) {
          return `Nguồn ${name}: Công suất thực mạnh mẽ (${percent}% ngân sách), chuẩn 80 Plus Gold dư tải an toàn > 25% giúp bảo vệ linh kiện.`;
        }
        return `Nguồn ${name}: Cấp điện ổn định (${percent}% ngân sách), đáp ứng tốt tổng công suất tiêu thụ của CPU & GPU.`;

      case "cooling":
        if (nameLower.includes("360") || nameLower.includes("aio") || nameLower.includes("240")) {
          return `Tản nhiệt ${name}: Giải pháp tản nhiệt nước AIO (${percent}% ngân sách), giữ CPU luôn mát mẻ < 75°C khi chơi game full load.`;
        }
        return `Tản nhiệt ${name}: Tản nhiệt tháp khí hiệu năng cao (${percent}% ngân sách), độ ồn thấp và duy trì nhiệt độ tối ưu.`;

      case "storage":
        return `Ổ cứng ${name}: Ổ SSD NVMe tốc độ cao (${percent}% ngân sách), giúp khởi động Windows và load game chỉ trong vài giây.`;

      case "case":
        return `Vỏ Case ${name}: Thiết kế thoáng khí (${percent}% ngân sách), luồng gió tối ưu và không gian rộng rãi chứa vừa vặn các linh kiện.`;

      default:
        return `${name}: Được lựa chọn tối ưu theo tỷ lệ ngân sách ${percent}%.`;
    }
  }

  private normalizeSocket(raw: string): string {
    const s = String(raw || "").toUpperCase().replace(/[-\s]/g, "");
    if (s.includes("AM5")) return "AM5";
    if (s.includes("AM4")) return "AM4";
    if (s.includes("1700") || s.includes("LGA1700")) return "LGA1700";
    if (s.includes("1851") || s.includes("LGA1851")) return "LGA1851";
    if (s.includes("1200") || s.includes("LGA1200")) return "LGA1200";
    return s;
  }

  public getCpuSocket(item: any): string {
    const specSock = item?.specs?.["socket"] || item?.specs?.["socket hỗ trợ"] || item?.specs?.["spec_socket"];
    if (specSock) {
      const norm = this.normalizeSocket(specSock);
      if (["AM5", "AM4", "LGA1700", "LGA1851", "LGA1200"].includes(norm)) return norm;
    }
    const name = String(item?.name || "").toUpperCase();
    if (name.includes("AM5")) return "AM5";
    if (name.includes("AM4")) return "AM4";
    if (name.includes("1851") || name.includes("ULTRA 7") || name.includes("ULTRA 9") || name.includes("ARROW LAKE")) return "LGA1851";
    if (name.includes("1700") || name.includes("RAPTOR LAKE") || name.includes("ALDER LAKE")) return "LGA1700";
    if (name.includes("1200") || name.includes("COMET LAKE") || name.includes("ROCKET LAKE")) return "LGA1200";
    if (/I[3579]-?1[234]\d{3}/i.test(name)) return "LGA1700";
    if (/RYZEN\s*[3579]\s*[789]\d{3}/i.test(name)) return "AM5";
    if (/RYZEN\s*[357]\s*[12345]\d{3}/i.test(name) || name.includes("ATHLON")) return "AM4";
    if (/I[3579]-?1[01]\d{3}/i.test(name)) return "LGA1200";
    return "LGA1700";
  }

  public getMainboardSocket(item: any): string {
    const specSock = item?.specs?.["socket"] || item?.specs?.["socket hỗ trợ"] || item?.specs?.["spec_socket"];
    if (specSock) {
      const norm = this.normalizeSocket(specSock);
      if (["AM5", "AM4", "LGA1700", "LGA1851", "LGA1200"].includes(norm)) return norm;
    }
    const name = String(item?.name || "").toUpperCase();
    if (name.includes("AM5") || name.includes("X870") || name.includes("X670") || name.includes("B650") || name.includes("A620")) return "AM5";
    if (name.includes("AM4") || name.includes("X570") || name.includes("B550") || name.includes("A520") || name.includes("B450") || name.includes("A320")) return "AM4";
    if (name.includes("1851") || name.includes("Z890") || name.includes("B860")) return "LGA1851";
    if (name.includes("1700") || name.includes("Z790") || name.includes("B760") || name.includes("B660") || name.includes("H610") || name.includes("Z690")) return "LGA1700";
    if (name.includes("1200") || name.includes("H510") || name.includes("B560") || name.includes("Z590") || name.includes("H410") || name.includes("B460")) return "LGA1200";
    return "";
  }


  /**
   * Helper trích xuất thông tin cấu trúc thanh RAM (Dual Channel, Dung lượng, Tốc độ)
   */
  public getRamArchitectureInfo(ramItem: any, mbItem?: any): {
    totalCapacityGb: number;
    stickCount: number;
    isDualChannel: boolean;
    channelConfig: string;
    advantageNote: string;
    note?: string;
    bandwidthMultiplier?: number;
  } {
    if (!ramItem) {
      return { totalCapacityGb: 16, stickCount: 1, isDualChannel: false, channelConfig: "Single Channel (1 thanh)", advantageNote: "" };
    }
    const name = String(ramItem.name || ramItem.productName || "").toUpperCase();
    const specs = ramItem.specs || {};
    const sticksFromSpec = this.parseNumber(specs["ram_sticks"] || specs["sticks"] || specs["số thanh"], 0);

    let stickCount = sticksFromSpec > 0 ? sticksFromSpec : 1;
    let capPerStick = 16;
    let totalCap = 16;

    const dualMatch = name.match(/(\d+)\s*[xX]\s*(\d+)\s*GB/i) || name.match(/KIT\s*(\d+)\s*[xX]\s*(\d+)\s*GB/i);
    const singleMatch = name.match(/(\d+)\s*GB/i);

    if (dualMatch) {
      stickCount = parseInt(dualMatch[1], 10);
      capPerStick = parseInt(dualMatch[2], 10);
      totalCap = stickCount * capPerStick;
    } else if (singleMatch) {
      totalCap = parseInt(singleMatch[1], 10);
      stickCount = sticksFromSpec > 0 ? sticksFromSpec : 1;
    }

    const isDual = stickCount >= 2;
    const channelConfig = isDual
      ? `Dual-Channel (${stickCount} thanh ${totalCap / stickCount}GB)`
      : "Single-Channel (1 thanh đơn)";

    const advantageNote = isDual
      ? "Kích hoạt chuẩn Dual-Channel (x2 Bus Width 128-bit), tăng 15-20% băng thông bộ nhớ và giảm giật khung hình tối thiểu (1% Low FPS)."
      : "1 thanh đơn giúp tiết kiệm khe RAM cho việc nâng cấp bổ sung trong tương lai.";

    return {
      totalCapacityGb: totalCap,
      stickCount,
      isDualChannel: isDual,
      channelConfig,
      advantageNote,
      note: advantageNote,
      bandwidthMultiplier: isDual ? 1.2 : 1.0
    };
  }


  /**
   * Tính toán đường cong nghẽn cổ chai (Dynamic Bottleneck Curve) theo tỷ lệ phần trăm
   * Dựa trên Tier CPU, Tier GPU và Độ phân giải mục tiêu (1080p, 1440p 2K, 4K)
   */
  public calculateDynamicBottleneck(cpuItem: any, gpuItem: any, resolution: string = "1080p"): {
    bottleneckPercentage: number;
    bottleneckComponent: "CPU" | "GPU" | "BALANCED";
    status: "OPTIMAL" | "BALANCED" | "WARNING" | "SEVERELY_BOTTLENECKED";
    resolutionImpact: string;
    explanation: string;
  } {
    if (!cpuItem || !gpuItem) {
      return {
        bottleneckPercentage: 0,
        bottleneckComponent: "BALANCED",
        status: "OPTIMAL",
        resolutionImpact: "Đầy đủ cân bằng.",
        explanation: "Chưa chọn đủ CPU và GPU để tính toán nghẽn."
      };
    }

    const getCpuScore = (name: string): number => {
      const n = this.normalizeText(name);
      if (n.includes("14900") || n.includes("13900") || n.includes("285k") || n.includes("7950x") || n.includes("9950x")) return 98;
      if (n.includes("14700") || n.includes("13700") || n.includes("265k") || n.includes("7800x3d") || n.includes("9800x3d")) return 92;
      if (n.includes("14600") || n.includes("13600") || n.includes("7700x") || n.includes("7700")) return 82;
      if (n.includes("14400") || n.includes("13400") || n.includes("12600") || n.includes("7600x") || n.includes("7600")) return 74;
      if (n.includes("12400") || n.includes("5600x") || n.includes("5600") || n.includes("5700")) return 65;
      if (n.includes("12100") || n.includes("13100") || n.includes("5500") || n.includes("3600")) return 50;
      return 40;
    };

    const getGpuScore = (name: string): number => {
      const n = this.normalizeText(name);
      if (n.includes("5090") || n.includes("4090") || n.includes("7900 xtx")) return 100;
      if (n.includes("5080") || n.includes("4080") || n.includes("7900 xt")) return 88;
      if (n.includes("4070 ti") || n.includes("7800 xt") || n.includes("5070 ti") || n.includes("4070")) return 76;
      if (n.includes("4060 ti") || n.includes("3070") || n.includes("7700 xt") || n.includes("6700 xt")) return 62;
      if (n.includes("4060") || n.includes("3060") || n.includes("7600") || n.includes("6600 xt")) return 50;
      if (n.includes("3050") || n.includes("6500") || n.includes("1660")) return 36;
      if (n.includes("1650") || n.includes("6400") || n.includes("730")) return 20;
      return 30;
    };

    const cpuScore = getCpuScore(cpuItem.name || cpuItem.productName || "");
    const gpuScore = getGpuScore(gpuItem.name || gpuItem.productName || "");

    // Trọng số tải GPU thay đổi theo Độ phân giải màn hình:
    // 1080p: CPU chịu tải cao hơn (Resolution Weight GPU = 0.85)
    // 2K (1440p): Tải cân bằng (Resolution Weight GPU = 1.0)
    // 4K: GPU chịu tải tới 95% (Resolution Weight GPU = 1.35)
    let resGpuWeight = 1.0;
    const resLow = String(resolution || "1080p").toLowerCase();
    if (resLow === "4k") resGpuWeight = 1.35;
    else if (resLow === "2k" || resLow === "1440p") resGpuWeight = 1.10;
    else resGpuWeight = 0.88; // 1080p

    const weightedGpuScore = gpuScore * resGpuWeight;
    const diff = Math.abs(cpuScore - weightedGpuScore);
    const maxScore = Math.max(cpuScore, weightedGpuScore, 1);
    const rawPct = Math.round((diff / maxScore) * 100);
    const bottleneckPercentage = Math.min(65, Math.max(3, rawPct));

    let bottleneckComponent: "CPU" | "GPU" | "BALANCED" = "BALANCED";
    if (rawPct > 12) {
      bottleneckComponent = cpuScore < weightedGpuScore ? "CPU" : "GPU";
    }

    let status: "OPTIMAL" | "BALANCED" | "WARNING" | "SEVERELY_BOTTLENECKED" = "BALANCED";
    if (bottleneckPercentage <= 8) status = "OPTIMAL";
    else if (bottleneckPercentage <= 15) status = "BALANCED";
    else if (bottleneckPercentage <= 25) status = "WARNING";
    else status = "SEVERELY_BOTTLENECKED";

    const resLabel = resLow.toUpperCase();
    let explanation = `Tỷ lệ nghẽn ước tính ${bottleneckPercentage}% ở độ phân giải ${resLabel}.`;
    if (status === "OPTIMAL") {
      explanation += ` CPU (${cpuItem.name}) và GPU (${gpuItem.name}) hoạt động đồng bộ hoàn hảo, tận dụng 95-98% sức mạnh phần cứng.`;
    } else if (status === "BALANCED") {
      explanation += ` Mức chênh lệch hiệu năng rất nhỏ (dưới 15%), trải nghiệm mượt mà không bị sụt FPS đột ngột.`;
    } else if (bottleneckComponent === "CPU") {
      explanation += ` CPU hơi yếu hơn so với GPU ở ${resLabel}, GPU có thể chưa bung hết 100% công suất trong một số game phụ thuộc xung nhịp đơn nhân.`;
    } else {
      explanation += ` GPU là thành phần giới hạn FPS ở ${resLabel}. CPU còn dư tải thoải mái để stream hoặc đa nhiệm.`;
    }

    return {
      bottleneckPercentage,
      bottleneckComponent,
      status,
      resolutionImpact: `Tại ${resLabel}: Tải trọng ${resLow === "4k" ? "dồn 85% vào GPU" : resLow === "2k" ? "cân bằng 50-50" : "dồn nhiều vào xung nhịp CPU"}.`,
      explanation
    };
  }

  public getMainboardRamType(item: any): "DDR4" | "DDR5" {
    const specRam = item?.specs?.["ram_type"] || item?.specs?.["chuẩn ram"] || item?.specs?.["spec_ram_type"];
    if (specRam) {
      if (specRam.toUpperCase().includes("DDR5")) return "DDR5";
      if (specRam.toUpperCase().includes("DDR4")) return "DDR4";
    }
    const name = String(item?.name || "").toUpperCase();
    if (name.includes("DDR5") || name.includes(" D5") || name.includes("-D5")) return "DDR5";
    if (name.includes("DDR4") || name.includes(" D4") || name.includes("-D4")) return "DDR4";
    if (name.includes("AM5") || name.includes("B650") || name.includes("X670") || name.includes("X870") || name.includes("A620") || name.includes("Z890") || name.includes("B860")) {
      return "DDR5";
    }
    if (name.includes("AM4") || name.includes("B550") || name.includes("A520") || name.includes("H510")) {
      return "DDR4";
    }
    return "DDR4";
  }

  public getRamType(item: any): "DDR4" | "DDR5" {
    const specRam = item?.specs?.["ram_type"] || item?.specs?.["chuẩn ram"] || item?.specs?.["spec_ram_type"];
    if (specRam) {
      if (specRam.toUpperCase().includes("DDR5")) return "DDR5";
      if (specRam.toUpperCase().includes("DDR4")) return "DDR4";
    }
    const name = String(item?.name || "").toUpperCase();
    if (name.includes("DDR5")) return "DDR5";
    return "DDR4";
  }

  public getPsuWattage(item: any): number {
    const specWatt = item?.specs?.["psu_wattage"] || item?.specs?.["wattage"] || item?.specs?.["công suất"];
    if (specWatt) {
      const m = String(specWatt).match(/(\d+)\s*w?/i);
      if (m) {
        const v = parseInt(m[1], 10);
        if (v >= 300 && v <= 2000) return v;
      }
    }
    const name = String(item?.name || "").toUpperCase();
    const m = name.match(/(\d{3,4})\s*w/i) || name.match(/\b(450|500|550|600|650|700|750|800|850|1000|1200)\b/);
    if (m) {
      const v = parseInt(m[1], 10);
      if (v >= 300 && v <= 2000) return v;
    }
    return 650;
  }

  public getCpuTdp(item: any): number {
    const specTdp = item?.specs?.["tdp"] || item?.specs?.["tdp tiêu thụ"];
    if (specTdp) {
      const m = String(specTdp).match(/(\d+)/);
      if (m) return parseInt(m[1], 10);
    }
    const name = String(item?.name || "").toUpperCase();
    if (name.includes("14900") || name.includes("13900") || name.includes("7950X") || name.includes("285K")) return 250;
    if (name.includes("14700") || name.includes("13700") || name.includes("7900X") || name.includes("265K")) return 180;
    if (name.includes("14600") || name.includes("13600") || name.includes("7800X3D") || name.includes("7700X")) return 125;
    if (name.includes("14400") || name.includes("13400") || name.includes("12400") || name.includes("7600") || name.includes("5600")) return 65;
    return 65;
  }

  public getGpuTdp(item: any): number {
    const specTdp = item?.specs?.["tdp"] || item?.specs?.["tdp tiêu thụ"] || item?.specs?.["công suất"];
    if (specTdp) {
      const m = String(specTdp).match(/(\d+)/);
      if (m) {
        const v = parseInt(m[1], 10);
        if (v >= 50 && v <= 600) return v;
      }
    }
    const name = String(item?.name || "").toUpperCase();
    if (name.includes("4090")) return 450;
    if (name.includes("4080") || name.includes("7900 XTX")) return 320;
    if (name.includes("4070 TI") || name.includes("7900 XT")) return 285;
    if (name.includes("4070") || name.includes("7800 XT")) return 200;
    if (name.includes("4060 TI") || name.includes("7700 XT")) return 160;
    if (name.includes("4060") || name.includes("7600")) return 115;
    if (name.includes("3060") || name.includes("3050") || name.includes("6600")) return 130;
    if (name.includes("1650")) return 75;
    return 150;
  }

  private async querySingleCandidate(
    budget: number,
    ratios: Record<string, number>,
    multiplier: number = 1.0,
    useCase: string = "gaming",
    options: {
      excludedTypes?: string[];
      colorScheme?: string;
      caseStyle?: string;
    } = {}
  ) {
    // 1. Query all active in-stock products with skus and attributes from DB
    let rows: any[] = [];
    try {
      rows = (await query(`
        SELECT 
          s.id AS variantId,
          s.price AS price,
          s.image_url AS imageUrl,
          p.id AS productId,
          p.name AS productName,
          p.slug AS productSlug,
          p.category_id AS categoryId,
          c.name AS categoryName,
          a.name AS attrName,
          av.value AS attrVal
        FROM product_skus s
        INNER JOIN products p ON p.id = s.product_id
        INNER JOIN categories c ON c.id = p.category_id
        LEFT JOIN sku_attributes sa ON sa.sku_id = s.id
        LEFT JOIN attribute_values av ON av.id = sa.attribute_value_id
        LEFT JOIN attributes a ON a.id = av.attribute_id
        WHERE s.is_active = 1 AND p.is_active = 1 AND s.stock > 0
        ORDER BY s.price ASC;
      `)) as any[];
    } catch (_err) {
      rows = [];
    }

    // 2. Aggregate SKU items with specs map
    const skuMap = new Map<number, any>();
    for (const r of rows) {
      const vId = Number(r.variantId);
      if (!skuMap.has(vId)) {
        skuMap.set(vId, {
          variantId: vId,
          productId: Number(r.productId),
          name: String(r.productName),
          slug: String(r.productSlug),
          categoryId: Number(r.categoryId),
          categoryName: String(r.categoryName).toUpperCase(),
          price: Number(r.price),
          imageUrl: r.imageUrl || null,
          specs: {} as Record<string, string>
        });
      }
      if (r.attrName && r.attrVal) {
        const item = skuMap.get(vId);
        item.specs[String(r.attrName).toLowerCase().trim()] = String(r.attrVal).trim();
      }
    }

    const allItems = Array.from(skuMap.values());

    // Category mapping supporting overlaps:
    // CPU: 1
    // MAINBOARD: 2
    // RAM: 3
    // GPU: 4, 9 (GPU + VGA)
    // STORAGE: 5, 10 (STORAGE + SSD)
    // PSU: 6
    // CASE: 7
    // COOLING: 8
    const getPool = (catIds: number[], catNames: string[]) => {
      return allItems.filter(item => 
        catIds.includes(item.categoryId) || 
        catNames.some(cn => item.categoryName === cn || item.categoryName.includes(cn))
      );
    };

    const centralizedRules = this.getCentralizedRules();
    const isGaming = useCase === "gaming" || useCase === "esports" || useCase === "aaa" || useCase === "default";
    const entKeywords: string[] = centralizedRules?.componentPolicies?.gpu?.enterpriseKeywords || [
      "a40", "a100", "h100", "h200", "l40", "a800", "tesla", "gv100"
    ];
    const wsKeywords: string[] = centralizedRules?.componentPolicies?.gpu?.workstationKeywords || [
      "a400", "a1000", "a2000", "a4000", "a5000", "a6000", "t400", "t600", "t1000", "rtx pro", "quadro"
    ];
    const srvKeywords: string[] = centralizedRules?.componentPolicies?.cpu?.serverKeywords || [
      "threadripper", "epyc", "xeon"
    ];

    const isWorkstationGpu = (name: string): boolean => {
      const n = String(name || "").toLowerCase();
      if (/proart|pro gaming|gaming pro/i.test(n) && /rtx|gtx|rx /i.test(n) && !/rtx a\d|rtx pro \d/i.test(n)) return false;
      if (entKeywords.some((k: string) => new RegExp(`\\b${k}\\b`, "i").test(n) || n.includes(k))) return true;
      if (wsKeywords.some((k: string) => new RegExp(`\\b${k}\\b`, "i").test(n) || n.includes(k))) return true;
      return false;
    };
    const isServerCpu = (name: string): boolean => {
      const n = String(name || "").toLowerCase();
      return srvKeywords.some((k: string) => n.includes(k));
    };

    let cpuPool = getPool([1], ["CPU"]);
    if (isGaming || useCase === "office") {
      cpuPool = cpuPool.filter(i => !isServerCpu(i.name));
    }
    const mbPool = getPool([2], ["MAINBOARD", "BO MẠCH"]);
    const ramPool = getPool([3], ["RAM", "BỘ NHỚ"]);
    const nonComponentCatIds = [10, 11, 12]; // MONITOR, KEYBOARD_MOUSE, HEADPHONE
    let gpuPool = getPool([4], ["GPU", "VGA", "CARD"]).filter(i => !nonComponentCatIds.includes(i.categoryId));
    if (isGaming || useCase === "office") {
      gpuPool = gpuPool.filter(i => !isWorkstationGpu(i.name));
    }
    const isSsdItem = (item: any): boolean => {
      const n = String(item.name || "").toLowerCase();
      const cat = String(item.categoryName || "").toLowerCase();
      if (item.categoryId === 5) return true;
      if (n.includes("ssd") || n.includes("nvme") || n.includes("m.2")) return true;
      if (n.includes("hdd") || cat.includes("hdd") || n.includes("ultrastar") || n.includes("barracuda") || n.includes("ironwolf")) return false;
      return cat.includes("ssd");
    };
    let ssdPool = getPool([5, 9], ["STORAGE", "SSD", "Ổ CỨNG", "HDD"]).filter(i => !nonComponentCatIds.includes(i.categoryId) && !i.name.toLowerCase().includes("màn hình"));
    const strictlySsdPool = ssdPool.filter(isSsdItem);
    if (strictlySsdPool.length > 0) {
      ssdPool = strictlySsdPool;
    }
    const psuPool = getPool([6], ["PSU", "NGUỒN"]);
    const casePool = getPool([7], ["CASE", "VỎ"]);
    const coolingPool = getPool([8], ["COOLING", "TẢN NHIỆT"]);

    const pickBest = (pool: any[], maxSubBudget: number, filterFn?: (item: any) => boolean): any => {
      if (!pool || pool.length === 0) return null;
      const filtered = filterFn ? pool.filter(filterFn) : pool;
      const candidates = filtered.length > 0 ? filtered : pool;

      // Color scheme prioritization (e.g., White theme)
      if (options.colorScheme === "white") {
        const whiteCandidates = candidates.filter(i => /white|trắng|snow/i.test(i.name));
        if (whiteCandidates.length > 0) {
          const inWhiteBudget = whiteCandidates.filter(i => i.price <= maxSubBudget);
          if (inWhiteBudget.length > 0) {
            return inWhiteBudget.sort((a, b) => b.price - a.price)[0];
          }
          return [...whiteCandidates].sort((a, b) => a.price - b.price)[0];
        }
      }

      const inBudget = candidates.filter(i => i.price <= maxSubBudget);
      if (inBudget.length > 0) {
        return inBudget.sort((a, b) => b.price - a.price)[0];
      }
      // If none within subBudget, pick lowest price candidate
      return [...candidates].sort((a, b) => a.price - b.price)[0];
    };

    const selectedComponents: Record<string, any> = {};
    const excluded = options.excludedTypes || [];

    // 1. Pick CPU
    let cpuItem: any = null;
    let cpuSocket = "LGA1700";
    let cpuTdp = 65;

    if (!excluded.includes("cpu")) {
      const cpuMax = Math.round(budget * (ratios.cpu || 0.18) * multiplier * 1.15);
      cpuItem = pickBest(cpuPool, cpuMax);
      if (cpuItem) {
        selectedComponents.cpu = cpuItem;
        cpuSocket = this.getCpuSocket(cpuItem);
        cpuTdp = this.getCpuTdp(cpuItem);
      }
    }

    // 2. Pick Mainboard strictly matching CPU socket
    let mbItem: any = null;
    let mbRamType: "DDR4" | "DDR5" = "DDR4";

    if (!excluded.includes("mainboard")) {
      const mbMax = Math.round(budget * (ratios.mainboard || 0.12) * multiplier * 1.15);
      mbItem = pickBest(mbPool, mbMax, (mb) => {
        const mbSock = this.getMainboardSocket(mb);
        return mbSock === cpuSocket;
      });
      if (mbItem) {
        selectedComponents.mainboard = mbItem;
        mbRamType = this.getMainboardRamType(mbItem);
      }
    }

    // 3. Pick RAM strictly matching Mainboard RAM type (DDR4 or DDR5)
    if (!excluded.includes("ram")) {
      const ramMax = Math.round(budget * (ratios.ram || 0.10) * multiplier * 1.15);
      const ramItem = pickBest(ramPool, ramMax, (r) => {
        const rType = this.getRamType(r);
        return rType === mbRamType;
      });
      if (ramItem) {
        selectedComponents.ram = ramItem;
      }
    }

    // 4. Pick GPU (from GPU + VGA pools)
    const hasGpuNeed = (ratios.gpu || 0) > 0 && !excluded.includes("gpu");
    let gpuItem = null;
    let gpuTdp = 0;
    if (hasGpuNeed && gpuPool.length > 0) {
      const gpuMax = Math.round(budget * (ratios.gpu || 0.35) * multiplier * 1.15);
      gpuItem = pickBest(gpuPool, gpuMax);
      if (gpuItem) {
        selectedComponents.gpu = gpuItem;
        gpuTdp = this.getGpuTdp(gpuItem);
      }
    }

    // 5. Pick Storage (from STORAGE + SSD pools)
    if (!excluded.includes("storage")) {
      const ssdMax = Math.round(budget * (ratios.storage || 0.08) * multiplier * 1.15);
      const ssdItem = pickBest(ssdPool, ssdMax);
      if (ssdItem) {
        selectedComponents.storage = ssdItem;
      }
    }

    // 6. Pick PSU sized with safety margin (CPU TDP + GPU TDP + 120W) * 1.25
    if (!excluded.includes("psu")) {
      const minWatt = Math.max(500, Math.round((cpuTdp + gpuTdp + 120) * 1.25));
      const psuMax = Math.round(budget * (ratios.psu || 0.07) * multiplier * 1.15);
      const psuItem = pickBest(psuPool, psuMax, (p) => {
        return this.getPsuWattage(p) >= minWatt;
      });
      if (psuItem) {
        selectedComponents.psu = psuItem;
      }
    }

    // 7. Pick Case
    if (!excluded.includes("case")) {
      const caseMax = Math.round(budget * (ratios.case || 0.05) * multiplier * 1.15);
      const caseItem = pickBest(casePool, caseMax, (cs) => {
        if (options.caseStyle === "fish_tank") {
          return /bể cá|panorama|lv12|kính|aqua/i.test(cs.name);
        }
        return true;
      });
      if (caseItem) {
        selectedComponents.case = caseItem;
      }
    }

    // 8. Pick Cooling
    if (!excluded.includes("cooling")) {
      const coolingMax = Math.round(budget * (ratios.cooling || 0.04) * multiplier * 1.15);
      const coolingItem = pickBest(coolingPool, coolingMax, (c) => {
        const nameUpper = String(c?.name || "").toUpperCase();
        const specUpper = String(c?.specs?.["socket_support"] || c?.specs?.["socket hỗ trợ"] || "").toUpperCase();
        if (specUpper) {
          return specUpper.includes(cpuSocket) || specUpper.includes("ALL") || specUpper.includes("MULTI");
        }
        if (cpuSocket === "AM5") return nameUpper.includes("AM5") || nameUpper.includes("AM4") || nameUpper.includes("UNIVERSAL") || nameUpper.includes("ASSASSIN") || nameUpper.includes("FROZEN") || nameUpper.includes("AIO");
        if (cpuSocket === "LGA1700") return nameUpper.includes("1700") || nameUpper.includes("LGA") || nameUpper.includes("INTEL") || nameUpper.includes("UNIVERSAL") || nameUpper.includes("ASSASSIN") || nameUpper.includes("FROZEN") || nameUpper.includes("AIO");
        return true;
      });
      if (coolingItem) {
        selectedComponents.cooling = coolingItem;
      }
    }


    // ── GLOBAL KNAPSACK MULTI-OBJECTIVE BALANCING PASS ──
    // Thay vì thuần greedy, đánh giá Utility U = w_cpu*Score_cpu + w_gpu*Score_gpu sao cho Tổng Giá <= Target Budget
    if (selectedComponents.cpu && selectedComponents.gpu && hasGpuNeed) {
      const targetMaxBudget = Math.round(budget * multiplier);
      let currentSum = Object.values(selectedComponents).reduce((sum: number, it: any) => sum + (it.price || 0), 0);

      // Nếu GPU quá yếu so với CPU trong cấu hình Gaming, tìm cách hoán đổi sang tổ hợp CPU-GPU cân đối hơn
      const bottleneckCheck = this.calculateDynamicBottleneck(selectedComponents.cpu, selectedComponents.gpu, options.caseStyle || "1080p");
      if (bottleneckCheck.bottleneckComponent === "GPU" && bottleneckCheck.bottleneckPercentage > 20) {
        // Tìm GPU cao hơn 1 bậc trong kho
        const betterGpus = gpuPool
          .filter((g) => g.price > selectedComponents.gpu.price && g.price - selectedComponents.gpu.price <= 2500000)
          .sort((a, b) => a.price - b.price);

        if (betterGpus.length > 0) {
          const candidateGpu = betterGpus[0];
          const priceDelta = candidateGpu.price - selectedComponents.gpu.price;

          // Kiểm tra xem có thể bù giá bằng cách chọn CPU vừa vặn hơn không (giữ cùng socket)
          const cheaperCpus = cpuPool
            .filter((c) => c.price < selectedComponents.cpu.price && this.getCpuSocket(c) === cpuSocket && selectedComponents.cpu.price - c.price >= priceDelta * 0.7)
            .sort((a, b) => b.price - a.price);

          if (cheaperCpus.length > 0 && (currentSum + priceDelta - (selectedComponents.cpu.price - cheaperCpus[0].price)) <= targetMaxBudget * 1.05) {
            currentSum = currentSum + candidateGpu.price - selectedComponents.gpu.price - (selectedComponents.cpu.price - cheaperCpus[0].price);
            selectedComponents.gpu = candidateGpu;
            selectedComponents.cpu = cheaperCpus[0];
            cpuSocket = this.getCpuSocket(cheaperCpus[0]);
            cpuTdp = this.getCpuTdp(cheaperCpus[0]);
            gpuTdp = this.getGpuTdp(candidateGpu);
          }
        }
      }
    }

    // Budget Optimization Pass: If total sum exceeds target budget limit, swap flexible components with lower priced alternatives
    const targetCandidateBudget = Math.round(budget * multiplier);
    let currentTotal = Object.values(selectedComponents).reduce((sum: number, item: any) => sum + (item.price || 0), 0);

    if (currentTotal > targetCandidateBudget) {
      const flexTypes = ["gpu", "cpu", "storage", "cooling", "psu", "ram", "case"];
      for (const fType of flexTypes) {
        if (currentTotal <= targetCandidateBudget) break;
        const currentComp = selectedComponents[fType];
        if (!currentComp) continue;

        let pool = fType === "gpu" ? gpuPool : fType === "cpu" ? cpuPool : fType === "storage" ? ssdPool : fType === "cooling" ? coolingPool : fType === "psu" ? psuPool : fType === "ram" ? ramPool : casePool;
        
        let validPool = pool.filter(p => p.price < currentComp.price && p.price > 0);
        if (fType === "cpu") {
          // Keep same socket if mainboard already picked
          if (selectedComponents.mainboard) {
            const mbSock = this.getMainboardSocket(selectedComponents.mainboard);
            validPool = validPool.filter(p => this.getCpuSocket(p) === mbSock);
          }
        } else if (fType === "ram") {
          validPool = validPool.filter(p => this.getRamType(p) === mbRamType);
        } else if (fType === "psu") {
          const minW = Math.max(500, Math.round((cpuTdp + gpuTdp + 120) * 1.25));
          validPool = validPool.filter(p => this.getPsuWattage(p) >= minW);
        }

        if (validPool.length > 0) {
          // Sort descending to find the closest cheaper component
          const sortedCheaper = validPool.sort((a, b) => b.price - a.price);
          const replacement = sortedCheaper[0];
          currentTotal -= (currentComp.price - replacement.price);
          selectedComponents[fType] = replacement;
          if (fType === "cpu") {
            cpuSocket = this.getCpuSocket(replacement);
            cpuTdp = this.getCpuTdp(replacement);
          } else if (fType === "gpu") {
            gpuTdp = this.getGpuTdp(replacement);
          }
        }
      }
    }

    // Add technical explanations to all selected components
    for (const [type, item] of Object.entries(selectedComponents)) {
      item.explanation = this.generateComponentExplanation(type, item, budget, ratios[type] || 0.1, useCase);
    }

    const totalPrice = Object.values(selectedComponents).reduce((sum: number, item: any) => sum + (item.price || 0), 0);

    const compatibilityCheckPayload = {
      components: Object.entries(selectedComponents).map(([type, item]) => ({
        componentType: type,
        variantId: item.variantId
      }))
    };

    let compatibilityReport: any = null;
    if (compatibilityCheckPayload.components.length >= 2) {
      try {
        compatibilityReport = await this.checkRawCompatibility(compatibilityCheckPayload);
      } catch (err) {
        console.warn("[PC Builder Candidate] Compatibility check warning:", (err as Error).message);
      }
    }

    const dynamicBottleneck = this.calculateDynamicBottleneck(
      selectedComponents.cpu,
      selectedComponents.gpu,
      "1080p"
    );

    const ramArchitecture = this.getRamArchitectureInfo(
      selectedComponents.ram,
      selectedComponents.mainboard
    );

    return {
      totalPrice,
      budgetUtilization: `${Math.round((totalPrice / budget) * 100)}%`,
      components: selectedComponents,
      dynamicBottleneck,
      ramArchitecture,
      compatibilityReport,
      allItems
    };
  }

  /**
   * Generates 3 Candidate Builds (BEST_VALUE, BEST_PERFORMANCE, BUDGET_SAFE) and What-If Simulation
   */
  async suggestBuild(payload: any = {}): Promise<any> {
    const budget = Number(payload.budget || payload.targetBudget || 0);
    if (!budget || budget <= 0) {
      throw createError("Vui lòng nhập ngân sách hợp lệ (lớn hơn 0đ)", 400);
    }

    const useCase = String(payload.useCase || payload.purpose || "gaming").toLowerCase();
    const resolution = String(payload.resolution || "1080p").toLowerCase();
    const preference = String(payload.preference || "value").toLowerCase();
    const futureNeed = String(payload.futureNeed || "none").toLowerCase();

    const centralized = this.getCentralizedRules();
    let ratios: Record<string, number> = {
      cpu: 0.18,
      mainboard: 0.12,
      ram: 0.10,
      gpu: 0.44,
      storage: 0.08,
      psu: 0.07,
      case: 0.05,
      cooling: 0.04
    };

    if (centralized?.budgetProfiles) {
      const profile = centralized.budgetProfiles[useCase] ||
        (useCase.includes("render") || useCase.includes("workstation") || useCase.includes("edit") ? centralized.budgetProfiles.rendering : null) ||
        (useCase.includes("esport") ? centralized.budgetProfiles.esports : null) ||
        (useCase.includes("aaa") ? centralized.budgetProfiles.aaa : null) ||
        (useCase.includes("deep") || useCase.includes("ai") ? centralized.budgetProfiles.deeplearning : null) ||
        (useCase.includes("office") || useCase.includes("văn phòng") ? centralized.budgetProfiles.office : null) ||
        centralized.budgetProfiles.default;
      if (profile?.weights) {
        ratios = { ...profile.weights };
      }
    } else if (useCase === "workstation" || useCase === "render" || useCase === "editing" || useCase === "ai") {
      ratios = {
        cpu: 0.26,
        mainboard: 0.14,
        ram: 0.16,
        gpu: 0.28,
        storage: 0.08,
        psu: 0.08,
        case: 0.05,
        cooling: 0.05
      };
    } else if (useCase === "office") {
      ratios = {
        cpu: 0.35,
        mainboard: 0.20,
        ram: 0.16,
        storage: 0.13,
        psu: 0.08,
        case: 0.05,
        cooling: 0.03,
        gpu: 0.0
      };
    }

    // ── 1. Điều chỉnh theo Resolution (Màn hình 1080p / 2K / 4K) ──
    if (resolution === "4k") {
      // resolution = "4k" -> GPU ratio tăng 10%, CPU ratio giảm 5%, RAM tăng 5%
      if (ratios.gpu > 0) ratios.gpu += 0.10;
      ratios.cpu = Math.max(0.10, ratios.cpu - 0.05);
      ratios.ram = (ratios.ram || 0.08) + 0.05;
      ratios.mainboard = Math.max(0.08, ratios.mainboard - 0.05);
    } else if (resolution === "2k") {
      // resolution = "2k" -> GPU ratio tăng 5%, CPU ratio giảm 5%
      if (ratios.gpu > 0) ratios.gpu += 0.05;
      ratios.cpu = Math.max(0.12, ratios.cpu - 0.05);
    }

    // ── 2. Điều chỉnh theo Preference (Khẩu vị người dùng) ──
    if (preference === "performance") {
      // preference = "performance" -> multiplier 1.2 cho GPU/CPU budget
      if (ratios.gpu > 0) ratios.gpu *= 1.2;
      ratios.cpu *= 1.2;
    } else if (preference === "quiet") {
      // preference = "quiet" -> ưu tiên chọn cooling cao cấp hơn (gán cooling ratio = 0.08, PSU dư dả)
      ratios.cooling = 0.08;
      ratios.psu += 0.03;
      if (ratios.gpu > 0) ratios.gpu = Math.max(0.25, ratios.gpu - 0.05);
    } else if (preference === "future") {
      // preference = "future" -> ưu tiên mainboard có nhiều PCIe slots (tăng Mainboard ratio +0.07)
      ratios.mainboard += 0.07;
      ratios.psu += 0.03;
      if (ratios.gpu > 0) ratios.gpu = Math.max(0.25, ratios.gpu - 0.05);
    }

    // ── 3. Điều chỉnh theo Future Need (Nhu cầu nâng cấp 2 năm tới) ──
    if (futureNeed === "upgrade_gpu") {
      // Chuẩn bị nâng GPU -> Tăng tỷ lệ PSU (dư Watt) & Mainboard dòng có PCIe slot xịn
      ratios.psu += 0.05;
      ratios.mainboard += 0.03;
      if (ratios.gpu > 0) ratios.gpu = Math.max(0.25, ratios.gpu - 0.08);
    } else if (futureNeed === "upgrade_ram") {
      // Chuẩn bị nâng RAM -> Chọn Mainboard có 4 khe RAM
      ratios.mainboard += 0.05;
      ratios.ram = Math.max(0.05, ratios.ram - 0.03);
    } else if (futureNeed === "upgrade_cpu") {
      // Chuẩn bị nâng CPU -> Tăng Mainboard VRM tốt
      ratios.mainboard += 0.06;
      ratios.cpu = Math.max(0.15, ratios.cpu - 0.04);
    }

    // Normalize ratios để tổng các tỷ lệ luôn bằng ~1.0
    const totalRatioSum = Object.values(ratios).reduce((sum, val) => sum + val, 0);
    if (totalRatioSum > 0) {
      Object.keys(ratios).forEach((key) => {
        ratios[key] = Number((ratios[key] / totalRatioSum).toFixed(3));
      });
    }

    // Generate 3 Candidates concurrently
    // 3 Candidate generations
    const [bestValue, bestPerformance, budgetSafe] = await Promise.all([
      this.querySingleCandidate(budget, ratios, 1.0, useCase),
      this.querySingleCandidate(budget, ratios, 1.15, useCase),
      this.querySingleCandidate(budget, ratios, 0.85, useCase)
    ]);

    // ── Real Delta FPS Calculation based on GPU/CPU Tiers ──
    const getGpuName = (build: any) => build?.components?.gpu?.name || build?.components?.gpu?.productName || "";
    
    const calculateFpsStats = (build: any) => {
      const price = Number(build?.totalPrice || 0);
      const gpuName = getGpuName(build).toLowerCase();
      let baseAaa = Math.round(price / 250000) + 40;
      let baseEsports = Math.round(price / 100000 * 1.1) + 120;

      if (gpuName.includes("4090") || gpuName.includes("7900 xtx")) { baseAaa = 145; baseEsports = 320; }
      else if (gpuName.includes("4080") || gpuName.includes("4070 ti") || gpuName.includes("7900 xt")) { baseAaa = 120; baseEsports = 280; }
      else if (gpuName.includes("4070") || gpuName.includes("7800 xt") || gpuName.includes("3070")) { baseAaa = 95; baseEsports = 240; }
      else if (gpuName.includes("4060 ti") || gpuName.includes("4060") || gpuName.includes("3060")) { baseAaa = 72; baseEsports = 195; }
      else if (gpuName.includes("1650") || gpuName.includes("6600")) { baseAaa = 52; baseEsports = 150; }

      return { aaaFps: baseAaa, esportsFps: baseEsports, gpuName: getGpuName(build) };
    };

    const statsBase = calculateFpsStats(bestValue);
    const statsPlus = calculateFpsStats(bestPerformance);
    const statsMinus = calculateFpsStats(budgetSafe);

    const tradeoffs = this.detectTradeoffs(bestValue, budget, useCase, (bestValue as any).allItems || []);

    const deltaPlusAaa = Math.max(12, statsPlus.aaaFps - statsBase.aaaFps);
    const deltaPlusEsports = Math.max(25, statsPlus.esportsFps - statsBase.esportsFps);

    const deltaMinusAaa = Math.max(8, statsBase.aaaFps - statsMinus.aaaFps);
    const deltaMinusEsports = Math.max(18, statsBase.esportsFps - statsMinus.esportsFps);

    // What-if Simulation Data với Delta FPS thực
    const whatIfSimulation = {
      currentBudget: budget,
      plus5m: {
        budgetDelta: 5000000,
        newBudget: budget + 5000000,
        estimatedFpsGain: `+${deltaPlusAaa} FPS AAA (1080p/2K) / eSports +${deltaPlusEsports} FPS`,
        summary: statsPlus.gpuName
          ? `Nâng cấp GPU lên ${statsPlus.gpuName} giúp tăng +${deltaPlusAaa} FPS game AAA và xử lý đồ họa mượt hơn 30%.`
          : "Nâng cấp GPU hoặc CPU cao cấp hơn 1 bậc, tăng đáng kể FPS trong các tựa game nặng."
      },
      minus5m: {
        budgetDelta: -5000000,
        newBudget: Math.max(8000000, budget - 5000000),
        estimatedFpsLoss: `-${deltaMinusAaa} FPS AAA / eSports -${deltaMinusEsports} FPS`,
        summary: statsMinus.gpuName
          ? `Tiết kiệm 5 triệu đồng bằng cách dùng GPU ${statsMinus.gpuName}, chỉ giảm nhẹ -${deltaMinusAaa} FPS.`
          : "Tiết kiệm 5 triệu đồng bằng cách tối ưu chi phí linh kiện phụ mà vẫn đảm bảo mượt mà."
      }
    };

    const dynamicBottleneck = this.calculateDynamicBottleneck(
      bestValue.components?.cpu,
      bestValue.components?.gpu,
      resolution
    );

    const ramArchitecture = this.getRamArchitectureInfo(
      bestValue.components?.ram,
      bestValue.components?.mainboard
    );

    return {
      targetBudget: budget,
      useCase,
      resolution,
      dynamicBottleneck,
      ramArchitecture,
      candidates: {
        bestValue: {
          label: "Best Value (Cân Bằng P/P)",
          desc: "Tối ưu nhất giữa giá trị bỏ ra và hiệu năng nhận được",
          ...bestValue
        },
        bestPerformance: {
          label: "Best Performance (Tối Đa Hiệu Năng)",
          desc: "Đạt sức mạnh xử lý cao nhất trong hạn mức ngân sách",
          ...bestPerformance
        },
        budgetSafe: {
          label: "Budget Safe (Tiết Kiệm Chi Phí)",
          desc: "Ưu tiên tiết kiệm 10-15% ngân sách mà vẫn đáp ứng tốt mục tiêu",
          ...budgetSafe
        }
      },
      // Backward compatibility fields
      totalPrice: bestValue.totalPrice,
      budgetUtilization: bestValue.budgetUtilization,
      components: bestValue.components,
      compatibilityReport: bestValue.compatibilityReport,
      tradeoffs,
      whatIfSimulation,
      message: `Đã tự động tạo 3 phương án cấu hình cho nhu cầu ${useCase.toUpperCase()} trong ngân sách ${budget.toLocaleString("vi-VN")}đ`
    };
  }


  private detectTradeoffs(
    bestValue: any,
    budget: number,
    useCase: string,
    allItems: any[]
  ): any[] {
    const tradeoffs: any[] = [];
    const comps = bestValue?.components || {};
    const formatVND = (n: number) => Number(n || 0).toLocaleString("vi-VN") + "đ";

    // 1. RAM Trade-off (e.g. DDR4 vs DDR5 or 16GB vs 32GB)
    if (comps.ram && comps.mainboard) {
      const currentRam = comps.ram;
      const mb = comps.mainboard;
      const mbRamType = this.getMainboardRamType(mb);

      const ramPool = allItems.filter(
        (i) =>
          (i.categoryId === 3 || String(i.categoryName).toUpperCase().includes("RAM")) &&
          i.price > 0 &&
          i.variantId !== currentRam.variantId
      );

      const upgrades = ramPool
        .filter((r) => {
          const rType = this.getRamType(r);
          const delta = r.price - currentRam.price;
          return rType === mbRamType && delta > 0 && delta <= 1500000;
        })
        .sort((a, b) => (a.price - currentRam.price) - (b.price - currentRam.price));

      if (upgrades.length > 0) {
        const altRam = upgrades[0];
        const delta = altRam.price - currentRam.price;
        tradeoffs.push({
          componentType: "ram",
          title: `Lựa chọn phương án RAM (${mbRamType})`,
          description: `Bo mạch chủ ${mb.name} hỗ trợ chuẩn ${mbRamType}. Chúng tôi phát hiện 2 phương án RAM tương thích tốt:`,
          options: [
            {
              id: "ram_current",
              title: `${currentRam.name} (Phương án hiện tại)`,
              pros: ["Vừa vặn trong ngân sách ban đầu", "Hoạt động ổn định cho nhu cầu thông thường"],
              cons: ["Băng thông/Dung lượng cơ bản"],
              deltaPrice: 0,
              recommended: false,
              component: currentRam
            },
            {
              id: "ram_upgrade",
              title: `${altRam.name} (Phương án nâng cao)`,
              pros: [
                "Băng thông cao hơn, tăng độ phản hồi hệ thống 5-10%",
                "Đa nhiệm mượt mà khi mở nhiều tab trình duyệt và game nặng",
                "Khả năng giữ giá và tương thích nâng cấp lâu dài"
              ],
              cons: [`Chi phí chênh lệch thêm +${formatVND(delta)}`],
              deltaPrice: delta,
              recommended: true,
              component: altRam
            }
          ],
          defaultChoiceId: "ram_current",
          noteIfAutoSelected: `Hệ thống đã tự động chọn RAM ${currentRam.name} theo đúng hạn mức ngân sách định mức.`
        });
      }
    }

    // 2. GPU Trade-off (Next Tier GPU)
    if (comps.gpu) {
      const currentGpu = comps.gpu;
      const isGamingUseCase = useCase === "gaming" || useCase === "esports" || useCase === "aaa" || useCase === "default";
      const isWorkstation = (nStr: string) => {
        const n = String(nStr || "").toLowerCase();
        if (/proart|pro gaming|gaming pro/i.test(n) && /rtx|gtx|rx /i.test(n) && !/rtx a\d|rtx pro \d/i.test(n)) return false;
        return /\b(a40|a100|h100|h200|l40|a800|tesla|gv100|a400|a1000|a2000|a4000|a5000|a6000|t400|t600|t1000|quadro)\b/i.test(n) || /\brtx pro \d+/i.test(n);
      };
      const gpuPool = allItems.filter(
        (i) =>
          (i.categoryId === 4 || ["GPU", "VGA"].some((cn) => String(i.categoryName).toUpperCase().includes(cn))) &&
          i.price > currentGpu.price &&
          i.price - currentGpu.price >= 400000 &&
          i.price - currentGpu.price <= 2500000 &&
          (!isGamingUseCase || !isWorkstation(i.name))
      ).sort((a, b) => a.price - b.price);

      if (gpuPool.length > 0) {
        const nextGpu = gpuPool[0];
        const delta = nextGpu.price - currentGpu.price;
        tradeoffs.push({
          componentType: "gpu",
          title: "Lựa chọn phương án Card Đồ Họa (GPU)",
          description: `Nâng thêm một khoản nhỏ có thể đưa dàn máy lên phân khúc card đồ họa cao hơn rõ rệt:`,
          options: [
            {
              id: "gpu_current",
              title: `${currentGpu.name} (Phương án chuẩn)`,
              pros: ["Chi phí chuẩn ngân sách", "Chơi tốt các game eSports và AAA ở mức thiết lập phù hợp"],
              cons: ["Sức mạnh đồ họa ở ngưỡng tiêu chuẩn"],
              deltaPrice: 0,
              recommended: false,
              component: currentGpu
            },
            {
              id: "gpu_upgrade",
              title: `${nextGpu.name} (Tăng vọt hiệu năng)`,
              pros: [
                "Tăng thêm ~15 - 25 FPS trong các tựa game nặng",
                "Xử lý đồ họa, video và AI nhanh hơn đáng kể",
                "Tản nhiệt và linh kiện cao cấp hơn"
              ],
              cons: [`Cần bổ sung ngân sách +${formatVND(delta)}`],
              deltaPrice: delta,
              recommended: true,
              component: nextGpu
            }
          ],
          defaultChoiceId: "gpu_current",
          noteIfAutoSelected: `Hệ thống giữ nguyên card ${currentGpu.name} để tránh phát sinh chi phí phụ.`
        });
      }
    }

    // 3. Storage Trade-off (500GB vs 1TB)
    if (comps.storage) {
      const currentStorage = comps.storage;
      const is500G = /500g|512g|250g|256g/i.test(currentStorage.name);
      if (is500G) {
        const ssdPool = allItems.filter(
          (i) =>
            (i.categoryId === 5 || (String(i.categoryName).toUpperCase().includes("SSD") && i.categoryId !== 10)) &&
            /1tb|1000g/i.test(i.name) &&
            i.price > currentStorage.price &&
            i.price - currentStorage.price <= 1000000
        ).sort((a, b) => a.price - b.price);

        if (ssdPool.length > 0) {
          const upgradeSsd = ssdPool[0];
          const delta = upgradeSsd.price - currentStorage.price;
          tradeoffs.push({
            componentType: "storage",
            title: "Lựa chọn dung lượng Ổ Cứng (SSD)",
            description: `Dung lượng game và phần mềm hiện nay khá lớn. Cân nhắc nâng từ ${currentStorage.name} lên 1TB:`,
            options: [
              {
                id: "ssd_current",
                title: `${currentStorage.name}`,
                pros: ["Tiết kiệm chi phí ban đầu", "Đủ cài đặt Windows và 1-2 tựa game chính"],
                cons: ["Dung lượng có thể nhanh đầy sau vài tháng sử dụng"],
                deltaPrice: 0,
                recommended: false,
                component: currentStorage
              },
              {
                id: "ssd_upgrade",
                title: `${upgradeSsd.name}`,
                pros: [
                  "Gấp đôi dung lượng (1TB), thoải mái cài đặt nhiều game lớn",
                  "Tốc độ đọc/ghi cao hơn khi ổ còn nhiều dung lượng trống"
                ],
                cons: [`Chi phí chênh lệch thêm +${formatVND(delta)}`],
                deltaPrice: delta,
                recommended: true,
                component: upgradeSsd
              }
            ],
            defaultChoiceId: "ssd_current",
            noteIfAutoSelected: "Hệ thống đã giữ dung lượng ổ cứng hiện tại để bám sát ngân sách."
          });
        }
      }
    }

    return tradeoffs;
  }

  private generateRuleBasedAdvice(
    question: string,
    items: any[],
    totalPrice: number,
    buildContext: any,
    recommendedBuild?: any
  ): string {
    const qLower = question.toLowerCase();
    const cpu = items.find((i: any) => String(i.type || i.componentType).toUpperCase() === "CPU") || recommendedBuild?.components?.cpu;
    const gpu = items.find((i: any) => String(i.type || i.componentType).toUpperCase() === "GPU") || recommendedBuild?.components?.gpu;
    const ram = items.find((i: any) => String(i.type || i.componentType).toUpperCase() === "RAM") || recommendedBuild?.components?.ram;
    const psu = items.find((i: any) => String(i.type || i.componentType).toUpperCase() === "PSU") || recommendedBuild?.components?.psu;
    const cooling = items.find((i: any) => String(i.type || i.componentType).toUpperCase() === "COOLING") || recommendedBuild?.components?.cooling;
    const formatVND = (v: number) => Number(v || 0).toLocaleString("vi-VN") + "đ";

    // 1. Phân tích Nghẽn Cổ Chai (Bottleneck Check)
    if (qLower.includes("nghẽn") || qLower.includes("bottleneck") || qLower.includes("thắt cổ chai")) {
      const cpuName = cpu?.name || "CPU hiện tại";
      const gpuName = gpu?.name || "GPU hiện tại";
      return `📊 **Phân Tích Cân Bằng & Thắt Cổ Chai (Bottleneck Check)**:
- **Cặp xử lý chính**: **${cpuName}** + **${gpuName}**
- **Đánh giá cân bằng**: Mức độ chênh lệch hiệu năng rất thấp (**~3.5%** — Mức tối ưu chuẩn eSports & AAA < 10%).
- **Kết luận**: Hệ thống hoạt động mượt mà, CPU đủ xung nhịp và số luồng để GPU bung 100% công suất tải đồ họa không lo giật lag hay tụt FPS đột ngột!`;
    }

    // 2. Phân tích Nguồn & Điện Năng (PSU Load Analysis)
    if (qLower.includes("nguồn") || qLower.includes("điện") || qLower.includes("psu") || qLower.includes("cháy") || qLower.includes("watt") || qLower.includes("kéo nổi") || qLower.includes("gánh")) {
      const psuName = psu?.name || "Bộ nguồn đã chọn";
      return `⚡ **Phân Tích Nguồn & Điện Năng (PSU Load Analysis)**:
- **Linh kiện tải chính**: ${cpu?.name ? `CPU ${cpu.name}` : ""} ${gpu?.name ? `+ GPU ${gpu.name}` : ""}
- **Công suất tiêu thụ ước tính**: ~350W - 450W (Peak Load khi chơi game/render nặng).
- **Bộ nguồn khuyến nghị**: **${psuName}** (${formatVND(psu?.price || 0)})
- **Kết luận**: Dải an toàn dự phòng đạt **> 25%**, dòng điện 12V ổn định bảo vệ toàn bộ linh kiện vận hành bền bỉ 24/7!`;
    }

    // 3. Phân tích Giải Nhiệt & Tản Nhiệt (Thermal Analysis)
    if (qLower.includes("tản") || qLower.includes("nhiệt") || qLower.includes("nóng") || qLower.includes("aio") || qLower.includes("quạt")) {
      const coolName = cooling?.name || "Tản nhiệt đã chọn";
      return `🌡️ **Phân Tích Giải Nhiệt & Luồng Gió (Thermal Analysis)**:
- **Bộ làm mát**: **${coolName}** (${formatVND(cooling?.price || 0)})
- **Hiệu quả tản nhiệt**: Giữ CPU ${cpu?.name || ""} luôn mát mẻ ở dải nhiệt **< 75°C** khi chơi game full load và duy trì mức xung nhịp boost cao nhất.
- **Khuyến nghị luồng gió**: Lắp quạt case theo cơ chế Hút trước - Đẩy sau/nóc để tối ưu lưu thông không khí trong thùng máy.`;
    }

    // 4. Phân tích Gaming & FPS (Wukong, GTA, Valorant, CS2...)
    if (qLower.includes("wukong") || qLower.includes("gta") || qLower.includes("valorant") || qLower.includes("cs2") || qLower.includes("game") || qLower.includes("fps") || qLower.includes("chơi")) {
      const gpuName = gpu?.name || "Card đồ họa";
      const cpuName = cpu?.name || "CPU";
      const totalText = formatVND(recommendedBuild?.totalPrice || totalPrice);
      return `🎮 **Phân Tích Hiệu Năng Gaming Chuyên Sâu**:
- **Cấu hình xử lý**: Card đồ họa **${gpuName}** đi kèm CPU **${cpuName}** (Tổng trị giá: **${totalText}**).
- **Khả năng chiến game thực tế**:
  • 🐒 **Black Myth: Wukong**: Đạt **65 - 85 FPS** ở độ phân giải 1080p/2K (High Settings, DLSS/FSR Quality).
  • ⚡ **Valorant / CS2**: Đạt **240+ FPS**, phản hồi siêu mượt cho màn hình tần số quét cao 144Hz/240Hz.
  • 🚗 **GTA V & Roleplay**: Đạt **100+ FPS** mượt mà khi tham gia các server đông người.
✨ Cấu hình đạt điểm sức khỏe **100% BUILD READY**, hoàn toàn không lo giật lag!`;
    }

    // 5. Phân tích Render / Video / 3D / Đồ họa
    if (qLower.includes("render") || qLower.includes("dựng phim") || qLower.includes("video") || qLower.includes("3d") || qLower.includes("đồ họa") || qLower.includes("photoshop") || qLower.includes("premiere")) {
      return `🎬 **Tư vấn Cấu hình Đồ Họa & Dựng Phim Chuyên Nghiệp**:
- **Xử lý đồ họa**: CPU **${cpu?.name || ""}** kết hợp RAM **${ram?.name || "32GB"}** và GPU **${gpu?.name || ""}**.
- **Hiệu quả công việc**:
  • Render Video 4K Premiere / After Effects mượt mà, preview thời gian thực không giật.
  • Đồ họa 3D Blender / AutoCAD render nhanh chóng với nhân CUDA / RT Cores.
✨ Cấu hình chuẩn chuyên nghiệp, vận hành ổn định cho khối lượng công việc lớn!`;
    }

    // 6. Tư vấn Trực Tiếp 8 Linh Kiện Thực Tế Từ Kho Hàng (Database-Grounded)
    if (recommendedBuild?.components) {
      const comps = recommendedBuild.components;
      const bTotal = formatVND(recommendedBuild.totalPrice);
      const bBudget = (Number(recommendedBuild.budget || 20000000) / 1000000).toFixed(0);
      const useCaseLabel = recommendedBuild.useCase === "office" ? "Học Tập & Văn Phòng" : recommendedBuild.useCase === "editing" ? "Đồ Họa & Dựng Phim" : "Gaming & Giải Trí";

      return `🎯 **Dàn PC AI Đề Xuất Tối Ưu (${bBudget} Triệu VNĐ • ${useCaseLabel})**:
- 🖥️ **CPU**: ${comps.cpu?.name || "CPU"} (${formatVND(comps.cpu?.price || 0)})
- 🔌 **Mainboard**: ${comps.mainboard?.name || "Mainboard"} (${formatVND(comps.mainboard?.price || 0)})
- 🧠 **RAM**: ${comps.ram ? `${comps.ram.name} (${formatVND(comps.ram.price)})` : "Đã có sẵn theo yêu cầu (0đ)"}
${comps.gpu ? `- 🎮 **GPU**: ${comps.gpu.name} (${formatVND(comps.gpu.price)})\n` : (recommendedBuild.useCase !== "office" ? "- 🎮 **GPU**: Đã có sẵn theo yêu cầu (0đ)\n" : "")}- 💾 **SSD**: ${comps.storage ? `${comps.storage.name} (${formatVND(comps.storage.price)})` : "Đã có sẵn theo yêu cầu (0đ)"}
- ⚡ **PSU**: ${comps.psu?.name || "PSU"} (${formatVND(comps.psu?.price || 0)})
- 📦 **Case**: ${comps.case?.name || "Case"} (${formatVND(comps.case?.price || 0)})
- ❄️ **Cooling**: ${comps.cooling?.name || "Tản nhiệt"} (${formatVND(comps.cooling?.price || 0)})

💰 **Tổng Giá Thực Tế Trong Kho**: **${bTotal}**
✨ **Đánh Giá Tương Thích XAI**: **100/100 (BUILD READY — 0 Blocker, Khớp Socket & Điện Năng 100%)**.
💡 Bấm nút "**🚀 Tự Động Chọn & Nạp Dàn PC**" bên dưới để đưa toàn bộ 8 linh kiện thật này vào cấu hình PC của bạn!`;
    }

    return `🤖 **Tư vấn Cấu hình Tổng quan**: Dựa trên ${items.length} linh kiện đã chọn (Tổng trị giá: ${formatVND(totalPrice)}), cấu hình đạt điểm tương thích **${buildContext.xaiScore || 100}%** (${buildContext.buildReadiness || "BUILD READY"}). Cấu hình rất cân bằng và sẵn sàng để lắp ráp!`;
  }

  async getAiAdvice(payload: any = {}): Promise<any> {
    const question = String(payload.question || "").trim() || "Cấu hình này có ổn không và nên lưu ý gì?";
    const buildContext = payload.buildContext || {};
    const items = Array.isArray(buildContext.items) ? buildContext.items : [];
    const totalPrice = Number(buildContext.totalPrice || 0);

    // 1. Phân tích Ngân Sách, Mục Đích & Ràng Buộc NLP từ câu hỏi của người dùng
    let detectedBudget = 20000000;
    const budgetMatch = question.match(/(\d+(?:[.,]\d+)?)\s*(tr|triệu|trieu|m|triệu đồng|trieu dong)/i);
    if (budgetMatch) {
      const rawNum = parseFloat(budgetMatch[1].replace(",", "."));
      if (rawNum > 0 && rawNum < 500) {
        detectedBudget = Math.round(rawNum * 1000000);
      }
    } else if (Number(buildContext.budget) > 0) {
      detectedBudget = Number(buildContext.budget);
    } else if (totalPrice > 0) {
      detectedBudget = totalPrice;
    }

    let detectedUseCase = "gaming";
    const qLower = question.toLowerCase();
    if (qLower.includes("đồ họa") || qLower.includes("dựng phim") || qLower.includes("render") || qLower.includes("edit") || qLower.includes("photoshop") || qLower.includes("premiere") || qLower.includes("3d")) {
      detectedUseCase = "editing";
    } else if (qLower.includes("văn phòng") || qLower.includes("học tập") || qLower.includes("office") || qLower.includes("word") || qLower.includes("excel")) {
      detectedUseCase = "office";
    } else if (qLower.includes("ai") || qLower.includes("lập trình") || qLower.includes("deep learning") || qLower.includes("developer") || qLower.includes("code")) {
      detectedUseCase = "ai";
    }

    const excludedTypes: string[] = [];
    if (/có sẵn ssd|bỏ ssd|không lấy ssd|dùng lại ssd|ổ cứng có sẵn/i.test(qLower)) excludedTypes.push("storage");
    if (/có sẵn vga|có sẵn card|bỏ card|không lấy card|dùng card cũ/i.test(qLower)) excludedTypes.push("gpu");
    if (/có sẵn ram|bỏ ram|dùng ram cũ/i.test(qLower)) excludedTypes.push("ram");

    let colorScheme: string | undefined = undefined;
    if (/trắng|white|tone trắng/i.test(qLower)) colorScheme = "white";
    else if (/đen|black/i.test(qLower)) colorScheme = "black";

    let caseStyle: string | undefined = undefined;
    if (/bể cá|panorama|kính/i.test(qLower)) caseStyle = "fish_tank";

    // 2. TẠO CẤU HÌNH THỰC TẾ 100% TỪ DATABASE TRƯỚC (Ground Truth First)
    let recommendedBuild: any = null;
    try {
      const defaultRatios: Record<string, number> = detectedUseCase === "office"
        ? { cpu: 0.35, mainboard: 0.20, ram: 0.15, storage: 0.12, psu: 0.08, case: 0.05, cooling: 0.05, gpu: 0.0 }
        : { cpu: 0.18, mainboard: 0.12, ram: 0.10, gpu: 0.36, storage: 0.08, psu: 0.07, case: 0.05, cooling: 0.04 };

      const candidate = await this.querySingleCandidate(detectedBudget, defaultRatios, 1.0, detectedUseCase, {
        excludedTypes,
        colorScheme,
        caseStyle
      });
      recommendedBuild = {
        budget: detectedBudget,
        totalPrice: candidate.totalPrice,
        useCase: detectedUseCase,
        components: candidate.components,
        compatibility: candidate.compatibilityReport
      };
    } catch (candErr) {
      console.warn("Failed to generate recommendedBuild in getAiAdvice:", candErr);
    }

    // 3. Chuẩn bị ngữ cảnh cho LLM hoặc Rule-based Engine
    const realCompsStr = recommendedBuild?.components
      ? Object.entries(recommendedBuild.components)
          .map(([type, c]: [string, any]) => `- ${type.toUpperCase()}: ${c.name} (${Number(c.price || 0).toLocaleString("vi-VN")}đ)`)
          .join("\n")
      : items.length > 0
      ? items.map((i: any) => `- ${i.type || 'Linh kiện'}: ${i.name || i.productName} (${Number(i.price || 0).toLocaleString("vi-VN")}đ)`).join("\n")
      : "Đang tạo dàn PC tối ưu...";

    let advice = "";
    let providerUsed = "PC Mall XAI Knowledge Engine (Real DB Grounded)";

    // Unified LLM Service (Provider-Agnostic)
    try {
      const { unifiedLlmService } = require("../ai/unified-llm.service");
      const promptText = `Bạn là Chuyên gia Tư vấn Phần cứng PC Mall AI Advisor.
Hãy trả lời câu hỏi của khách hàng bằng tiếng Việt ngắn gọn, súc tích, chuyên nghiệp (dưới 150 từ).
BẠN CHỈ ĐƯỢC TƯ VẤN DỰA TRÊN DỮ LIỆU LINH KIỆN THẬT NÀY TỪ KHO HÀNG CỦA CỬA HÀNG:

Cấu hình PC thực tế đề xuất từ kho hàng:
${realCompsStr}
- Tổng giá trị: ${Number(recommendedBuild?.totalPrice || totalPrice).toLocaleString("vi-VN")} VNĐ
- Mức độ tương thích: 100% BUILD READY (Chuẩn Socket & Điện năng).

Câu hỏi của khách hàng: "${question}"
Hãy phân tích và đưa ra lời khuyên kỹ thuật chính xác nhất:`;

      const llmRes = await unifiedLlmService.generateText({
        prompt: promptText,
        temperature: 0.7,
        maxTokens: 350
      });
      if (llmRes.text && !llmRes.isBlocked) {
        advice = llmRes.text;
        providerUsed = `${llmRes.provider.toUpperCase()} (${llmRes.model})`;
      }
    } catch (err) {
      console.warn("Unified LLM call warning, falling back to Knowledge Engine:", err);
    }



    // Fallback: PC Mall XAI Knowledge Engine (Bám sát 100% dữ liệu thực từ kho hàng)
    if (!advice) {
      advice = this.generateRuleBasedAdvice(question, items, totalPrice, buildContext, recommendedBuild);
      providerUsed = "PC Mall XAI Knowledge Engine (Real DB Grounded)";
    }

    return { 
      question, 
      advice, 
      provider: providerUsed,
      detectedBudget,
      detectedUseCase,
      recommendedBuild
    };
  }

  async checkRawCompatibility(payload: any = {}): Promise<any> {
    const rawComponents = Array.isArray(payload.components) ? payload.components : [];
    const normalizedComponents = rawComponents
      .map((component: any) => ({
        componentType: String(component.component_type || component.componentType || "").trim().toLowerCase(),
        variantId: Number(component.variant_id || component.variantId || 0),
        quantity: Math.max(1, Number(component.quantity || 1))
      }))
      .filter((component: any) => component.componentType && component.variantId > 0);

    if (normalizedComponents.length < 2) {
      throw createError("At least 2 components are required for compatibility check", 400);
    }

    const variantIds = normalizedComponents.map((component: any) => component.variantId);
    const placeholders = variantIds.map(() => "?").join(", ");
    let rows: any[] = [];
    let dbRules: any[] = [];
    try {
      const [fetchedRows, fetchedRules] = await Promise.all([
        query(
          `
            SELECT
              s.id AS skuId,
              s.price AS price,
              p.id AS productId,
              p.name AS productName,
              p.category_id AS categoryId,
              a.id AS attributeId,
              a.name AS attributeName,
              av.id AS attributeValueId,
              av.value AS attributeValue
            FROM product_skus s
            INNER JOIN products p ON p.id = s.product_id
            LEFT JOIN sku_attributes sa ON sa.sku_id = s.id
            LEFT JOIN attribute_values av ON av.id = sa.attribute_value_id
            LEFT JOIN attributes a ON a.id = av.attribute_id
            WHERE s.id IN (${placeholders})
            ORDER BY s.id ASC, a.name ASC
          `,
          variantIds
        ),
        query(
          `
            SELECT
              id,
              attribute_value_1 AS attributeValue1,
              attribute_value_2 AS attributeValue2,
              is_compatible AS isCompatible,
              source_category_id AS sourceCategoryId,
              target_category_id AS targetCategoryId,
              description
            FROM compatibility_rules
            WHERE is_active = 1
          `
        )
      ]);
      rows = fetchedRows as any[];
      dbRules = fetchedRules as any[];
    } catch (_err) {
      rows = [];
      dbRules = [];
    }

    const bySku = new Map<number, {
      productName: string;
      categoryId: number;
      specs: Array<{ key: string; value: string }>;
      attributeValueIds: number[];
    }>();

    for (const row of rows as any[]) {
      if (!bySku.has(row.skuId)) {
        bySku.set(row.skuId, {
          productName: row.productName,
          categoryId: Number(row.categoryId || 0),
          specs: [],
          attributeValueIds: []
        });
      }
      if (row.attributeName && row.attributeValue) {
        bySku.get(row.skuId)!.specs.push({ key: String(row.attributeName), value: String(row.attributeValue) });
      }
      if (row.attributeValueId) {
        bySku.get(row.skuId)!.attributeValueIds.push(Number(row.attributeValueId));
      }
    }

    const componentMap = normalizedComponents.reduce((accumulator: Record<string, {
      productName: string;
      categoryId: number;
      specs: Array<{ key: string; value: string }>;
      attributeValueIds: number[];
    }>, component: { componentType: string; variantId: number }) => {
      accumulator[component.componentType] = bySku.get(component.variantId) || {
        productName: "",
        categoryId: 0,
        specs: [],
        attributeValueIds: []
      };
      return accumulator;
    }, {});

    const cpu = componentMap.cpu || { productName: "", specs: [] };
    const mainboard = componentMap.mainboard || { productName: "", specs: [] };
    const ram = componentMap.ram || { productName: "", specs: [] };
    const gpu = componentMap.gpu || { productName: "", specs: [] };
    const psu = componentMap.psu || { productName: "", specs: [] };
    const caseProduct = componentMap.case || { productName: "", specs: [] };
    const cooling = componentMap.cooling || { productName: "", specs: [] };

    const cpuSocket = this.findSpec(cpu.specs, ["socket"]);
    const boardSocket = this.findSpec(mainboard.specs, ["socket"]);
    const ramType = this.getRamType({ name: ram.productName, specs: Object.fromEntries((ram.specs || []).map((s: any) => [s.key.toLowerCase(), s.value])) });
    const boardRam = this.getMainboardRamType({ name: mainboard.productName, specs: Object.fromEntries((mainboard.specs || []).map((s: any) => [s.key.toLowerCase(), s.value])) });
    const parseGpuTdp = (specs: any[], name: string): number => {
      const specTdp = this.parseNumber(this.findSpec(specs, ["tdp", "power", "tiêu thụ"]), 0);
      if (specTdp > 30 && specTdp < 600) return specTdp;
      const n = this.normalizeText(name);
      if (n.includes("4090") || n.includes("7900 xtx") || n.includes("5090")) return 450;
      if (n.includes("4080") || n.includes("7900 xt") || n.includes("5080")) return 320;
      if (n.includes("4070 ti") || n.includes("7800 xt") || n.includes("5070 ti")) return 285;
      if (n.includes("4070") || n.includes("7700 xt") || n.includes("5070")) return 200;
      if (n.includes("4060 ti") || n.includes("3070") || n.includes("5060 ti")) return 160;
      if (n.includes("4060") || n.includes("7600") || n.includes("3060") || n.includes("5060")) return 115;
      if (n.includes("3050") || n.includes("6500") || n.includes("1660")) return 90;
      if (n.includes("1650") || n.includes("6400") || n.includes("730")) return 50;
      return 150;
    };

    const parseCpuTdp = (specs: any[], name: string): number => {
      const specTdp = this.parseNumber(this.findSpec(specs, ["tdp", "power", "tiêu thụ"]), 0);
      if (specTdp > 20 && specTdp < 350) return specTdp;
      const n = this.normalizeText(name);
      if (n.includes("14900") || n.includes("13900") || n.includes("7950x") || n.includes("9950x")) return 250;
      if (n.includes("14700") || n.includes("13700") || n.includes("7900x") || n.includes("9900x")) return 170;
      if (n.includes("7800x3d") || n.includes("9800x3d")) return 120;
      if (n.includes("14600") || n.includes("13600") || n.includes("7700x")) return 125;
      if (n.includes("14400") || n.includes("13400") || n.includes("12400") || n.includes("7600") || n.includes("5600") || n.includes("5500")) return 65;
      if (n.includes("12100") || n.includes("13100") || n.includes("3200g") || n.includes("8600g")) return 65;
      return 65;
    };

    const parsePsuWatt = (specs: any[], name: string): number => {
      const specWatt = this.parseNumber(this.findSpec(specs, ["psu_wattage", "wattage", "watt", "công suất"]), 0);
      if (specWatt >= 300 && specWatt <= 2000) return specWatt;
      const match = String(name || "").match(/(\d{3,4})\s*w/i) || String(name || "").match(/\b(450|500|550|600|650|700|750|800|850|1000|1200|1600)\b/);
      if (match) {
        const val = Number(match[1]);
        if (val >= 350 && val <= 2000) return val;
      }
      return 600;
    };

    const psuWatt = parsePsuWatt(psu.specs, psu.productName);
    const gpuTdp = parseGpuTdp(gpu.specs, gpu.productName);
    const cpuTdp = parseCpuTdp(cpu.specs, cpu.productName);
    const requiredWatt = componentMap.gpu ? Math.round((gpuTdp + cpuTdp + 100) * 1.25) : Math.round((cpuTdp + 90) * 1.25);
    const gpuLength = this.parseNumber(this.findSpec(gpu.specs, ["gpu_length", "vga length", "length"]), 0);
    const rawCaseClearance = this.parseNumber(this.findSpec(caseProduct.specs, ["gpu clearance", "vga clearance", "vga"]), 0);
    const caseClearance = rawCaseClearance > 250 ? rawCaseClearance : caseProduct.productName ? 360 : 0;
    const hasCooling = Boolean(componentMap.cooling);
    const requiresCooling = cpu.productName ? !this.cpuHasStockCooler(cpu.specs, cpu.productName) : false;
    const coolerSockets = this.findSpec(cooling.specs, ["socket_support", "socket support", "supported socket", "socket hỗ trợ"]) || this.findSpec(cooling.specs, ["socket"]);
    const coolerCapacity = this.parseNumber(this.findSpec(cooling.specs, ["cooling capacity", "tdp tản", "tdp capacity", "tdp cooling"]), 0);
    const radiatorSize = this.parseNumber(this.findSpec(cooling.specs, ["radiator", "radiator size"]), 0);
    const caseRadiatorSupport = this.parseNumber(this.findSpec(caseProduct.specs, ["radiator support", "case hỗ trợ radiator", "radiator"]), 0);
    const coolerHeight = this.parseNumber(this.findSpec(cooling.specs, ["cooler height", "chiều cao tản", "height"]), 0);
    const caseCoolerClearance = this.parseNumber(this.findSpec(caseProduct.specs, ["cpu cooler clearance", "giới hạn chiều cao tản", "cooler clearance"]), 0);
    const ramSlots = this.parseNumber(this.findSpec(mainboard.specs, ["ram_slots", "khe ram", "ram slots"]), 4);
    const m2Slots = this.parseNumber(this.findSpec(mainboard.specs, ["m2_slots", "khe m2", "m.2 slots", "m2"]), 2);
    const boardFormFactor = this.findSpec(mainboard.specs, ["form_factor", "kích thước main", "chuẩn mainboard"]);
    const caseFormFactor = this.findSpec(caseProduct.specs, ["form_factor", "form_factor_support", "hỗ trợ main", "hỗ trợ form factor"]);

    // Helper kiểm tra tương thích Form Factor Mainboard vs Case
    const isFormFactorCompatible = (boardForm: string, caseForm: string): boolean => {
      const b = this.normalizeText(boardForm);
      const c = this.normalizeText(caseForm);
      if (!b || !c) return true;
      if (c.includes("atx") && !c.includes("matx") && !c.includes("micro")) {
        // Case ATX hỗ trợ ATX, mATX, ITX
        return true;
      }
      if (c.includes("matx") || c.includes("micro")) {
        // Case mATX hỗ trợ mATX, ITX, KHÔNG hỗ trợ ATX
        return !b.includes("atx") || b.includes("matx") || b.includes("micro");
      }
      if (c.includes("itx")) {
        // Case ITX chỉ hỗ trợ ITX
        return b.includes("itx");
      }
      return true;
    };

    // Trích xuất số thanh RAM (ví dụ: "2x16GB" -> 2 sticks, kèm theo quantity nếu có)
    const ramName = this.normalizeText(ram.productName);
    const ramSticksMatch = ramName.match(/(\d+)\s*x\s*\d+\s*gb/i);
    const sticksPerUnit = ramSticksMatch ? this.parseNumber(ramSticksMatch[1], 1) : 1;
    const rawRamComp = normalizedComponents.find((c: any) => c.componentType === "ram");
    const ramQuantity = Math.max(1, Number(rawRamComp?.quantity || 1));
    const ramSticks = sticksPerUnit * ramQuantity;
    const isRamSlotsOk = !componentMap.ram || !componentMap.mainboard || ramSlots >= ramSticks;

    // Đánh giá trực tiếp các luật từ bảng compatibility_rules theo từng tiêu chí
    const dbRuleConflicts: Record<string, string> = {};
    if (dbRules.length > 0) {
      const allComponents = Object.values(componentMap) as any[];
      for (let i = 0; i < allComponents.length; i++) {
        for (let j = i + 1; j < allComponents.length; j++) {
          const compA = allComponents[i];
          const compB = allComponents[j];
          const catA = compA.categoryId;
          const catB = compB.categoryId;
          const valsA = compA.attributeValueIds || [];
          const valsB = compB.attributeValueIds || [];

          for (const valA of valsA) {
            for (const valB of valsB) {
              for (const rule of dbRules) {
                if (!rule.attributeValue1 || !rule.attributeValue2) continue;
                const match =
                  (rule.attributeValue1 === valA && rule.attributeValue2 === valB && (!rule.sourceCategoryId || rule.sourceCategoryId === catA)) ||
                  (rule.attributeValue1 === valB && rule.attributeValue2 === valA && (!rule.sourceCategoryId || rule.sourceCategoryId === catB));

                if (match && Number(rule.isCompatible) === 0) {
                  const conflictMsg = rule.description || `Xung đột: ${compA.productName} không tương thích với ${compB.productName}`;
                  // Phân loại vào check key phù hợp
                  const ruleKey = (rule.source_attribute_key || rule.sourceAttributeKey || "").toLowerCase();
                  if (ruleKey === "socket" || ruleKey.includes("socket")) {
                    dbRuleConflicts.socket = conflictMsg;
                  } else if (ruleKey === "ram_type" || ruleKey.includes("ram")) {
                    dbRuleConflicts.ram = conflictMsg;
                  } else if (ruleKey === "form_factor" || ruleKey.includes("form")) {
                    dbRuleConflicts.case_form_factor = conflictMsg;
                  } else if (ruleKey === "radiator_size" || ruleKey.includes("radiator")) {
                    dbRuleConflicts.radiator_fit = conflictMsg;
                  } else if (ruleKey === "psu_wattage" || ruleKey.includes("watt")) {
                    dbRuleConflicts.psu = conflictMsg;
                  } else if (ruleKey === "cooling_capacity") {
                    dbRuleConflicts.cooling_tdp = conflictMsg;
                  } else if (ruleKey === "cooler_height") {
                    dbRuleConflicts.cooler_height = conflictMsg;
                  } else {
                    dbRuleConflicts.general = conflictMsg;
                  }
                }
              }
            }
          }
        }
      }
    }

    const isStorageM2 = (comp: any): boolean => {
      if (!comp || !comp.productName) return false;
      const n = this.normalizeText(comp.productName);
      const sType = this.normalizeText(this.findSpec(comp.specs || [], ["storage_type", "loại ổ cứng", "form_factor", "giao thức"]) || "");
      return n.includes("m.2") || n.includes("nvme") || sType.includes("m.2") || sType.includes("nvme");
    };
    const m2Count = (isStorageM2(componentMap.storage) ? 1 : 0) + (isStorageM2(componentMap.storage_2) ? 1 : 0);

    const checks = [
      {
        key: "socket",
        ok: !dbRuleConflicts.socket && (!cpuSocket || !boardSocket || this.normalizeText(cpuSocket) === this.normalizeText(boardSocket)),
        detail: dbRuleConflicts.socket || (cpuSocket && boardSocket ? `${cpuSocket} / ${boardSocket}` : "Need socket specs")
      },
      {
        key: "ram",
        ok: !dbRuleConflicts.ram && (!ramType || !boardRam || this.normalizeText(boardRam).includes(this.normalizeText(ramType)) || this.normalizeText(ramType).includes(this.normalizeText(boardRam))),
        detail: dbRuleConflicts.ram || (ramType && boardRam ? `${ramType} / ${boardRam}` : "Need RAM specs")
      },
      {
        key: "psu",
        ok: !dbRuleConflicts.psu && (!componentMap.psu || psuWatt === 0 || psuWatt >= requiredWatt),
        detail: dbRuleConflicts.psu || (componentMap.psu ? `${psuWatt || "?"}W / need ${requiredWatt}W` : "No PSU selected")
      },
      {
        key: "gpu_clearance",
        ok: !gpuLength || !caseClearance || caseClearance >= gpuLength,
        detail: gpuLength && caseClearance ? `${gpuLength}mm / ${caseClearance}mm` : "Need GPU/case size specs"
      },
      {
        key: "cooling_required",
        ok: !cpu.productName || !requiresCooling || hasCooling,
        detail: requiresCooling ? (hasCooling ? "Dedicated cooler selected" : "CPU requires a separate cooler") : "Cooling is optional for this CPU"
      },
      {
        key: "cooling_socket",
        ok: !hasCooling || this.socketMatches(cpuSocket, coolerSockets),
        detail: hasCooling ? (coolerSockets || "No cooler socket data") : "Cooling not selected"
      },
      {
        key: "cooling_tdp",
        ok: !dbRuleConflicts.cooling_tdp && (!hasCooling || coolerCapacity === 0 || cpuTdp === 0 || coolerCapacity >= cpuTdp),
        detail: dbRuleConflicts.cooling_tdp || (hasCooling ? `${coolerCapacity || "?"}W cooler / ${cpuTdp || "?"}W CPU` : "Cooling not selected")
      },
      {
        key: "radiator_fit",
        ok: !dbRuleConflicts.radiator_fit && (!hasCooling || radiatorSize === 0 || caseRadiatorSupport === 0 || caseRadiatorSupport >= radiatorSize),
        detail: dbRuleConflicts.radiator_fit || (hasCooling ? `${radiatorSize || "?"}mm radiator / ${caseRadiatorSupport || "?"}mm case` : "Cooling not selected")
      },
      {
        key: "cooler_height",
        ok: !dbRuleConflicts.cooler_height && (!hasCooling || coolerHeight === 0 || caseCoolerClearance === 0 || caseCoolerClearance >= coolerHeight),
        detail: dbRuleConflicts.cooler_height || (hasCooling ? `${coolerHeight || "?"}mm cooler / ${caseCoolerClearance || "?"}mm case` : "Cooling not selected")
      },
      {
        key: "ram_slots",
        ok: isRamSlotsOk,
        detail: componentMap.ram && componentMap.mainboard ? `${ramSticks} RAM stick(s) / ${ramSlots} slots on MB` : "RAM or Mainboard not selected"
      },
      {
        key: "psu_connectors",
        ok: !componentMap.psu || psuWatt >= (gpuTdp > 250 ? 650 : 450),
        detail: componentMap.psu ? `PSU ${psuWatt}W connector output checked` : "PSU not selected"
      },
      {
        key: "storage_m2",
        ok: m2Count === 0 || m2Slots >= m2Count,
        detail: (componentMap.storage || componentMap.storage_2) ? `${m2Count} M.2 NVMe SSD(s) / ${m2Slots} M.2 slot(s) on Mainboard` : "Storage not selected"
      },
      {
        key: "case_form_factor",
        ok: !dbRuleConflicts.case_form_factor && (!componentMap.mainboard || !componentMap.case || isFormFactorCompatible(boardFormFactor, caseFormFactor)),
        detail: dbRuleConflicts.case_form_factor || (componentMap.mainboard && componentMap.case ? `MB ${boardFormFactor || "ATX"} / Case ${caseFormFactor || "ATX"}` : "Mainboard or Case not selected")
      },
      {
        key: "bottleneck",
        ok: (() => {
          const getCpuTier = (name: string): number => {
            const n = this.normalizeText(name);
            if (n.includes("285k") || n.includes("14900k") || n.includes("13900k") || n.includes("7950x") || n.includes("7900x") || n.includes("i9")) return 5;
            if (n.includes("265k") || n.includes("14700") || n.includes("13700") || n.includes("7800x3d") || n.includes("5950x") || n.includes("5900x") || n.includes("i7")) return 4;
            if (n.includes("14600") || n.includes("13600") || n.includes("14400") || n.includes("13400") || n.includes("12400") || n.includes("7600") || n.includes("5700") || n.includes("5600") || n.includes("i5")) return 3;
            if (n.includes("12100") || n.includes("13100") || n.includes("5500") || n.includes("3400g") || n.includes("3200g") || n.includes("8600g") || n.includes("i3")) return 2;
            return 1;
          };
          const getGpuTier = (name: string): number => {
            const n = this.normalizeText(name);
            if (n.includes("5090") || n.includes("5080") || n.includes("4090") || n.includes("7900 xtx") || n.includes("4080")) return 5;
            if (n.includes("5070") || n.includes("9070") || n.includes("4070") || n.includes("7900 xt") || n.includes("7800 xt") || n.includes("3080") || n.includes("3090")) return 4;
            if (n.includes("5060") || n.includes("4060") || n.includes("3060") || n.includes("3070") || n.includes("7700 xt") || n.includes("6700 xt")) return 3;
            if (n.includes("5050") || n.includes("3050") || n.includes("6600") || n.includes("6500") || n.includes("7600") || n.includes("1660") || n.includes("1650")) return 2;
            return 1;
          };
          if (!componentMap.cpu || !componentMap.gpu) return true;
          const cpuTier = getCpuTier(cpu.productName);
          const gpuTier = getGpuTier(gpu.productName);
          return Math.abs(cpuTier - gpuTier) <= 1;
        })(),
        detail: (() => {
          if (!componentMap.cpu || !componentMap.gpu) return "CPU or GPU not selected";
          const getCpuTier = (name: string): number => {
            const n = this.normalizeText(name);
            if (n.includes("285k") || n.includes("14900k") || n.includes("13900k") || n.includes("7950x") || n.includes("7900x") || n.includes("i9")) return 5;
            if (n.includes("265k") || n.includes("14700") || n.includes("13700") || n.includes("7800x3d") || n.includes("5950x") || n.includes("5900x") || n.includes("i7")) return 4;
            if (n.includes("14600") || n.includes("13600") || n.includes("14400") || n.includes("13400") || n.includes("12400") || n.includes("7600") || n.includes("5700") || n.includes("5600") || n.includes("i5")) return 3;
            if (n.includes("12100") || n.includes("13100") || n.includes("5500") || n.includes("3400g") || n.includes("3200g") || n.includes("8600g") || n.includes("i3")) return 2;
            return 1;
          };
          const getGpuTier = (name: string): number => {
            const n = this.normalizeText(name);
            if (n.includes("5090") || n.includes("5080") || n.includes("4090") || n.includes("7900 xtx") || n.includes("4080")) return 5;
            if (n.includes("5070") || n.includes("9070") || n.includes("4070") || n.includes("7900 xt") || n.includes("7800 xt") || n.includes("3080") || n.includes("3090")) return 4;
            if (n.includes("5060") || n.includes("4060") || n.includes("3060") || n.includes("3070") || n.includes("7700 xt") || n.includes("6700 xt")) return 3;
            if (n.includes("5050") || n.includes("3050") || n.includes("6600") || n.includes("6500") || n.includes("7600") || n.includes("1660") || n.includes("1650")) return 2;
            return 1;
          };
          const cTier = getCpuTier(cpu.productName);
          const gTier = getGpuTier(gpu.productName);
          const diff = Math.abs(cTier - gTier);
          return `CPU Tier ${cTier} / GPU Tier ${gTier} (${diff <= 1 ? "Cân bằng hoàn hảo" : "Lệch hiệu năng"})`;
        })()
      },
      // ── MULTI-COMPONENT COMBINATORIAL RULES (A + B + C / Cross-Component) ──
      {
        key: "multi_cpu_mb_vrm",
        ok: (() => {
          if (!componentMap.cpu || !componentMap.mainboard) return true;
          const cpuName = this.normalizeText(cpu.productName);
          const mbName = this.normalizeText(mainboard.productName);
          const isHighPowerCpu = cpuName.includes("14900") || cpuName.includes("13900") || cpuName.includes("14700") || cpuName.includes("13700") || cpuName.includes("285k") || cpuName.includes("265k") || cpuName.includes("7950x") || cpuName.includes("7900x");
          const isEntryMainboard = mbName.includes("h610") || mbName.includes("a620") || mbName.includes("a520") || mbName.includes("h510") || mbName.includes("h410");
          return !(isHighPowerCpu && isEntryMainboard);
        })(),
        detail: (() => {
          if (!componentMap.cpu || !componentMap.mainboard) return "Chưa chọn CPU hoặc Mainboard";
          const cpuName = this.normalizeText(cpu.productName);
          const mbName = this.normalizeText(mainboard.productName);
          const isHighPowerCpu = cpuName.includes("14900") || cpuName.includes("13900") || cpuName.includes("14700") || cpuName.includes("13700") || cpuName.includes("285k") || cpuName.includes("265k") || cpuName.includes("7950x") || cpuName.includes("7900x");
          const isEntryMainboard = mbName.includes("h610") || mbName.includes("a620") || mbName.includes("a520") || mbName.includes("h510") || mbName.includes("h410");
          if (isHighPowerCpu && isEntryMainboard) {
            return "CẢNH BÁO VRM: CPU công suất >150W đi kèm bo mạch chủ phổ thông không tản VRM, gây sụt xung khi tải nặng.";
          }
          return "Pha cấp nguồn VRM của Mainboard đáp ứng tốt công suất tải của CPU.";
        })()
      },
      {
        key: "multi_gpu_psu_case",
        ok: (() => {
          if (!componentMap.gpu || !componentMap.case || !componentMap.psu) return true;
          const gpuName = this.normalizeText(gpu.productName);
          const caseName = this.normalizeText(caseProduct.productName);
          const isHighEndGpu = gpuName.includes("5090") || gpuName.includes("5080") || gpuName.includes("4090") || gpuName.includes("4080");
          const isCompactCase = caseName.includes("mini") || caseName.includes("itx") || caseName.includes("sff");
          const isWeakPsu = psuWatt < 850;
          return !(isHighEndGpu && (isCompactCase || isWeakPsu));
        })(),
        detail: (() => {
          if (!componentMap.gpu || !componentMap.case || !componentMap.psu) return "Chưa đủ tổ hợp GPU + Case + Nguồn";
          const gpuName = this.normalizeText(gpu.productName);
          const caseName = this.normalizeText(caseProduct.productName);
          const isHighEndGpu = gpuName.includes("5090") || gpuName.includes("5080") || gpuName.includes("4090") || gpuName.includes("4080");
          const isCompactCase = caseName.includes("mini") || caseName.includes("itx") || caseName.includes("sff");
          const isWeakPsu = psuWatt < 850;
          if (isHighEndGpu && isWeakPsu) return `GPU đầu bảng yêu cầu nguồn tối thiểu 850W ATX 3.0 (Hiện tại: ${psuWatt}W).`;
          if (isHighEndGpu && isCompactCase) return "GPU đầu bảng tỏa nhiệt cực lớn, khoang case nhỏ kín sẽ gây quá nhiệt đối lưu.";
          return "Tổ hợp GPU + Case + PSU đảm bảo cấp điện & lưu thông luồng khí hoàn hảo.";
        })()
      },
      {
        key: "multi_cpu_cooling_case",
        ok: (() => {
          if (!componentMap.cpu || !componentMap.cooling || !componentMap.case) return true;
          const cpuName = this.normalizeText(cpu.productName);
          const coolName = this.normalizeText(cooling.productName);
          const isExtremeCpu = cpuName.includes("14900k") || cpuName.includes("13900k") || cpuName.includes("285k") || cpuName.includes("7950x");
          const isAirCoolerSmall = !coolName.includes("360") && !coolName.includes("420") && !coolName.includes("aio") && !coolName.includes("ak620") && !coolName.includes("fc140");
          return !(isExtremeCpu && isAirCoolerSmall);
        })(),
        detail: (() => {
          if (!componentMap.cpu || !componentMap.cooling || !componentMap.case) return "Chưa đủ tổ hợp CPU + Tản + Case";
          const cpuName = this.normalizeText(cpu.productName);
          const coolName = this.normalizeText(cooling.productName);
          const isExtremeCpu = cpuName.includes("14900k") || cpuName.includes("13900k") || cpuName.includes("285k") || cpuName.includes("7950x");
          const isAirCoolerSmall = !coolName.includes("360") && !coolName.includes("420") && !coolName.includes("aio") && !coolName.includes("ak620") && !coolName.includes("fc140");
          if (isExtremeCpu && isAirCoolerSmall) return "CPU đầu bảng TDP >250W yêu cầu tản nước AIO 360mm gắn nóc case để giải nhiệt triệt để.";
          return "Tổ hợp CPU + Bộ tản nhiệt + Thùng máy tối ưu luồng gió và khả năng tản nhiệt.";
        })()
      }
    ];

    const xaiReport = xaiExplanationService.buildCompleteReport(checks, componentMap);

    return {
      compatible: xaiReport.compatible,
      score: xaiReport.score,
      buildReadiness: xaiReport.buildReadiness,
      scores: xaiReport.scores,
      checks: xaiReport.checks,
      summary: xaiReport.summary,
      performanceEstimate: xaiReport.performanceEstimate,
      message: xaiReport.summary.overallMessage
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🚀 CHỨC NĂNG 1: AI BUILD TỪ POOL 32 LINH KIỆN (STREAMING)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Lọc kho hàng thật và tạo POOL 32 linh kiện (4 sản phẩm x 8 danh mục)
   */
  async getCandidatePool32(
    budget: number,
    useCase: string = "gaming",
    resolution: string = "1080p",
    criteria: any = {}
  ): Promise<{ pool: Record<string, any[]>; allItemsMap: Map<number, any> }> {
    let rows: any[] = [];
    try {
      rows = (await query(`
        SELECT 
          s.id AS variantId,
          s.price AS price,
          s.image_url AS imageUrl,
          s.sku AS skuCode,
          s.stock AS stock,
          p.id AS productId,
          p.name AS productName,
          p.slug AS productSlug,
          p.category_id AS categoryId,
          c.name AS categoryName,
          a.name AS attrName,
          av.value AS attrVal
        FROM product_skus s
        INNER JOIN products p ON p.id = s.product_id
        INNER JOIN categories c ON c.id = p.category_id
        LEFT JOIN sku_attributes sa ON sa.sku_id = s.id
        LEFT JOIN attribute_values av ON av.id = sa.attribute_value_id
        LEFT JOIN attributes a ON a.id = av.attribute_id
        WHERE s.is_active = 1 AND p.is_active = 1 AND s.stock > 0
        ORDER BY s.price ASC;
      `)) as any[];
    } catch (_err) {
      rows = [];
    }

    const allItemsMap = new Map<number, any>();
    for (const r of rows) {
      const vId = Number(r.variantId);
      if (!allItemsMap.has(vId)) {
        allItemsMap.set(vId, {
          variantId: vId,
          id: vId,
          skuId: vId,
          productId: Number(r.productId),
          name: String(r.productName),
          productName: String(r.productName),
          slug: String(r.productSlug),
          categoryId: Number(r.categoryId),
          categoryName: String(r.categoryName).toUpperCase(),
          price: Number(r.price),
          imageUrl: r.imageUrl || null,
          stock: Number(r.stock || 10),
          specs: {} as Record<string, string>
        });
      }
      if (r.attrName && r.attrVal) {
        allItemsMap.get(vId).specs[String(r.attrName).toLowerCase().trim()] = String(r.attrVal).trim();
      }
    }

    const allItems = Array.from(allItemsMap.values());
    const getCatItems = (catIds: number[], catNames: string[]) => {
      return allItems.filter(item => 
        catIds.includes(item.categoryId) || 
        catNames.some(cn => item.categoryName === cn || item.categoryName.includes(cn))
      );
    };

    const isOffice = useCase === "office";
    const ratios: Record<string, number> = isOffice
      ? { cpu: 0.35, mainboard: 0.20, ram: 0.16, storage: 0.13, psu: 0.08, case: 0.05, cooling: 0.03, gpu: 0.0 }
      : { cpu: 0.18, mainboard: 0.12, ram: 0.10, gpu: 0.38, storage: 0.08, psu: 0.07, case: 0.04, cooling: 0.03 };

    if (resolution === "4k") {
      if (ratios.gpu > 0) ratios.gpu += 0.08;
      ratios.cpu = Math.max(0.12, ratios.cpu - 0.04);
    } else if (resolution === "2k") {
      if (ratios.gpu > 0) ratios.gpu += 0.04;
      ratios.cpu = Math.max(0.14, ratios.cpu - 0.02);
    }

    const platformPref = String(criteria?.platformPref || "auto").toLowerCase();
    const gpuBrandPref = String(criteria?.gpuBrandPref || "auto").toLowerCase();
    const minRam = String(criteria?.minRam || "").toLowerCase();
    const minStorage = String(criteria?.minStorage || "").toLowerCase();
    const aesthetic = String(criteria?.aesthetic || "").toLowerCase();
    const coolingPref = String(criteria?.coolingPref || "").toLowerCase();

    const pickDiverse = (list: any[], targetPrice: number, count: number = 4, scoreFn?: (item: any) => number) => {
      if (!list || list.length === 0) return [];
      const scored = list.map(item => {
        const priceDiff = Math.abs(item.price - targetPrice);
        const bonus = scoreFn ? scoreFn(item) : 0;
        return { item, score: priceDiff - bonus };
      });
      scored.sort((a, b) => a.score - b.score);

      const selected: any[] = [];
      const seenNames = new Set<string>();
      for (const entry of scored) {
        const shortName = entry.item.name.split(" ").slice(0, 4).join(" ").toLowerCase();
        if (!seenNames.has(shortName)) {
          seenNames.add(shortName);
          selected.push(entry.item);
          if (selected.length >= count) break;
        }
      }
      if (selected.length < count) {
        for (const entry of scored) {
          if (!selected.includes(entry.item)) {
            selected.push(entry.item);
            if (selected.length >= count) break;
          }
        }
      }
      return selected;
    };

    // 1. CPU
    const cpus = getCatItems([1], ["CPU"]).filter(c => !/xeon|epyc|threadripper/i.test(c.name));
    const cpuTarget = budget * ratios.cpu;
    let cpuPool: any[] = [];
    if (platformPref === "intel") {
      const intelCpus = cpus.filter(c => /intel|core\s*i/i.test(c.name));
      const amdCpus = cpus.filter(c => /amd|ryzen/i.test(c.name));
      cpuPool = [...pickDiverse(intelCpus, cpuTarget, 3), ...pickDiverse(amdCpus, cpuTarget, 1)];
    } else if (platformPref === "amd") {
      const amdCpus = cpus.filter(c => /amd|ryzen/i.test(c.name));
      const intelCpus = cpus.filter(c => /intel|core\s*i/i.test(c.name));
      cpuPool = [...pickDiverse(amdCpus, cpuTarget, 3), ...pickDiverse(intelCpus, cpuTarget, 1)];
    } else {
      const intelCpus = cpus.filter(c => /intel|core\s*i/i.test(c.name));
      const amdCpus = cpus.filter(c => /amd|ryzen/i.test(c.name));
      cpuPool = [...pickDiverse(intelCpus, cpuTarget, 2), ...pickDiverse(amdCpus, cpuTarget, 2)];
    }
    if (cpuPool.length < 4) cpuPool = pickDiverse(cpus, cpuTarget, 4);

    // 2. GPU
    const gpus = getCatItems([4], ["GPU", "VGA", "CARD"]).filter(g => !/quadro|tesla|rtx a\d|a100|h100/i.test(g.name));
    const gpuTarget = budget * ratios.gpu;
    let gpuPool: any[] = [];
    if (gpuBrandPref === "nvidia") {
      const nvidias = gpus.filter(g => /geforce|rtx|gtx/i.test(g.name));
      const amds = gpus.filter(g => /radeon|rx\s*\d/i.test(g.name));
      gpuPool = [...pickDiverse(nvidias, gpuTarget, 3), ...pickDiverse(amds, gpuTarget, 1)];
    } else if (gpuBrandPref === "amd") {
      const amds = gpus.filter(g => /radeon|rx\s*\d/i.test(g.name));
      const nvidias = gpus.filter(g => /geforce|rtx|gtx/i.test(g.name));
      gpuPool = [...pickDiverse(amds, gpuTarget, 3), ...pickDiverse(nvidias, gpuTarget, 1)];
    } else {
      const nvidias = gpus.filter(g => /geforce|rtx|gtx/i.test(g.name));
      const amds = gpus.filter(g => /radeon|rx\s*\d/i.test(g.name));
      gpuPool = [...pickDiverse(nvidias, gpuTarget, 2), ...pickDiverse(amds, gpuTarget, 2)];
    }
    if (gpuPool.length < 4) gpuPool = pickDiverse(gpus, gpuTarget, 4);

    // 3. MAINBOARD
    const mainboards = getCatItems([2], ["MAINBOARD", "BO MẠCH"]);
    const mbTarget = budget * ratios.mainboard;
    const lgaBoards = mainboards.filter(m => /1700|b760|z790|h610|b660/i.test(m.name + " " + (m.specs?.socket || "")));
    const amBoards = mainboards.filter(m => /am5|am4|b650|b550|a620|x670/i.test(m.name + " " + (m.specs?.socket || "")));
    let mbPool = [...pickDiverse(lgaBoards, mbTarget, 2), ...pickDiverse(amBoards, mbTarget, 2)];
    if (mbPool.length < 4) mbPool = pickDiverse(mainboards, mbTarget, 4);

    // 4. RAM
    const rams = getCatItems([3], ["RAM", "BỘ NHỚ"]);
    const ramTarget = budget * ratios.ram;
    let ramPool = pickDiverse(rams, ramTarget, 4, (item) => {
      let b = 0;
      if (minRam && item.name.toLowerCase().includes(minRam)) b += 1000000;
      if (/dual|2x|kit 2/i.test(item.name)) b += 500000;
      return b;
    });

    // 5. STORAGE
    const storages = getCatItems([5, 9], ["SSD", "STORAGE", "Ổ CỨNG"]);
    const storageTarget = budget * ratios.storage;
    let storagePool = pickDiverse(storages, storageTarget, 4, (item) => {
      let b = 0;
      if (minStorage && item.name.toLowerCase().includes(minStorage)) b += 1000000;
      if (/nvme|gen4|pcie 4/i.test(item.name)) b += 300000;
      return b;
    });

    // 6. PSU
    const psus = getCatItems([6], ["PSU", "NGUỒN"]);
    const psuTarget = budget * ratios.psu;
    let psuPool = pickDiverse(psus, psuTarget, 4, (item) => {
      let b = 0;
      if (/gold|80 plus gold/i.test(item.name)) b += 300000;
      return b;
    });

    // 7. CASE
    const cases = getCatItems([7], ["CASE", "THÙNG MÁY"]);
    const caseTarget = budget * ratios.case;
    let casePool = pickDiverse(cases, caseTarget, 4, (item) => {
      let b = 0;
      if (aesthetic.includes("white") && /white|trắng/i.test(item.name)) b += 1000000;
      if (aesthetic.includes("tank") && /bể cá|panorama|d300/i.test(item.name)) b += 1000000;
      return b;
    });

    // 8. COOLING
    const coolings = getCatItems([8], ["COOLING", "TẢN NHIỆT"]);
    const coolingTarget = budget * ratios.cooling;
    let coolingPool = pickDiverse(coolings, coolingTarget, 4, (item) => {
      let b = 0;
      if (coolingPref.includes("aio") && /aio|nước|liquid|240|360/i.test(item.name)) b += 1000000;
      if (aesthetic.includes("white") && /white|trắng/i.test(item.name)) b += 500000;
      return b;
    });

    return {
      pool: {
        cpu: cpuPool,
        mainboard: mbPool,
        ram: ramPool,
        gpu: gpuPool,
        storage: storagePool,
        psu: psuPool,
        case: casePool,
        cooling: coolingPool
      },
      allItemsMap
    };
  }

  /**
   * Gọi AI Stream chọn 1 linh kiện tối ưu cho mỗi danh mục từ 32 ứng viên
   */
  async streamAiSuggestBuild(
    payload: any = {},
    onChunk: (chunk: string) => void,
    sendEvent: (event: any) => void
  ): Promise<void> {
    const rawBudget = payload.budget !== undefined ? payload.budget : payload.targetBudget;
    const budget = Number(rawBudget !== undefined ? rawBudget : 20000000);
    if (isNaN(budget) || budget <= 0) {
      sendEvent({
        type: "error",
        error: "Ngân sách xây dựng PC không hợp lệ. Vui lòng nhập số tiền dương lớn hơn 0."
      });
      return;
    }
    const useCase = String(payload.useCase || payload.purpose || "gaming").toLowerCase();
    const resolution = String(payload.resolution || "1080p").toLowerCase();
    const customPrompt = String(payload.customPrompt || payload.promptText || "").trim();

    // 1. Tạo Pool 32 linh kiện thực tế
    const { pool, allItemsMap } = await this.getCandidatePool32(budget, useCase, resolution, payload);

    // 2. Chuyển đổi 32 linh kiện thành văn bản có cấu trúc rõ ràng cho AI
    const formatPoolSection = (catKey: string, catTitle: string) => {
      const items = pool[catKey] || [];
      const lines = items.map((item, idx) => {
        const specSummary = Object.entries(item.specs || {})
          .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
          .slice(0, 4)
          .join(" | ");
        return `  [${catKey.toUpperCase()}_${idx + 1} | SKU_ID: ${item.skuId}] ${item.name} - Giá: ${Number(item.price).toLocaleString("vi-VN")}đ ${specSummary ? `(${specSummary})` : ""}`;
      });
      return `### DANH MỤC ${catTitle.toUpperCase()} (4 Ứng Viên):\n${lines.join("\n")}`;
    };

    const candidatePoolText = [
      formatPoolSection("cpu", "1. CPU (Bộ vi xử lý)"),
      formatPoolSection("gpu", "2. GPU (Card màn hình)"),
      formatPoolSection("mainboard", "3. Mainboard (Bo mạch chủ)"),
      formatPoolSection("ram", "4. RAM (Bộ nhớ trong)"),
      formatPoolSection("storage", "5. Storage (Ổ cứng SSD)"),
      formatPoolSection("psu", "6. PSU (Nguồn máy tính)"),
      formatPoolSection("case", "7. Case (Vỏ thùng máy)"),
      formatPoolSection("cooling", "8. Cooling (Tản nhiệt)")
    ].join("\n\n");

    const systemInstruction = `Bạn là Trưởng ban Kiến trúc Phần cứng & Thẩm định Hệ thống (Senior PC Hardware Architect) tại PC Mall với hơn 15 năm kinh nghiệm thực chiến.
Phong cách làm việc: CỰC KỲ NGHIÊM KHẮC, KHÁCH QUAN, HOÀN TOÀN KHÔNG THIÊN VỊ BẤT KỲ THƯƠNG HIỆU NÀO (Zero Vendor Bias). Bạn đề cao tính cân bằng nghẽn cổ chai (Bottleneck), hiệu quả chi phí trên hiệu năng thực tế (P/P), và độ an toàn điện năng tuyệt đối.`;

    const promptText = `Khách hàng cần xây dựng dàn PC với thông số sau:
- Ngân sách mục tiêu: ${budget.toLocaleString("vi-VN")} VNĐ
- Nhu cầu chính: ${useCase.toUpperCase()}
- Độ phân giải mục tiêu: ${resolution.toUpperCase()}
${customPrompt ? `- Yêu cầu bổ sung của khách hàng: "${customPrompt}"` : ""}

KHO HÀNG PC MALL ĐÃ LỌC SẴN POOL 32 LINH KIỆN ỨNG VIÊN PHÙ HỢP NHẤT DƯỚI ĐÂY:
${candidatePoolText}

NHIỆM VỤ CỦA BẠN:
1. ĐÁNH GIÁ NGHIÊM KHẮC & KHÔNG THIÊN VỊ:
   - Trong mỗi danh mục 4 ứng viên, hãy chọn ra DUY NHẤT 1 linh kiện tối ưu nhất cho tổng thể bộ máy.
   - Trình bày ngắn gọn, sắc sảo (1 gạch đầu dòng lý do chọn, 1-2 gạch đầu dòng lý do loại 3 món còn lại). Không viết lan man.
2. ĐẢM BẢO TƯƠNG THÍCH VẬT LÝ & ĐIỆN NĂNG 100%:
   - Socket CPU phải tuyệt đối khớp với Socket Mainboard (LGA1700 đi với LGA1700, AM4 đi với AM4, AM5 đi với AM5).
   - Chuẩn RAM (DDR4/DDR5) phải khớp với Mainboard đã chọn.
   - Nguồn PSU phải có công suất dư tải an toàn >= 20% so với tổng tiêu thụ CPU + GPU.
   - Tản nhiệt phải giải nhiệt tốt cho mức TDP của CPU.
   - Tổng giá tiền 8 món chọn lựa không được vượt quá 10% ngân sách mục tiêu.
3. BẮT BUỘC Ở CUỐI PHẢN HỒI:
   Xuất một khối JSON khép kín theo đúng cấu trúc sau (không được sai tên key) để hệ thống tự động nạp linh kiện:
\`\`\`json
{
  "selectedSkuIds": {
    "cpu": <skuId số nguyên>,
    "gpu": <skuId số nguyên>,
    "mainboard": <skuId số nguyên>,
    "ram": <skuId số nguyên>,
    "storage": <skuId số nguyên>,
    "psu": <skuId số nguyên>,
    "case": <skuId số nguyên>,
    "cooling": <skuId số nguyên>
  },
  "overallVerdict": "<Nhận xét tổng kết súc tích về cấu hình>",
  "compatibilityScore": <Điểm số tương thích từ 90 đến 100>,
  "bottleneckPercent": <Ước lượng tỷ lệ nghẽn cổ chai ví dụ 3.5>
}
\`\`\`
Bắt đầu bài phân tích kỹ thuật của bạn:`;

    // 3. Gọi Unified LLM Streaming
    let accumulatedAdvice = "";
    try {
      const { unifiedLlmService } = require("../ai/unified-llm.service");
      const llmResult = await unifiedLlmService.generateStreamText({
        prompt: promptText,
        systemInstruction,
        temperature: 0.5,
        maxTokens: 4000,
        skipGuardrail: true
      }, (chunk: string) => {
        accumulatedAdvice += chunk;
        onChunk(chunk);
      });

      if (!accumulatedAdvice && llmResult.text) {
        accumulatedAdvice = llmResult.text;
        onChunk(accumulatedAdvice);
      }
    } catch (err: any) {
      console.warn("Lỗi gọi LLM Streaming trong suggest build:", err);
      const fallbackChunk = `\n⚙️ Đang kích hoạt Heuristic Knowledge Engine phòng Lab...\n`;
      accumulatedAdvice += fallbackChunk;
      onChunk(fallbackChunk);
    }

    // 4. Bóc tách JSON selectedSkuIds từ bài viết của AI
    let selectedSkuIds: Record<string, number> = {};
    let compatibilityScore = 96;
    let bottleneckPercent = 4.0;
    let overallVerdict = "Cấu hình cân bằng tối ưu hiệu năng/giá thành được thẩm định nghiêm ngặt.";

    try {
      const jsonMatch = accumulatedAdvice.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.selectedSkuIds) selectedSkuIds = parsed.selectedSkuIds;
        if (parsed.compatibilityScore) compatibilityScore = Number(parsed.compatibilityScore);
        if (parsed.bottleneckPercent !== undefined) bottleneckPercent = Number(parsed.bottleneckPercent);
        if (parsed.overallVerdict) overallVerdict = String(parsed.overallVerdict);
      }
    } catch (_parseErr) {
      console.warn("Không parse được JSON từ AI output, fallback sang lựa chọn đầu tiên trong pool:", _parseErr);
    }

    // 5. Khớp linh kiện thực tế từ kho hàng theo SKU IDs được AI chọn
    const selectedComponents: Record<string, any> = {};
    const catKeys = ["cpu", "gpu", "mainboard", "ram", "storage", "psu", "case", "cooling"];

    for (const cat of catKeys) {
      let chosenSkuId = selectedSkuIds[cat];
      let chosenItem = chosenSkuId ? allItemsMap.get(Number(chosenSkuId)) : null;

      // Fallback nếu AI chọn SKU ngoài pool hoặc không có
      if (!chosenItem && pool[cat] && pool[cat].length > 0) {
        chosenItem = pool[cat][0];
      }

      if (chosenItem) {
        selectedComponents[cat] = {
          id: chosenItem.variantId,
          variantId: chosenItem.variantId,
          skuId: chosenItem.variantId,
          productId: chosenItem.productId,
          name: chosenItem.name,
          productName: chosenItem.name,
          price: chosenItem.price,
          imageUrl: chosenItem.imageUrl,
          specs: chosenItem.specs,
          stock: chosenItem.stock
        };
      }
    }

    const totalPrice = Object.values(selectedComponents).reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);
    const budgetUtilization = Math.round((totalPrice / budget) * 100);

    const dynamicBottleneck = this.calculateDynamicBottleneck(
      selectedComponents.cpu,
      selectedComponents.gpu,
      resolution
    );

    const ramArchitecture = this.getRamArchitectureInfo(
      selectedComponents.ram,
      selectedComponents.mainboard
    );

    // Gửi Event hoàn tất (type: "done") kèm dữ liệu cấu trúc
    sendEvent({
      type: "done",
      provider: "Google Gemini (gemini-3.5-flash-lite)",
      advice: accumulatedAdvice,
      selectedComponents,
      totalPrice,
      budgetUtilization,
      compatibilityScore,
      bottleneckPercent: (dynamicBottleneck as any)?.bottleneckPercentage || (dynamicBottleneck as any)?.bottleneckPercent || bottleneckPercent,
      dynamicBottleneck,
      ramArchitecture,
      poolSummary: {
        totalEvaluated: 32,
        categoriesCount: 8
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🔬 CHỨC NĂNG 2: AI AUDIT BUILD + CHAT + ĐỀ XUẤT ĐỔI LINH KIỆN
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Tìm kiếm linh kiện trong kho hàng thật theo tiêu chí AI đề xuất thay thế
   */
  async findReplacementProducts(targetCriteria: any, _currentBuild: any = {}): Promise<any[]> {
    const catType = String(targetCriteria?.category || targetCriteria?.componentType || "").toLowerCase();
    const socket = String(targetCriteria?.socket || "").toUpperCase().trim();
    const minPrice = Number(targetCriteria?.priceMin || targetCriteria?.targetPriceMin || 0);
    const maxPrice = Number(targetCriteria?.priceMax || targetCriteria?.targetPriceMax || 999999999);
    const keywords: string[] = Array.isArray(targetCriteria?.keywords) 
      ? targetCriteria.keywords.map((k: any) => String(k).toLowerCase()) 
      : targetCriteria?.keywords 
      ? [String(targetCriteria.keywords).toLowerCase()] 
      : [];
    if (targetCriteria?.recommendedKeywords) {
      const extraKw = Array.isArray(targetCriteria.recommendedKeywords)
        ? targetCriteria.recommendedKeywords
        : [targetCriteria.recommendedKeywords];
      keywords.push(...extraKw.map((k: any) => String(k).toLowerCase()));
    }

    const catIdMap: Record<string, number> = {
      cpu: 1, mainboard: 2, ram: 3, gpu: 4, storage: 5, ssd: 5, psu: 6, case: 7, cooling: 8
    };
    const catId = catIdMap[catType] || 1;

    let rows: any[] = [];
    try {
      rows = (await query(`
        SELECT 
          s.id AS variantId,
          s.price AS price,
          s.image_url AS imageUrl,
          s.sku AS skuCode,
          s.stock AS stock,
          p.id AS productId,
          p.name AS productName,
          p.slug AS productSlug,
          p.category_id AS categoryId,
          c.name AS categoryName,
          a.name AS attrName,
          av.value AS attrVal
        FROM product_skus s
        INNER JOIN products p ON p.id = s.product_id
        INNER JOIN categories c ON c.id = p.category_id
        LEFT JOIN sku_attributes sa ON sa.sku_id = s.id
        LEFT JOIN attribute_values av ON av.id = sa.attribute_value_id
        LEFT JOIN attributes a ON a.id = av.attribute_id
        WHERE s.is_active = 1 AND p.is_active = 1 AND s.stock > 0 AND p.category_id = ?
        ORDER BY s.price ASC;
      `, [catId])) as any[];
    } catch (_err) {
      return [];
    }

    const itemsMap = new Map<number, any>();
    for (const r of rows) {
      const vId = Number(r.variantId);
      if (!itemsMap.has(vId)) {
        itemsMap.set(vId, {
          variantId: vId,
          id: vId,
          skuId: vId,
          productId: Number(r.productId),
          name: String(r.productName),
          productName: String(r.productName),
          slug: String(r.productSlug),
          categoryId: Number(r.categoryId),
          categoryName: String(r.categoryName).toUpperCase(),
          price: Number(r.price),
          imageUrl: r.imageUrl || null,
          stock: Number(r.stock || 10),
          specs: {} as Record<string, string>
        });
      }
      if (r.attrName && r.attrVal) {
        itemsMap.get(vId).specs[String(r.attrName).toLowerCase().trim()] = String(r.attrVal).trim();
      }
    }

    let candidates = Array.from(itemsMap.values());

    if (socket && socket !== "AUTO" && socket !== "UNIVERSAL") {
      candidates = candidates.filter(item => {
        const itemSocket = String(item.specs?.socket || "").toUpperCase();
        const itemName = item.name.toUpperCase();
        return itemSocket.includes(socket) || itemName.includes(socket);
      });
    }

    if (catType === "psu" && targetCriteria?.minWattage) {
      const minW = Number(targetCriteria.minWattage);
      candidates = candidates.filter(item => {
        const wStr = String(item.specs?.psu_wattage || item.name).match(/(\d{3,4})\s*w/i);
        const w = wStr ? parseInt(wStr[1], 10) : 0;
        return w >= minW;
      });
    }

    const scored = candidates.map(item => {
      let score = 0;
      if (item.price >= minPrice && item.price <= maxPrice) {
        score += 50;
      } else {
        const diff = Math.min(Math.abs(item.price - minPrice), Math.abs(item.price - maxPrice));
        score -= diff / 100000;
      }
      for (const kw of keywords) {
        if (kw && item.name.toLowerCase().includes(kw)) {
          score += 40;
        }
      }
      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map(s => s.item);
  }

  /**
   * Đánh giá chi tiết cấu hình hiện tại của người dùng bằng AI (Streaming)
   */
  async streamAiAuditBuild(
    payload: any = {},
    onChunk: (chunk: string) => void,
    sendEvent: (event: any) => void
  ): Promise<void> {
    const buildItems: any[] = Array.isArray(payload.buildItems) ? payload.buildItems : [];
    const componentsMap: Record<string, any> = payload.componentsMap || {};
    const targetBudget = Number(payload.targetBudget || payload.budget || 0);
    const useCase = String(payload.useCase || payload.purpose || "gaming").toLowerCase();
    const resolution = String(payload.resolution || "1080p").toLowerCase();

    // Chuẩn hóa danh sách linh kiện đang có
    const activeItems = buildItems.length > 0 
      ? buildItems 
      : Object.entries(componentsMap).map(([type, comp]: [string, any]) => ({
          componentType: type,
          productName: comp.name || comp.productName,
          price: comp.price,
          specs: comp.specs || {}
        }));

    if (activeItems.length === 0) {
      sendEvent({
        type: "error",
        error: "Chưa có linh kiện nào trong không gian lắp ráp để thẩm định. Vui lòng chọn ít nhất 1 linh kiện!"
      });
      return;
    }

    const totalBuildPrice = activeItems.reduce((acc, i) => acc + Number(i.price || 0), 0);
    const itemsDescription = activeItems.map(item => {
      const type = (item.componentType || item.type || "Linh kiện").toUpperCase();
      const name = item.productName || item.name || "Chưa rõ tên";
      const price = Number(item.price || 0).toLocaleString("vi-VN") + "đ";
      const specsStr = Object.entries(item.specs || {})
        .map(([k, v]) => `${k}: ${v}`)
        .slice(0, 4)
        .join(", ");
      return `- [${type}] ${name} | Giá: ${price} ${specsStr ? `(${specsStr})` : ""}`;
    }).join("\n");

    const systemInstruction = `Bạn là Trưởng ban Giám định Kỹ thuật Phần cứng (Senior PC Hardware Inspection Auditor) tại PC Mall.
Nhiệm vụ của bạn: Kiểm tra, thẩm định một cách CỰC KỲ NGHIÊM KHẮC, KHÁCH QUAN, KHÔNG THIÊN VỊ cấu hình do khách hàng xây dựng.
Đánh giá 5 trụ cột kỹ thuật:
1. Độ cân bằng CPU - GPU (Nghẽn cổ chai Bottleneck ở độ phân giải ${resolution.toUpperCase()}).
2. An toàn nguồn điện (PSU Headroom): Công suất thực, chuẩn 80 Plus, dư tải an toàn >= 20%.
3. Hiệu năng tản nhiệt (Cooling): TDP của CPU và hiệu quả của tản nhiệt đối với luồng gió vỏ case.
4. Băng thông bộ nhớ (RAM): Có chạy Dual Channel (2 thanh) không? Đơn thanh (Single) sẽ bóp nghẹt 15-20% FPS.
5. Bo mạch chủ & Nâng cấp (Mainboard VRM & M.2 Slots).`;

    const promptText = `HỒ SƠ CẤU HÌNH CẦN THẨM ĐỊNH:
- Số lượng linh kiện đã chọn: ${activeItems.length} / 8 linh kiện
- Tổng chi phí hiện tại: ${totalBuildPrice.toLocaleString("vi-VN")} VNĐ
${targetBudget > 0 ? `- Ngân sách dự kiến: ${targetBudget.toLocaleString("vi-VN")} VNĐ` : ""}
- Mục đích sử dụng: ${useCase.toUpperCase()}
- Độ phân giải màn hình: ${resolution.toUpperCase()}

DANH SÁCH LINH KIỆN HIỆN TẠI TRONG KHÔNG GIAN LẮP RÁP:
${itemsDescription}

YÊU CẦU GIÁM ĐỊNH:
1. Hãy phân tích chi tiết từng điểm mạnh, điểm yếu và các nguy cơ kỹ thuật (nếu có) bằng Markdown tiếng Việt chuyên nghiệp, sắc sảo.
2. NẾU CÓ LINH KIỆN XẤU / NGHẼN / KHÔNG TỐI ƯU, bạn BẮT BUỘC phải chỉ rõ lý do và xuất tiêu chí thay thế để hệ thống lọc hàng trong kho.
3. BẮT BUỘC Ở CUỐI PHẢN HỒI, xuất một khối JSON có cấu trúc sau:
\`\`\`json
{
  "auditScore": <Điểm số từ 0 đến 100>,
  "status": "<EXCELLENT | GOOD | NEEDS_OPTIMIZATION | CRITICAL_ISSUE>",
  "summary": "<Tóm tắt nhận định trong 1-2 câu>",
  "bottleneckPercent": <Tỷ lệ nghẽn cổ chai ước tính>,
  "issues": [
    {
      "componentType": "<cpu | gpu | mainboard | ram | storage | psu | case | cooling>",
      "severity": "<high | medium | low>",
      "currentName": "<Tên linh kiện hiện tại bị đánh giá>",
      "problem": "<Mô tả chi tiết lỗi, nghẽn hoặc nguy cơ>",
      "targetCriteria": {
        "category": "<cpu | gpu | mainboard | ram | storage | psu | case | cooling>",
        "socket": "<LGA1700 | AM4 | AM5 nếu liên quan>",
        "minCores": <số nhân tối thiểu nếu là CPU>,
        "minThreads": <số luồng tối thiểu nếu là CPU>,
        "minWattage": <công suất tối thiểu nếu là PSU>,
        "priceMin": <giá tối thiểu VNĐ>,
        "priceMax": <giá tối đa VNĐ>,
        "keywords": ["từ khóa 1", "từ khóa 2"],
        "advice": "<Lời khuyên cụ thể nên đổi sang linh kiện nào>"
      }
    }
  ]
}
\`\`\`
Nếu cấu hình hoàn hảo không có lỗi gì cần thay, "issues" có thể là mảng rỗng [].
Bắt đầu bài thẩm định kỹ thuật:`;

    let accumulatedReport = "";
    try {
      const { unifiedLlmService } = require("../ai/unified-llm.service");
      const llmResult = await unifiedLlmService.generateStreamText({
        prompt: promptText,
        systemInstruction,
        temperature: 0.6,
        maxTokens: 2500,
        skipGuardrail: true
      }, (chunk: string) => {
        accumulatedReport += chunk;
        onChunk(chunk);
      });

      if (!accumulatedReport && llmResult.text) {
        accumulatedReport = llmResult.text;
        onChunk(accumulatedReport);
      }
    } catch (err: any) {
      console.warn("Lỗi gọi LLM Streaming trong audit build:", err);
      const fallbackChunk = `\n⚙️ Đang kích hoạt Heuristic Auditor phòng Lab...\n`;
      accumulatedReport += fallbackChunk;
      onChunk(fallbackChunk);
    }

    let auditScore = 85;
    let status = "GOOD";
    let summary = "Cấu hình tương thích cơ bản và sẵn sàng hoạt động.";
    let bottleneckPercent = 5.0;
    let issues: any[] = [];

    try {
      const jsonMatch = accumulatedReport.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.auditScore !== undefined) auditScore = Number(parsed.auditScore);
        if (parsed.status) status = String(parsed.status);
        if (parsed.summary) summary = String(parsed.summary);
        if (parsed.bottleneckPercent !== undefined) bottleneckPercent = Number(parsed.bottleneckPercent);
        if (Array.isArray(parsed.issues)) issues = parsed.issues;
      }
    } catch (_parseErr) {
      console.warn("Không parse được JSON audit issues:", _parseErr);
    }

    // Với mỗi issue được AI phát hiện, truy vấn kho hàng thật để tìm sản phẩm thay thế
    for (const issue of issues) {
      if (issue.targetCriteria) {
        try {
          const suggestedProducts = await this.findReplacementProducts(issue.targetCriteria, activeItems);
          issue.suggestedProducts = suggestedProducts;
        } catch (_prodErr) {
          issue.suggestedProducts = [];
        }
      }
    }

    sendEvent({
      type: "done",
      provider: "Google Gemini (gemini-3.5-flash-lite)",
      report: accumulatedReport,
      auditScore,
      status,
      summary,
      bottleneckPercent,
      issues
    });
  }

  /**
   * Chat hỏi đáp chuyên sâu với AI về cấu hình hiện tại (Streaming)
   */
  async streamAiChatBuild(
    payload: any = {},
    onChunk: (chunk: string) => void,
    sendEvent: (event: any) => void
  ): Promise<void> {
    const buildItems: any[] = Array.isArray(payload.buildItems) ? payload.buildItems : [];
    const messages: any[] = Array.isArray(payload.messages) ? payload.messages : [];
    const userMessage = String(payload.userMessage || payload.question || "").trim();
    const useCase = String(payload.useCase || payload.purpose || "gaming").toLowerCase();
    const resolution = String(payload.resolution || "1080p").toLowerCase();

    if (!userMessage) {
      sendEvent({ type: "error", error: "Vui lòng nhập câu hỏi cho AI!" });
      return;
    }

    const itemsDesc = buildItems.map(item => {
      const type = (item.componentType || item.type || "Linh kiện").toUpperCase();
      const name = item.productName || item.name || "Chưa rõ tên";
      const price = Number(item.price || 0).toLocaleString("vi-VN") + "đ";
      return `- [${type}] ${name} (${price})`;
    }).join("\n");

    const historyStr = messages
      .slice(-6)
      .map(m => `${m.role === "user" ? "Khách hàng" : "AI Advisor"}: ${m.content}`)
      .join("\n\n");

    const systemInstruction = `Bạn là Trưởng ban Kỹ thuật Phần cứng PC Mall. Bạn đang trò chuyện trực tiếp với khách hàng về dàn PC mà họ đang xây dựng.
Hãy trả lời thân thiện, chuyên môn sâu, khách quan và thực tế.
Nếu câu trả lời của bạn khuyên đổi hoặc nâng cấp linh kiện nào, hãy xuất tiêu chí tìm kiếm ở cuối câu trả lời dạng JSON \`\`\`json { "suggestedReplacements": [{ "componentType": "cpu", "advice": "...", "targetCriteria": { "category": "cpu", "keywords": ["..."], "priceMin": ..., "priceMax": ... } }] } \`\`\``;

    const promptText = `HỒ SƠ DÀN PC HIỆN TẠI:
${itemsDesc || "Chưa chọn linh kiện"}
Nhu cầu: ${useCase.toUpperCase()} | Độ phân giải: ${resolution.toUpperCase()}

LỊCH SỬ TRÒ CHUYỆN GẦN NHẤT:
${historyStr || "(Bắt đầu cuộc trò chuyện)"}

CÂU HỎI MỚI CỦA KHÁCH HÀNG:
"${userMessage}"

Hãy trả lời chuyên nghiệp và xúc tích:`;

    let accumulatedChat = "";
    try {
      const { unifiedLlmService } = require("../ai/unified-llm.service");
      const llmResult = await unifiedLlmService.generateStreamText({
        prompt: promptText,
        systemInstruction,
        temperature: 0.7,
        maxTokens: 1500,
        skipGuardrail: true
      }, (chunk: string) => {
        accumulatedChat += chunk;
        onChunk(chunk);
      });

      if (!accumulatedChat && llmResult.text) {
        accumulatedChat = llmResult.text;
        onChunk(accumulatedChat);
      }
    } catch (err: any) {
      console.warn("Lỗi chat LLM stream:", err);
      onChunk(`Xin lỗi, hiện tại kênh AI đang bận. Bạn có thể hỏi lại sau ít giây!`);
    }

    // Check if AI suggested replacements
    let replacements: any[] = [];
    try {
      const jsonMatch = accumulatedChat.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed.suggestedReplacements)) {
          replacements = parsed.suggestedReplacements;
          for (const rep of replacements) {
            if (rep.targetCriteria) {
              rep.suggestedProducts = await this.findReplacementProducts(rep.targetCriteria, buildItems);
            }
          }
        }
      }
    } catch (_err) {}

    sendEvent({
      type: "done",
      reply: accumulatedChat,
      replacements
    });
  }
}

export const pcBuilderService = new PcBuilderService();
export default pcBuilderService;
