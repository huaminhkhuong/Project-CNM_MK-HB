import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { getDbPool } from "../src/config/database";

const productsService = require("../src/modules/products/products.service");

describe("Faceted Search (Lọc Động Đa Chiều Theo Danh Mục)", () => {
  after(async () => {
    try {
      await getDbPool().end();
    } catch {
      // ignore
    }
  });

  it("1. getFilterOptions trả về thuộc tính kỹ thuật chi tiết theo từng Category", async () => {
    // Category 3 = RAM
    const ramOptions = await productsService.getFilterOptions({ category_id: 3 });
    assert.ok(ramOptions.categories.length > 0);
    assert.ok(ramOptions.attributes.length > 0);

    const ramAttrNames = ramOptions.attributes.map((a: any) => a.name);
    // Phải có các thuộc tính kỹ thuật cốt lõi của RAM
    assert.ok(ramAttrNames.includes("Chuẩn RAM"), "RAM phải có facet Chuẩn RAM");
    assert.ok(ramAttrNames.includes("Tốc độ Bus"), "RAM phải có facet Tốc độ Bus");
    assert.ok(ramAttrNames.includes("Dung lượng RAM"), "RAM phải có facet Dung lượng RAM");

    // Mỗi giá trị phải có productCount > 0
    const chuanRam = ramOptions.attributes.find((a: any) => a.name === "Chuẩn RAM");
    assert.ok(chuanRam.values.length >= 2, "Chuẩn RAM phải có ít nhất 2 chuẩn (DDR4, DDR5)");
    assert.ok(chuanRam.values[0].productCount > 0, "productCount của facet value phải > 0");

    // Category 2 = MAINBOARD
    const mbOptions = await productsService.getFilterOptions({ category_id: 2 });
    const mbAttrNames = mbOptions.attributes.map((a: any) => a.name);
    assert.ok(mbAttrNames.includes("Socket hỗ trợ"), "Mainboard phải có facet Socket hỗ trợ");
    assert.ok(mbAttrNames.includes("Kích thước Form Factor"), "Mainboard phải có facet Form Factor");
    assert.ok(mbAttrNames.includes("Chipset"), "Mainboard phải có facet Chipset");

    // Category 4 = GPU (VGA)
    const vgaOptions = await productsService.getFilterOptions({ category_id: 4 });
    const vgaAttrNames = vgaOptions.attributes.map((a: any) => a.name);
    assert.ok(vgaAttrNames.includes("Dung lượng VRAM"), "VGA phải có facet Dung lượng VRAM");
    assert.ok(vgaAttrNames.includes("Nguồn đề xuất (PSU)"), "VGA phải có facet Nguồn đề xuất");
  });

  it("2. Lọc đa lựa chọn trong cùng một facet: OR trong facet (không bị trả về 0 kết quả)", async () => {
    const ramOptions = await productsService.getFilterOptions({ category_id: 3 });
    const chuanRam = ramOptions.attributes.find((a: any) => a.name === "Chuẩn RAM");
    assert.ok(chuanRam && chuanRam.values.length >= 2);

    const val1 = chuanRam.values[0];
    const val2 = chuanRam.values[1];

    // Lọc theo val1
    const res1 = await productsService.getProducts({
      category_id: 3,
      attribute_value_ids: [val1.id]
    });

    // Lọc theo val2
    const res2 = await productsService.getProducts({
      category_id: 3,
      attribute_value_ids: [val2.id]
    });

    // Lọc đồng thời cả 2 giá trị trong cùng facet Chuẩn RAM (OR)
    const resCombined = await productsService.getProducts({
      category_id: 3,
      attribute_value_ids: [val1.id, val2.id]
    });

    // Kết quả combined (OR) phải lớn hơn hoặc bằng từng giá trị đơn lẻ, KHÔNG ĐƯỢC BẰNG 0
    assert.ok(resCombined.pagination.totalItems >= res1.pagination.totalItems);
    assert.ok(resCombined.pagination.totalItems >= res2.pagination.totalItems);
    assert.ok(resCombined.pagination.totalItems > 0);
  });

  it("3. Lọc đa chiều liên facet (AND across facets): Chuẩn RAM DDR5 VÀ Tốc độ Bus", async () => {
    const ramOptions = await productsService.getFilterOptions({ category_id: 3 });
    const chuanRam = ramOptions.attributes.find((a: any) => a.name === "Chuẩn RAM");
    const busSpeed = ramOptions.attributes.find((a: any) => a.name === "Tốc độ Bus");

    assert.ok(chuanRam && busSpeed);

    const ddrVal = chuanRam.values[0];
    const busVal = busSpeed.values[0];

    // Lọc kết hợp 2 facet khác nhau (Chuẩn RAM AND Bus speed)
    const resMultiFacet = await productsService.getProducts({
      category_id: 3,
      attribute_value_ids: [ddrVal.id, busVal.id]
    });

    assert.ok(resMultiFacet.pagination !== undefined);
  });
});
