/**
 * 🛠️ FULL MARKET PRICE HEALER & CATALOG SYNCHRONIZER
 * 1. Quét toàn bộ 1,200 sản phẩm theo chuẩn thị trường linh kiện PC Việt Nam.
 * 2. Cập nhật cơ sở dữ liệu MySQL (bảng product_skus và products).
 * 3. Đồng bộ và ghi đè toàn bộ file dữ liệu trong thư mục T:\Khoa_luan\data (cả JSON và CSV).
 */

const fs = require("fs");
const path = require("path");
const { query } = require("../src/config/database");

const DATA_DIR = path.resolve(__dirname, "../../../data");
const JSON_DIR = path.join(DATA_DIR, "json");
const CSV_DIR = path.join(DATA_DIR, "csv");

// Hàm chuẩn hóa giá theo thị trường linh kiện PC Việt Nam
function calculateRealisticMarketPrice(category, name, currentPrice) {
  const n = String(name || "").toLowerCase();
  const cat = String(category || "").toLowerCase();
  let p = Number(currentPrice || 0);

  // ── 1. VGA / GPU ──
  if (cat === "vga" || cat === "gpu" || cat === "4") {
    // Workstation low-end GPUs
    if (n.includes("a400")) return 5990000;
    if (n.includes("t400")) return 3290000;
    if (n.includes("t1000")) return 6890000;

    // Enterprise / Server GPUs
    if (/\ba40\b/i.test(n) || n.includes("a100") || n.includes("h100") || n.includes("h200") || n.includes("l40")) {
      return 115000000;
    }

    // Consumer Gaming GPUs
    if (n.includes("5090") || n.includes("4090")) return 54900000;
    if (n.includes("5080") || n.includes("4080 super") || n.includes("4080")) return 31900000;
    if (n.includes("5070 ti") || n.includes("4070 ti super") || n.includes("4070 ti") || n.includes("7900 xt")) return 22900000;
    if (n.includes("5070") || n.includes("4070 super") || n.includes("4070") || n.includes("7800 xt")) return 16900000;
    if (n.includes("4060 ti") || n.includes("5060 ti") || n.includes("7700 xt")) return 10890000;
    if (n.includes("5060") || n.includes("4060") || n.includes("7600 xt") || n.includes("3060 ti")) return 7990000;
    if (n.includes("3060")) return 6890000;
    if (n.includes("3050") || n.includes("5050") || n.includes("6600") || n.includes("a580")) return 4990000;
    if (n.includes("6500") || n.includes("1650") || n.includes("a380")) return 3490000;
    if (n.includes("1030") || n.includes("730") || n.includes("r7 240")) return 1490000;

    // Nếu giá bất hợp lý (< 2M hoặc > 90M)
    if (p < 2000000 || p > 90000000) return 7500000;
    return p;
  }

  // ── 2. CPU ──
  if (cat === "cpu" || cat === "1") {
    if (n.includes("threadripper") || n.includes("epyc") || n.includes("xeon")) return 55000000;
    if (n.includes("14900") || n.includes("13900") || n.includes("285k") || n.includes("7950x") || n.includes("9950x")) return 14500000;
    if (n.includes("14700") || n.includes("13700") || n.includes("265k") || n.includes("7800x3d") || n.includes("9800x3d") || n.includes("7900")) return 9890000;
    if (n.includes("14600") || n.includes("13600") || n.includes("245k") || n.includes("7700x") || n.includes("7700") || n.includes("7500x3d")) return 6890000;
    if (n.includes("14500") || n.includes("13500") || n.includes("14400") || n.includes("13400") || n.includes("7600x") || n.includes("7600") || n.includes("8500g") || n.includes("7500f")) return 4990000;
    if (n.includes("12400") || n.includes("5700") || n.includes("5600x") || n.includes("5600") || n.includes("5500gt")) return 2890000;
    if (n.includes("4600g") || n.includes("5500") || n.includes("14100") || n.includes("13100") || n.includes("12100") || n.includes("3600")) return 2190000;

    if (p < 1000000 || p > 50000000) return 3500000;
    return p;
  }

  // ── 3. RAM ──
  if (cat === "ram" || cat === "3") {
    const isDdr5 = n.includes("ddr5") || n.includes("5600") || n.includes("6000") || n.includes("6400");
    if (n.includes("64gb") || n.includes("2x32") || n.includes("32gbx2")) return isDdr5 ? 4990000 : 3490000;
    if (n.includes("32gb") || n.includes("2x16") || n.includes("16gbx2")) return isDdr5 ? 2690000 : 1790000;
    if (n.includes("16gb") || n.includes("2x8") || n.includes("8gbx2")) return isDdr5 ? 1390000 : 850000;
    if (n.includes("8gb") || n.includes("1x8")) return isDdr5 ? 750000 : 450000;

    if (p < 300000 || p > 15000000) return isDdr5 ? 1390000 : 850000;
    return p;
  }

  // ── 4. SSD / STORAGE ──
  if (cat === "ssd" || cat === "storage" || cat === "5") {
    const isGen4 = n.includes("gen4") || n.includes("gen 4") || n.includes("pcie 4") || n.includes("sn850") || n.includes("990 pro");
    if (n.includes("4tb") || n.includes("4000g")) return 7500000;
    if (n.includes("2tb") || n.includes("2000g")) return isGen4 ? 3890000 : 3290000;
    if (n.includes("1tb") || n.includes("1000g") || n.includes("960gb")) return isGen4 ? 1890000 : 1550000;
    if (n.includes("500g") || n.includes("512g") || n.includes("480g")) return isGen4 ? 1090000 : 850000;
    if (n.includes("250g") || n.includes("256g") || n.includes("240g")) return 590000;
    if (n.includes("120g") || n.includes("128g")) return 390000;

    if (p === 30000000 || p < 300000 || p > 15000000) return 1290000;
    return p;
  }

  // ── 5. HDD ──
  if (cat === "hdd" || cat === "9") {
    if (n.includes("8tb")) return 3990000;
    if (n.includes("6tb")) return 3190000;
    if (n.includes("4tb")) return 2290000;
    if (n.includes("2tb")) return 1450000;
    if (n.includes("1tb")) return 1050000;
    if (p < 500000 || p > 15000000) return 1450000;
    return p;
  }

  // ── 6. MAINBOARD ──
  if (cat === "mainboard" || cat === "2") {
    if (n.includes("x870e") || n.includes("z890") || n.includes("crosshair") || n.includes("godlike")) return 11900000;
    if (n.includes("x870") || n.includes("z790") || n.includes("x670e")) return 7890000;
    if (n.includes("x670") || n.includes("b650e") || n.includes("z690")) return 5490000;
    if (n.includes("b760") || n.includes("b650")) return 3490000;
    if (n.includes("b550") || n.includes("b450")) return 2290000;
    if (n.includes("h610") || n.includes("a620") || n.includes("a520")) return 1850000;

    if (p < 1200000 || p > 25000000) return 3290000;
    return p;
  }

  // ── 7. PSU (NGUỒN) ──
  if (cat === "psu" || cat === "6") {
    const wMatch = n.match(/(\d{3,4})\s*w/i);
    const w = wMatch ? Number(wMatch[1]) : 650;
    if (w >= 1000) return 3890000;
    if (w >= 850) return 2690000;
    if (w >= 750) return 1890000;
    if (w >= 650) return 1350000;
    if (w >= 550) return 1050000;
    if (w >= 450) return 790000;
    if (p < 400000 || p > 10000000) return 1250000;
    return p;
  }

  // ── 8. COOLING (TẢN NHIỆT) ──
  if (cat === "cooling" || cat === "8") {
    if (n.includes("360") || n.includes("kraken") || n.includes("ryujin") || n.includes("lt720")) return 2690000;
    if (n.includes("240") || n.includes("280")) return 1690000;
    if (n.includes("nh-d15") || n.includes("assassin") || n.includes("ak620") || n.includes("cr-3000")) return 1450000;
    if (n.includes("ag400") || n.includes("cr-1000") || n.includes("se-214") || n.includes("ca40")) return 450000;

    if (p === 30000000 || p < 150000 || p > 10000000) return 550000;
    return p;
  }

  // ── 9. CASE (VỎ MÁY) ──
  if (cat === "case" || cat === "7") {
    if (n.includes("bể cá") || n.includes("panorama") || n.includes("rog") || n.includes("o11") || n.includes("h9") || n.includes("5000d")) return 2290000;
    if (n.includes("4000d") || n.includes("d33") || n.includes("mk400") || n.includes("af13") || n.includes("mesh")) return 1190000;
    if (p < 300000 || p > 12000000) return 790000;
    return p;
  }

  // ── 10. MONITOR (MÀN HÌNH) ──
  if (cat === "monitor" || cat === "10") {
    if (n.includes("4k") || n.includes("oled")) return 14500000;
    if (n.includes("2k") || n.includes("1440p") || n.includes("qhd")) return 5890000;
    if (n.includes("144hz") || n.includes("165hz") || n.includes("180hz") || n.includes("240hz")) return 3490000;
    if (p < 1500000 || p > 40000000) return 2890000;
    return p;
  }

  // ── 11. KEYBOARD / MOUSE ──
  if (cat === "keyboard_mouse" || cat === "11") {
    if (n.includes("custom") || n.includes("wireless") || n.includes("pro x") || n.includes("superlight") || n.includes("razer")) return 2290000;
    if (p < 100000 || p > 10000000) return 590000;
    return p;
  }

  // ── 12. HEADPHONE ──
  if (cat === "headphone" || cat === "12") {
    if (n.includes("wireless") || n.includes("bluetooth") || n.includes("anc") || n.includes("sony") || n.includes("sennheiser")) return 3290000;
    if (p < 100000 || p > 15000000) return 890000;
    return p;
  }

  return p;
}

// Chuyển mảng đối tượng thành CSV string
function jsonToCsv(items) {
  if (!items || items.length === 0) return "";
  const headers = Object.keys(items[0]).filter(k => k !== "specifications" && k !== "images");
  // Thêm specifications_json nếu cần
  const allHeaders = [...headers, "specifications", "images"];
  
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csvRows = [
    allHeaders.join(","),
    ...items.map(it => allHeaders.map(h => escapeCell(it[h])).join(","))
  ];
  return csvRows.join("\n");
}

async function run() {
  console.log("================================================================================");
  console.log("       TIẾN HÀNH CHUẨN HÓA TOÀN DIỆN GIÁ LINH KIỆN VÀ ĐỒNG BỘ DỮ LIỆU           ");
  console.log("================================================================================\n");

  // BƯỚC 1: ĐỌC VÀ CHUẨN HÓA TẤT CẢ SẢN PHẨM TRONG pc_components_all.json
  const allJsonPath = path.join(JSON_DIR, "pc_components_all.json");
  if (!fs.existsSync(allJsonPath)) {
    throw new Error(`Không tìm thấy file: ${allJsonPath}`);
  }

  const allItems = JSON.parse(fs.readFileSync(allJsonPath, "utf8"));
  console.log(`📦 Đã nạp ${allItems.length} sản phẩm từ ${allJsonPath}`);

  let changedCount = 0;
  const itemsByCategory = {};

  for (const it of allItems) {
    const oldPrice = it.price;
    const realisticPrice = calculateRealisticMarketPrice(it.category, it.name, oldPrice);

    if (realisticPrice !== oldPrice) {
      changedCount++;
      it.price = realisticPrice;
      it.price_formatted = realisticPrice.toLocaleString("vi-VN") + "đ";
    }

    if (!itemsByCategory[it.category]) {
      itemsByCategory[it.category] = [];
    }
    itemsByCategory[it.category].push(it);
  }

  console.log(`✅ Đã chuẩn hóa giá cho ${changedCount} / ${allItems.length} sản phẩm trong JSON memory.`);

  // BƯỚC 2: CẬP NHẬT DATABASE MYSQL
  console.log("\n⚡ Đang cập nhật giá chuẩn hóa vào MySQL Database...");
  let dbUpdatedCount = 0;

  for (const it of allItems) {
    const res = await query(
      `UPDATE product_skus s
       INNER JOIN products p ON p.id = s.product_id
       SET s.price = ?
       WHERE p.name = ? OR p.slug = ?`,
      [it.price, it.name, it.slug]
    );
    if (res.affectedRows > 0) {
      dbUpdatedCount += res.affectedRows;
    }
  }
  console.log(`✅ Đã cập nhật thành công ${dbUpdatedCount} bản ghi SKU trong MySQL Database!`);

  // BƯỚC 3: GHI ĐÈ LẠI TOÀN BỘ FILE DỮ LIỆU TRONG FOLDER DATA/JSON VÀ DATA/CSV
  console.log("\n📁 Đang ghi đè dữ liệu chuẩn hóa vào thư mục data/json và data/csv...");

  // 1. Ghi pc_components_all.json
  fs.writeFileSync(allJsonPath, JSON.stringify(allItems, null, 2), "utf8");
  console.log(`  -> Ghi thành công: data/json/pc_components_all.json`);

  // 2. Ghi pc_components_all.csv
  const allCsvPath = path.join(CSV_DIR, "pc_components_all.csv");
  fs.writeFileSync(allCsvPath, jsonToCsv(allItems), "utf8");
  console.log(`  -> Ghi thành công: data/csv/pc_components_all.csv`);

  // 3. Ghi từng file category riêng
  for (const [catName, catItems] of Object.entries(itemsByCategory)) {
    const catJsonFile = path.join(JSON_DIR, `${catName}.json`);
    const catCsvFile = path.join(CSV_DIR, `${catName}.csv`);

    fs.writeFileSync(catJsonFile, JSON.stringify(catItems, null, 2), "utf8");
    fs.writeFileSync(catCsvFile, jsonToCsv(catItems), "utf8");
    console.log(`  -> Đã cập nhật: ${catName}.json & ${catName}.csv (${catItems.length} linh kiện)`);
  }

  console.log("\n🎉 HOÀN TẤT ĐỒNG BỘ 100% CƠ SỞ DỮ LIỆU VÀ THƯ MỤC DATA!");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Lỗi:", err);
  process.exit(1);
});
