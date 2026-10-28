import crypto from "crypto";
import { query } from "../../config/database";
import { prisma } from "../../config/prisma";
import { createError, toPositiveInteger } from "../../utils/service-helpers";
import { aiOrchestratorService } from "../ai/ai-orchestrator.service";
import {
  toMoney,
  getCpuSocket,
  getCpuTdp,
  getMainboardSocket,
  getMainboardRamType,
  getRamType,
  getGpuTdp,
  getPsuWattage,
  normalizeAttributeKey,
} from "./heuristic-specs.parser";
import {
  generateComponentExplanation,
  estimateFpsFromGpuName,
  generateRuleBasedAdvice,
} from "./power-rule.evaluator";
import {
  DatabaseCompatibilityRule,
  DetailedComponent,
  COMPONENT_DEFAULT_CAT_IDS,
  evaluateCompatibility,
} from "./compatibility-rule.evaluator";

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

export { DatabaseCompatibilityRule } from "./compatibility-rule.evaluator";

class PcBuilderService {
  private rulesCache: { rules: DatabaseCompatibilityRule[]; timestamp: number } | null = null;
  private readonly RULES_CACHE_TTL_MS = 30000;

  public invalidateRulesCache(): void {
    this.rulesCache = null;
  }

  public async getActiveCompatibilityRules(): Promise<DatabaseCompatibilityRule[]> {
    const now = Date.now();
    if (this.rulesCache && (now - this.rulesCache.timestamp) < this.RULES_CACHE_TTL_MS) {
      return this.rulesCache.rules;
    }

    try {
      const rows = (await query(`
        SELECT
          cr.id,
          cr.name,
          cr.description,
          cr.source_category_id AS sourceCategoryId,
          cr.target_category_id AS targetCategoryId,
          cr.source_attribute_key AS sourceAttributeKey,
          cr.target_attribute_key AS targetAttributeKey,
          cr.operator,
          cr.is_compatible AS isCompatible,
          cr.attribute_value_1 AS attributeValue1,
          cr.attribute_value_2 AS attributeValue2,
          sc.name AS sourceCategoryName,
          tc.name AS targetCategoryName
        FROM compatibility_rules cr
        LEFT JOIN categories sc ON sc.id = cr.source_category_id
        LEFT JOIN categories tc ON tc.id = cr.target_category_id
        WHERE (cr.is_active = 1 OR cr.status = 'ACTIVE')
        ORDER BY cr.id ASC
      `)) as any[];

      const rules: DatabaseCompatibilityRule[] = (rows || []).map((row) => ({
        id: Number(row.id),
        name: String(row.name || row.description || `Rule #${row.id}`),
        description: row.description ? String(row.description) : null,
        sourceCategoryId: row.sourceCategoryId ? Number(row.sourceCategoryId) : null,
        targetCategoryId: row.targetCategoryId ? Number(row.targetCategoryId) : null,
        sourceAttributeKey: row.sourceAttributeKey ? String(row.sourceAttributeKey).trim().toLowerCase() : null,
        targetAttributeKey: row.targetAttributeKey ? String(row.targetAttributeKey).trim().toLowerCase() : null,
        operator: String(row.operator || "EQ").trim().toUpperCase(),
        isCompatible: row.isCompatible === null ? true : Number(row.isCompatible) === 1,
        attributeValue1: row.attributeValue1 ? Number(row.attributeValue1) : null,
        attributeValue2: row.attributeValue2 ? Number(row.attributeValue2) : null,
        sourceCategoryName: row.sourceCategoryName ? String(row.sourceCategoryName).toUpperCase() : undefined,
        targetCategoryName: row.targetCategoryName ? String(row.targetCategoryName).toUpperCase() : undefined,
      }));

      this.rulesCache = { rules, timestamp: now };
      return rules;
    } catch (err) {
      console.error("[PcBuilderService] Failed to load compatibility rules from DB:", err);
      return [];
    }
  }

  async findBuildById(userId: number, buildId: number, _connection: any = null): Promise<any> {
    const build = await prisma.pcBuild.findFirst({
      where: { id: buildId, user_id: userId },
      select: { id: true, user_id: true, name: true, created_at: true },
    });
    if (!build) return null;
    return {
      id: build.id,
      userId: build.user_id,
      name: build.name,
      createdAt: build.created_at,
    };
  }

  async getBuildItems(buildId: number): Promise<BuildItem[]> {
    const rows = await query(
      `
      SELECT 
        i.id AS itemId,
        i.component_type AS componentType,
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
        itemMap.set(row.itemId, {
          id: row.itemId,
          componentType: row.componentType,
          quantity: 1,
          unitPrice: Number(row.price || 0),
          lineTotal: toMoney(row.price || 0),
          product: {
            id: row.productId,
            name: row.productName,
            slug: String(row.productSlug || row.productId),
            attributes: [],
          },
          variant: {
            id: row.skuId,
            sku: row.skuCode || `SKU-${row.skuId}`,
            price: Number(row.price || 0),
            stock: Number(row.stock || 0),
            imageUrl: row.imageUrl || null,
            specs: [],
          },
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
    const totalPrice = toMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
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
      components,
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
    const result = await prisma.pcBuild.create({
      data: {
        user_id: userId,
        name,
      },
    });
    return this.getBuildDetail(userId, result.id);
  }

  async getCurrentBuild(userId: number): Promise<Build | null> {
    const build = await prisma.pcBuild.findFirst({
      where: { user_id: userId },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: { id: true, user_id: true, name: true, created_at: true },
    });
    if (!build) return null;
    const items = await this.getBuildItems(build.id);
    return this.formatBuild(
      {
        id: build.id,
        userId: build.user_id,
        name: build.name,
        createdAt: build.created_at,
      },
      items
    );
  }

  async upsertBuildItem(userId: number, buildId: any, payload: any): Promise<Build> {
    const parsedBuildId = toPositiveInteger(buildId, "buildId");
    const skuId = toPositiveInteger(payload.productVariantId, "productVariantId");
    const componentType = String(payload.componentType || "").trim().toLowerCase();

    if (!componentType) throw createError("componentType is required", 400);

    const build = await this.findBuildById(userId, parsedBuildId);
    if (!build) throw createError("PC build not found", 404);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.pcBuildItem.findFirst({
        where: { build_id: parsedBuildId, component_type: componentType },
      });

      if (existing) {
        await tx.pcBuildItem.update({
          where: { id: existing.id },
          data: { sku_id: skuId },
        });
      } else {
        await tx.pcBuildItem.create({
          data: {
            build_id: parsedBuildId,
            sku_id: skuId,
            component_type: componentType,
          },
        });
      }
    });

    return this.getBuildDetail(userId, parsedBuildId);
  }

  async removeBuildItem(userId: number, buildId: any, componentType: string): Promise<Build> {
    const parsedBuildId = toPositiveInteger(buildId, "buildId");
    const type = String(componentType || "").trim().toLowerCase();
    const build = await this.findBuildById(userId, parsedBuildId);
    if (!build) throw createError("PC build not found", 404);

    await prisma.pcBuildItem.deleteMany({
      where: { build_id: parsedBuildId, component_type: type },
    });
    return this.getBuildDetail(userId, parsedBuildId);
  }

  async saveBuild(userId: number, buildId: any, payload: any = {}): Promise<Build> {
    const parsedId = toPositiveInteger(buildId, "buildId");
    const build = await this.findBuildById(userId, parsedId);
    if (!build) throw createError("PC build not found", 404);

    const name = String(payload.name || build.name || "My PC Build").trim() || "My PC Build";
    await prisma.pcBuild.update({
      where: { id: parsedId },
      data: { name },
    });
    return this.getBuildDetail(userId, parsedId);
  }

  async getMyBuilds(userId: number): Promise<any[]> {
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
        budget: Number(row.budget || 0),
      });
    }

    return buildsWithDetail;
  }

  async publishBuild(userId: number, buildId: any): Promise<any> {
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
      shareUrl: `/pc-builder/shared/${shareToken}`,
    };
  }

  async getSharedBuild(shareToken: string): Promise<any> {
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
        variantId: item.variant.id,
      })),
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
      xaiReport,
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
        componentType: item.componentType,
      });
    }

    return this.getBuildDetail(userId, newBuild.id);
  }

  /**
   * Helper to query a single candidate build based on allocation ratios and multiplier
   */
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
          specs: {} as Record<string, string>,
        });
      }
      if (r.attrName && r.attrVal) {
        const item = skuMap.get(vId);
        item.specs[String(r.attrName).toLowerCase().trim()] = String(r.attrVal).trim();
      }
    }

    const allItems = Array.from(skuMap.values());

    const getPool = (catIds: number[], catNames: string[]) => {
      return allItems.filter(
        (item) =>
          catIds.includes(item.categoryId) ||
          catNames.some(
            (cn) => item.categoryName.includes(cn) || item.name.toUpperCase().includes(cn)
          )
      );
    };

    const cpuPool = getPool([1], ["CPU"]);
    const mbPool = getPool([2], ["MAINBOARD", "BO MẠCH"]);
    const ramPool = getPool([3], ["RAM", "BỘ NHỚ"]);
    const gpuPool = getPool([4, 9], ["GPU", "VGA", "CARD"]);
    const ssdPool = getPool([5, 10], ["STORAGE", "SSD", "Ổ CỨNG"]);
    const psuPool = getPool([6], ["PSU", "NGUỒN"]);
    const casePool = getPool([7], ["CASE", "VỎ"]);
    const coolingPool = getPool([8], ["COOLING", "TẢN NHIỆT"]);

    const pickBest = (
      pool: any[],
      maxSubBudget: number,
      filterFn?: (item: any) => boolean
    ): any => {
      if (!pool || pool.length === 0) return null;
      const filtered = filterFn ? pool.filter(filterFn) : pool;
      const candidates = filtered.length > 0 ? filtered : pool;

      if (options.colorScheme === "white") {
        const whiteCandidates = candidates.filter((i) => {
          const colorSpec = String(i.specs?.["màu sắc"] || i.specs?.["color"] || "").toLowerCase();
          if (colorSpec.includes("trắng") || colorSpec.includes("white")) return true;
          const nameLower = String(i.name || "").toLowerCase();
          return nameLower.includes("white") || nameLower.includes("trắng") || nameLower.includes("snow");
        });
        if (whiteCandidates.length > 0) {
          const inWhiteBudget = whiteCandidates.filter((i) => i.price <= maxSubBudget);
          if (inWhiteBudget.length > 0) {
            return inWhiteBudget.sort((a, b) => b.price - a.price)[0];
          }
          return [...whiteCandidates].sort((a, b) => a.price - b.price)[0];
        }
      }

      const inBudget = candidates.filter((i) => i.price <= maxSubBudget);
      if (inBudget.length > 0) {
        return inBudget.sort((a, b) => b.price - a.price)[0];
      }
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
        cpuSocket = getCpuSocket(cpuItem);
        cpuTdp = getCpuTdp(cpuItem);
      }
    }

    // 2. Pick Mainboard strictly matching CPU socket
    let mbItem: any = null;
    let mbRamType: "DDR4" | "DDR5" = "DDR4";

    if (!excluded.includes("mainboard")) {
      const mbMax = Math.round(budget * (ratios.mainboard || 0.12) * multiplier * 1.15);
      mbItem = pickBest(mbPool, mbMax, (mb) => {
        const mbSock = getMainboardSocket(mb);
        return mbSock === cpuSocket;
      });
      if (mbItem) {
        selectedComponents.mainboard = mbItem;
        mbRamType = getMainboardRamType(mbItem);
      }
    }

    // 3. Pick RAM strictly matching Mainboard RAM type
    if (!excluded.includes("ram")) {
      const ramMax = Math.round(budget * (ratios.ram || 0.10) * multiplier * 1.15);
      const ramItem = pickBest(ramPool, ramMax, (r) => {
        const rType = getRamType(r);
        return rType === mbRamType;
      });
      if (ramItem) {
        selectedComponents.ram = ramItem;
      }
    }

    // 4. Pick GPU
    const hasGpuNeed = (ratios.gpu || 0) > 0 && !excluded.includes("gpu");
    let gpuItem = null;
    let gpuTdp = 0;
    if (hasGpuNeed && gpuPool.length > 0) {
      const gpuMax = Math.round(budget * (ratios.gpu || 0.35) * multiplier * 1.15);
      gpuItem = pickBest(gpuPool, gpuMax);
      if (gpuItem) {
        selectedComponents.gpu = gpuItem;
        gpuTdp = getGpuTdp(gpuItem);
      }
    }

    // 5. Pick Storage
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
        return getPsuWattage(p) >= minWatt;
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
          const styleSpec = String(cs.specs?.["phong cách thiết kế"] || cs.specs?.["case_style"] || "").toLowerCase();
          if (styleSpec.includes("bể cá") || styleSpec.includes("panorama") || styleSpec.includes("kính")) return true;
          const nameLower = String(cs.name || "").toLowerCase();
          return nameLower.includes("bể cá") || nameLower.includes("panorama") || nameLower.includes("lv12") || nameLower.includes("aqua");
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
        const specUpper = String(c?.specs?.["socket_support"] || c?.specs?.["socket hỗ trợ"] || "").toUpperCase();
        if (specUpper) {
          return specUpper.includes(cpuSocket) || specUpper.includes("ALL") || specUpper.includes("MULTI");
        }
        return true;
      });
      if (coolingItem) {
        selectedComponents.cooling = coolingItem;
      }
    }

    for (const [type, item] of Object.entries(selectedComponents)) {
      item.explanation = generateComponentExplanation(type, item, budget, ratios[type] || 0.1, useCase);
    }

    const totalPrice = Object.values(selectedComponents).reduce((sum: number, item: any) => sum + (item.price || 0), 0);

    const compatibilityCheckPayload = {
      components: Object.entries(selectedComponents).map(([type, item]) => ({
        componentType: type,
        variantId: item.variantId,
      })),
    };

    let compatibilityReport: any = null;
    if (compatibilityCheckPayload.components.length >= 2) {
      try {
        compatibilityReport = await this.checkRawCompatibility(compatibilityCheckPayload);
      } catch (err) {
        console.warn("[PC Builder Candidate] Compatibility check warning:", (err as Error).message);
      }
    }

    return {
      totalPrice,
      budgetUtilization: `${Math.round((totalPrice / budget) * 100)}%`,
      components: selectedComponents,
      compatibilityReport,
    };
  }

  /**
   * Generates 3 Candidate Builds and What-If Simulation
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

    let ratios: Record<string, number> = {
      cpu: 0.20,
      mainboard: 0.12,
      ram: 0.08,
      gpu: 0.38,
      storage: 0.08,
      psu: 0.06,
      case: 0.04,
      cooling: 0.04,
    };

    if (useCase === "workstation" || useCase === "render" || useCase === "editing" || useCase === "ai") {
      ratios = {
        cpu: 0.32,
        mainboard: 0.14,
        ram: 0.11,
        gpu: 0.28,
        storage: 0.06,
        psu: 0.04,
        case: 0.02,
        cooling: 0.03,
      };
    } else if (useCase === "office") {
      ratios = {
        cpu: 0.38,
        mainboard: 0.20,
        ram: 0.14,
        storage: 0.12,
        psu: 0.06,
        case: 0.04,
        cooling: 0.06,
        gpu: 0.0,
      };
    }

    if (resolution === "4k") {
      if (ratios.gpu > 0) ratios.gpu += 0.10;
      ratios.cpu = Math.max(0.10, ratios.cpu - 0.05);
      ratios.ram = (ratios.ram || 0.08) + 0.05;
      ratios.mainboard = Math.max(0.08, ratios.mainboard - 0.05);
    } else if (resolution === "2k") {
      if (ratios.gpu > 0) ratios.gpu += 0.05;
      ratios.cpu = Math.max(0.12, ratios.cpu - 0.05);
    }

    if (preference === "performance") {
      if (ratios.gpu > 0) ratios.gpu *= 1.2;
      ratios.cpu *= 1.2;
    } else if (preference === "quiet") {
      ratios.cooling = 0.08;
      ratios.psu += 0.03;
      if (ratios.gpu > 0) ratios.gpu = Math.max(0.25, ratios.gpu - 0.05);
    } else if (preference === "future") {
      ratios.mainboard += 0.07;
      ratios.psu += 0.03;
      if (ratios.gpu > 0) ratios.gpu = Math.max(0.25, ratios.gpu - 0.05);
    }

    if (futureNeed === "upgrade_gpu") {
      ratios.psu += 0.05;
      ratios.mainboard += 0.03;
      if (ratios.gpu > 0) ratios.gpu = Math.max(0.25, ratios.gpu - 0.08);
    } else if (futureNeed === "upgrade_ram") {
      ratios.mainboard += 0.05;
      ratios.ram = Math.max(0.05, ratios.ram - 0.03);
    } else if (futureNeed === "upgrade_cpu") {
      ratios.mainboard += 0.06;
      ratios.cpu = Math.max(0.15, ratios.cpu - 0.04);
    }

    const totalRatioSum = Object.values(ratios).reduce((sum, val) => sum + val, 0);
    if (totalRatioSum > 0) {
      Object.keys(ratios).forEach((key) => {
        ratios[key] = Number((ratios[key] / totalRatioSum).toFixed(3));
      });
    }

    const [bestValue, bestPerformance, budgetSafe] = await Promise.all([
      this.querySingleCandidate(budget, ratios, 1.0, useCase),
      this.querySingleCandidate(budget, ratios, 1.15, useCase),
      this.querySingleCandidate(budget, ratios, 0.85, useCase),
    ]);

    const getGpuName = (build: any) => build?.components?.gpu?.name || build?.components?.gpu?.productName || "";

    const calculateFpsStats = (build: any) => {
      const gpuNameRaw = getGpuName(build).toLowerCase();
      const { aaaFps, esportsFps } = estimateFpsFromGpuName(gpuNameRaw);
      return { aaaFps, esportsFps, gpuName: getGpuName(build) };
    };

    const statsBase = calculateFpsStats(bestValue);
    const statsPlus = calculateFpsStats(bestPerformance);
    const statsMinus = calculateFpsStats(budgetSafe);

    const deltaPlusAaa = Math.max(12, statsPlus.aaaFps - statsBase.aaaFps);
    const deltaPlusEsports = Math.max(25, statsPlus.esportsFps - statsBase.esportsFps);

    const deltaMinusAaa = Math.max(8, statsBase.aaaFps - statsMinus.aaaFps);
    const deltaMinusEsports = Math.max(18, statsBase.esportsFps - statsMinus.esportsFps);

    const whatIfSimulation = {
      currentBudget: budget,
      plus5m: {
        budgetDelta: 5000000,
        newBudget: budget + 5000000,
        estimatedFpsGain: `+${deltaPlusAaa} FPS AAA (1080p/2K) / eSports +${deltaPlusEsports} FPS`,
        summary: statsPlus.gpuName
          ? `Nâng cấp GPU lên ${statsPlus.gpuName} giúp tăng +${deltaPlusAaa} FPS game AAA và xử lý đồ họa mượt hơn 30%.`
          : "Nâng cấp GPU hoặc CPU cao cấp hơn 1 bậc, tăng đáng kể FPS trong các tựa game nặng.",
      },
      minus5m: {
        budgetDelta: -5000000,
        newBudget: Math.max(8000000, budget - 5000000),
        estimatedFpsLoss: `-${deltaMinusAaa} FPS AAA / eSports -${deltaMinusEsports} FPS`,
        summary: statsMinus.gpuName
          ? `Tiết kiệm 5 triệu đồng bằng cách dùng GPU ${statsMinus.gpuName}, chỉ giảm nhẹ -${deltaMinusAaa} FPS.`
          : "Tiết kiệm 5 triệu đồng bằng cách tối ưu chi phí linh kiện phụ mà vẫn đảm bảo mượt mà.",
      },
    };

    return {
      targetBudget: budget,
      useCase,
      candidates: {
        bestValue: {
          label: "Best Value (Cân Bằng P/P)",
          desc: "Tối ưu nhất giữa giá trị bỏ ra và hiệu năng nhận được",
          ...bestValue,
        },
        bestPerformance: {
          label: "Best Performance (Tối Đa Hiệu Năng)",
          desc: "Đạt sức mạnh xử lý cao nhất trong hạn mức ngân sách",
          ...bestPerformance,
        },
        budgetSafe: {
          label: "Budget Safe (Tiết Kiệm Chi Phí)",
          desc: "Ưu tiên tiết kiệm 10-15% ngân sách mà vẫn đáp ứng tốt mục tiêu",
          ...budgetSafe,
        },
      },
      totalPrice: bestValue.totalPrice,
      budgetUtilization: bestValue.budgetUtilization,
      components: bestValue.components,
      compatibilityReport: bestValue.compatibilityReport,
      whatIfSimulation,
      message: `Đã tự động tạo 3 phương án cấu hình cho nhu cầu ${useCase.toUpperCase()} trong ngân sách ${budget.toLocaleString("vi-VN")}đ`,
    };
  }

  async getAiAdvice(payload: any = {}): Promise<any> {
    const question = String(payload.question || "").trim() || "Cấu hình này có ổn không và nên lưu ý gì?";
    const buildContext = payload.buildContext || {};
    const items = Array.isArray(buildContext.items) ? buildContext.items : [];
    const totalPrice = Number(buildContext.totalPrice || 0);

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

    let recommendedBuild: any = null;
    try {
      const defaultRatios: Record<string, number> = detectedUseCase === "office"
        ? { cpu: 0.35, mainboard: 0.20, ram: 0.15, storage: 0.12, psu: 0.08, case: 0.05, cooling: 0.05, gpu: 0.0 }
        : { cpu: 0.18, mainboard: 0.12, ram: 0.10, gpu: 0.36, storage: 0.08, psu: 0.07, case: 0.05, cooling: 0.04 };

      const candidate = await this.querySingleCandidate(detectedBudget, defaultRatios, 1.0, detectedUseCase, {
        excludedTypes,
        colorScheme,
        caseStyle,
      });
      recommendedBuild = {
        budget: detectedBudget,
        totalPrice: candidate.totalPrice,
        useCase: detectedUseCase,
        components: candidate.components,
        compatibility: candidate.compatibilityReport,
      };
    } catch (candErr) {
      console.warn("Failed to generate recommendedBuild in getAiAdvice:", candErr);
    }

    let advice = "";
    let providerUsed = "PC Mall XAI Knowledge Engine (Real DB Grounded)";

    const llmRes = await aiOrchestratorService.getBuildAdvice({
      question,
      buildContext: {
        items: recommendedBuild?.components
          ? Object.values(recommendedBuild.components)
          : items,
        totalPrice: Number(recommendedBuild?.totalPrice || totalPrice),
      },
    });

    if (llmRes.success && llmRes.text && llmRes.provider !== "fallback") {
      advice = llmRes.text.trim();
      providerUsed = `${llmRes.provider === "gemini" ? "Google Gemini 1.5 Flash" : llmRes.provider === "groq" ? "Groq Llama 3.3" : "OpenAI GPT-4o-mini"} (Live LLM)`;
    } else {
      advice = generateRuleBasedAdvice(question, items, totalPrice, buildContext, recommendedBuild);
      providerUsed = "PC Mall XAI Knowledge Engine (Real DB Grounded)";
    }

    return { 
      question, 
      advice, 
      provider: providerUsed,
      detectedBudget,
      detectedUseCase,
      recommendedBuild,
    };
  }

  async checkRawCompatibility(payload: any = {}): Promise<any> {
    const rawComponents = Array.isArray(payload.components) ? payload.components : [];
    const normalizedComponents = rawComponents
      .map((component: any) => ({
        componentType: String(component.component_type || component.componentType || "").trim().toLowerCase(),
        variantId: Number(component.variant_id || component.variantId || 0),
        productName: String(component.name || component.productName || ""),
        specs: Array.isArray(component.specs)
          ? component.specs
          : (Array.isArray(component.attributes)
              ? component.attributes.map((a: any) => ({ key: a.name || a.key, value: String(a.value || "") }))
              : []),
      }))
      .filter((component: any) => component.componentType && (component.variantId > 0 || component.productName));

    if (normalizedComponents.length < 2) {
      throw createError("At least 2 components are required for compatibility check", 400);
    }

    const variantIds = normalizedComponents.map((component: any) => component.variantId).filter((id: number) => id > 0);
    let rows: any[] = [];
    if (variantIds.length > 0) {
      const placeholders = variantIds.map(() => "?").join(", ");
      try {
        rows = (await query(
          `
            SELECT
              s.id AS skuId,
              s.price AS price,
              p.id AS productId,
              p.name AS productName,
              p.category_id AS categoryId,
              c.name AS categoryName,
              a.id AS attributeId,
              a.name AS attributeName,
              av.id AS attributeValueId,
              av.value AS attributeValue
            FROM product_skus s
            INNER JOIN products p ON p.id = s.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN sku_attributes sa ON sa.sku_id = s.id
            LEFT JOIN attribute_values av ON av.id = sa.attribute_value_id
            LEFT JOIN attributes a ON a.id = av.attribute_id
            WHERE s.id IN (${placeholders})
            ORDER BY s.id ASC, a.name ASC
          `,
          variantIds
        )) as any[];
      } catch (_err) {
        rows = [];
      }
    }

    const bySku = new Map<number, DetailedComponent>();
    for (const row of rows as any[]) {
      if (!bySku.has(row.skuId)) {
        bySku.set(row.skuId, {
          componentType: "",
          skuId: Number(row.skuId),
          productId: Number(row.productId || 0),
          productName: String(row.productName || ""),
          categoryId: Number(row.categoryId || 0),
          categoryName: String(row.categoryName || ""),
          specs: [],
          attributeValueIds: new Set<number>(),
          attributeMap: new Map(),
        });
      }
      const item = bySku.get(row.skuId)!;
      if (row.attributeName && row.attributeValue) {
        const attrKey = normalizeAttributeKey(row.attributeName);
        item.specs.push({ key: String(row.attributeName), value: String(row.attributeValue) });
        if (row.attributeValueId) {
          item.attributeValueIds.add(Number(row.attributeValueId));
          item.attributeMap.set(attrKey, {
            attributeId: Number(row.attributeId || 0),
            attributeValueId: Number(row.attributeValueId),
            value: String(row.attributeValue),
          });
        }
      }
    }

    const componentMap: Record<string, DetailedComponent> = {};
    for (const comp of normalizedComponents) {
      const detail = bySku.get(comp.variantId) || {
        componentType: comp.componentType,
        skuId: comp.variantId,
        productId: 0,
        productName: comp.productName || "",
        categoryId: COMPONENT_DEFAULT_CAT_IDS[comp.componentType] || 0,
        categoryName: comp.componentType.toUpperCase(),
        specs: comp.specs || [],
        attributeValueIds: new Set<number>(),
        attributeMap: new Map(),
      };
      if (comp.productName && !detail.productName) {
        detail.productName = comp.productName;
      }
      if (comp.specs && comp.specs.length > 0 && detail.specs.length === 0) {
        detail.specs = comp.specs;
      }
      detail.componentType = comp.componentType;
      if (!detail.categoryId) {
        detail.categoryId = COMPONENT_DEFAULT_CAT_IDS[comp.componentType] || 0;
      }
      componentMap[comp.componentType] = detail;
    }

    const activeRules = await this.getActiveCompatibilityRules();
    return evaluateCompatibility(componentMap, activeRules);
  }
}

export const pcBuilderService = new PcBuilderService();
export default pcBuilderService;
