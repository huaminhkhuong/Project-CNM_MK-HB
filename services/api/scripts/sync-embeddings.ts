import fs from "fs";
import path from "path";
import { prisma } from "../src/config/prisma";
import { EmbeddingService } from "../src/modules/ai/embedding.service";
import { VectorStoreService, VectorDocument } from "../src/modules/ai/vector-store.service";

interface ProductSyncMetadata {
  productId: number;
  skuId?: number;
  sku?: string;
  name: string;
  category: string;
  categoryId: number;
  brand: string;
  price: number;
  stock: number;
  imageUrl?: string;
  socket?: string;
  tdp?: number;
  ramType?: string;
  formFactor?: string;
}

interface KnowledgeSyncMetadata {
  title: string;
  sourceFile: string;
  section: string;
  category: "hardware_rule" | "store_policy";
}

/**
 * Trích xuất thuộc tính kỹ thuật từ danh sách SkuAttribute
 */
function extractAttributes(skuAttributes: any[] = []): Record<string, string> {
  const result: Record<string, string> = {};

  for (const item of skuAttributes) {
    const attrName = item?.AttributeValue?.Attribute?.name?.trim();
    const attrValue = item?.AttributeValue?.value?.trim();

    if (attrName && attrValue) {
      const lowerName = attrName.toLowerCase();
      // Gom nhóm các thuộc tính quan trọng
      if (lowerName.includes("socket")) result["socket"] = attrValue;
      else if (lowerName.includes("tdp") || lowerName.includes("tiêu thụ")) result["tdp"] = attrValue;
      else if (lowerName.includes("chuẩn ram")) result["ramType"] = attrValue;
      else if (lowerName.includes("dung lượng ram")) result["ramCapacity"] = attrValue;
      else if (lowerName.includes("tốc độ bus")) result["busSpeed"] = attrValue;
      else if (lowerName.includes("nguồn đề xuất") || lowerName.includes("công suất nguồn")) result["psuWattage"] = attrValue;
      else if (lowerName.includes("kích thước form factor") || lowerName.includes("mainboard")) result["formFactor"] = attrValue;
      else if (lowerName.includes("số nhân")) result["coresThreads"] = attrValue;
      else if (lowerName.includes("xung nhịp")) result["clockSpeed"] = attrValue;
      else if (lowerName.includes("loại ổ cứng") || lowerName.includes("dung lượng ổ cứng")) result["storage"] = attrValue;
      else if (lowerName.includes("hiệu suất") || lowerName.includes("80 plus")) result["efficiency"] = attrValue;
      else if (lowerName.includes("vga tối đa")) result["maxGpuLength"] = attrValue;
      else if (lowerName.includes("radiator") || lowerName.includes("tản nhiệt")) result["cooling"] = attrValue;
    }
  }

  return result;
}

/**
 * Chuẩn hóa một sản phẩm thành văn bản mô tả giàu ngữ nghĩa phục vụ Vector Embedding
 */
function buildProductChunkText(prod: any, sku: any, attrs: Record<string, string>): string {
  const categoryName = prod.Category?.name || "Linh kiện PC";
  const brandName = prod.Brand?.name || "Chính hãng";
  const price = Number(sku?.price || prod.price || 0);
  const stock = sku?.stock ?? 10;
  const priceFormatted = price.toLocaleString("vi-VN") + "đ";

  const specParts: string[] = [];
  if (attrs.socket) specParts.push(`Socket: ${attrs.socket}`);
  if (attrs.coresThreads) specParts.push(`Cấu hình: ${attrs.coresThreads}`);
  if (attrs.clockSpeed) specParts.push(`Xung nhịp: ${attrs.clockSpeed}`);
  if (attrs.tdp) specParts.push(`Điện năng TDP: ${attrs.tdp}`);
  if (attrs.ramType) specParts.push(`Chuẩn RAM: ${attrs.ramType}`);
  if (attrs.ramCapacity) specParts.push(`Dung lượng: ${attrs.ramCapacity}`);
  if (attrs.busSpeed) specParts.push(`Bus: ${attrs.busSpeed}`);
  if (attrs.psuWattage) specParts.push(`Công suất: ${attrs.psuWattage}`);
  if (attrs.efficiency) specParts.push(`Chuẩn hiệu suất: ${attrs.efficiency}`);
  if (attrs.formFactor) specParts.push(`Kích thước Form Factor: ${attrs.formFactor}`);
  if (attrs.storage) specParts.push(`Lưu trữ: ${attrs.storage}`);
  if (attrs.cooling) specParts.push(`Tản nhiệt: ${attrs.cooling}`);
  if (attrs.maxGpuLength) specParts.push(`Không gian VGA tối đa: ${attrs.maxGpuLength}`);

  const lines = [
    `[Mã sản phẩm: ${prod.id}] [Danh mục: ${categoryName}] [Hãng: ${brandName}] ${prod.name}`,
    `- Giá bán: ${priceFormatted} | Tồn kho: ${stock > 0 ? `Còn hàng (${stock} cái)` : "Tạm hết hàng"}`,
    specParts.length > 0 ? `- Thông số kỹ thuật: ${specParts.join(", ")}` : "",
    prod.description ? `- Đặc điểm: ${prod.description.trim()}` : ""
  ].filter(Boolean);

  return lines.join("\n");
}

/**
 * Đọc và chia nhỏ các tài liệu tri thức (Markdown) trong thư mục knowledge/
 */
function loadKnowledgeChunks(): { id: string; text: string; metadata: KnowledgeSyncMetadata }[] {
  const knowledgeDir = path.resolve(__dirname, "../knowledge");
  const chunks: { id: string; text: string; metadata: KnowledgeSyncMetadata }[] = [];

  if (!fs.existsSync(knowledgeDir)) {
    return chunks;
  }

  const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const fullPath = path.join(knowledgeDir, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    const isHardware = file.includes("hardware");

    // Tách theo các tiêu đề H2 (## )
    const sections = content.split(/\n(?=##\s+)/);
    const docTitle = content.split("\n")[0].replace(/^#+\s*/, "").trim();

    sections.forEach((sec, idx) => {
      const trimmed = sec.trim();
      // Bỏ qua nếu chỉ là dòng tiêu đề H1 ngắn
      if (!trimmed || trimmed.length < 50 || !trimmed.startsWith("## ")) return;

      const firstLine = trimmed.split("\n")[0].replace(/^#+\s*/, "").trim();
      const enrichedText = `[Tài liệu: ${docTitle}]\n${trimmed}`;

      chunks.push({
        id: `kb_${file.replace(".md", "")}_${idx}`,
        text: enrichedText,
        metadata: {
          title: firstLine,
          sourceFile: file,
          section: firstLine,
          category: isHardware ? "hardware_rule" : "store_policy"
        }
      });
    });
  }

  return chunks;
}

/**
 * Main ETL Sync Script
 */
async function syncEmbeddings() {
  console.log("======================================================================");
  console.log("🚀 BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU SẢN PHẨM & TRI THỨC VÀO RAG VECTOR STORE");
  console.log("======================================================================");

  try {
    // 1. LẤY DANH SÁCH SẢN PHẨM TỪ MYSQL PRISMA
    console.log("\n📦 [1/4] Đang đọc sản phẩm từ MySQL (bảng products, categories, skus)...");
    const products = await prisma.product.findMany({
      where: {
        is_active: true
      },
      include: {
        Category: true,
        Brand: true,
        ProductSku: {
          where: { is_active: true },
          include: {
            SkuAttribute: {
              include: {
                AttributeValue: {
                  include: {
                    Attribute: true
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(` -> Tìm thấy ${products.length} sản phẩm đang ACTIVE trong database.`);

    // 2. CHUẨN BỊ PRODUCT CHUNKS
    console.log("\n⚙️ [2/4] Chuẩn hóa văn bản thông số kỹ thuật (Chunking)...");
    const productDocs: { id: string | number; text: string; metadata: ProductSyncMetadata }[] = [];

    for (const prod of products) {
      const activeSku = prod.ProductSku?.[0];
      const attrs = extractAttributes(activeSku?.SkuAttribute || []);
      const chunkText = buildProductChunkText(prod, activeSku, attrs);

      // Trích xuất số TDP và Socket cho metadata filter
      let numericTdp: number | undefined = undefined;
      if (attrs.tdp) {
        const match = attrs.tdp.match(/\d+/);
        if (match) numericTdp = parseInt(match[0], 10);
      }

      productDocs.push({
        id: `prod_${prod.id}`,
        text: chunkText,
        metadata: {
          productId: prod.id,
          skuId: activeSku?.id,
          sku: activeSku?.sku,
          name: prod.name || "",
          category: (prod.Category?.name || "").toLowerCase(),
          categoryId: prod.category_id || 0,
          brand: prod.Brand?.name || "",
          price: Number(activeSku?.price || prod.price || 0),
          stock: activeSku?.stock ?? 0,
          imageUrl: activeSku?.image_url || undefined,
          socket: attrs.socket,
          tdp: numericTdp,
          ramType: attrs.ramType,
          formFactor: attrs.formFactor
        }
      });
    }

    // 3. SINH EMBEDDINGS VÀ LƯU PRODUCT COLLECTION
    console.log(`\n🧠 [3/4] Đang sinh Embeddings cho ${productDocs.length} sản phẩm...`);
    const productTexts = productDocs.map((p) => p.text);
    const productVectors = await EmbeddingService.generateBatchEmbeddings(productTexts, 15);

    const productVectorDocs: VectorDocument<ProductSyncMetadata>[] = productDocs.map((doc, idx) => ({
      id: doc.id,
      text: doc.text,
      vector: productVectors[idx],
      metadata: doc.metadata
    }));

    VectorStoreService.upsert("products", productVectorDocs);
    const savedProducts = VectorStoreService.save("products");
    console.log(` -> Đã lưu thành công ${productVectorDocs.length} sản phẩm vào "products.json": ${savedProducts ? "✅ OK" : "❌ LỖI"}`);

    // 4. ĐỒNG BỘ TRI THỨC PHẦN CỨNG & CHÍNH SÁCH (KNOWLEDGE BASE)
    console.log("\n📚 [4/4] Đang đọc và sinh Embeddings cho kho tri thức (hardware-rules, store-policies)...");
    const knowledgeChunks = loadKnowledgeChunks();
    console.log(` -> Tìm thấy ${knowledgeChunks.length} đề mục kiến thức.`);

    if (knowledgeChunks.length > 0) {
      const kbTexts = knowledgeChunks.map((k) => k.text);
      const kbVectors = await EmbeddingService.generateBatchEmbeddings(kbTexts, 10);

      const kbVectorDocs: VectorDocument<KnowledgeSyncMetadata>[] = knowledgeChunks.map((doc, idx) => ({
        id: doc.id,
        text: doc.text,
        vector: kbVectors[idx],
        metadata: doc.metadata
      }));

      VectorStoreService.upsert("knowledge", kbVectorDocs);
      const savedKb = VectorStoreService.save("knowledge");
      console.log(` -> Đã lưu thành công ${kbVectorDocs.length} đề mục tri thức vào "knowledge.json": ${savedKb ? "✅ OK" : "❌ LỖI"}`);
    }

    console.log("\n======================================================================");
    console.log("🎉 HOÀN TẤT ĐỒNG BỘ RAG VECTOR STORE THÀNH CÔNG RỰC RỠ!");
    console.log(`   - Tổng sản phẩm đã nạp: ${productVectorDocs.length}`);
    console.log(`   - Tổng tri thức đã nạp:  ${knowledgeChunks.length}`);
    console.log("======================================================================\n");
  } catch (error: any) {
    console.error("\n❌ LỖI TRONG QUÁ TRÌNH ĐỒNG BỘ:", error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Chạy trực tiếp nếu file được gọi từ CLI
if (require.main === module || process.argv[1]?.includes("sync-embeddings")) {
  syncEmbeddings();
}

export { syncEmbeddings };
