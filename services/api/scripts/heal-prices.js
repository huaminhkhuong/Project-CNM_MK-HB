const { query } = require("../src/config/database");

async function healAllPrices() {
  console.log("⚡ Bắt đầu chuẩn hóa giá linh kiện theo đúng thị trường Việt Nam...");

  const skus = await query(`
    SELECT s.id AS skuId, p.id AS prodId, p.name, p.category_id AS catId, s.price
    FROM product_skus s
    INNER JOIN products p ON p.id = s.product_id
  `);

  let updated = 0;

  for (const item of skus) {
    const n = (item.name || "").toLowerCase();
    const cat = Number(item.catId);
    let p = Number(item.price);
    let newPrice = p;

    // 1. GPU (cat 4)
    if (cat === 4) {
      if (p < 2000000 || p > 90000000) {
        if (n.includes("5090") || n.includes("4090")) newPrice = 54900000;
        else if (n.includes("5080") || n.includes("4080")) newPrice = 31900000;
        else if (n.includes("5070 ti") || n.includes("4070 ti")) newPrice = 22900000;
        else if (n.includes("5070") || n.includes("4070")) newPrice = 16900000;
        else if (n.includes("5060 ti") || n.includes("4060 ti")) newPrice = 11400000;
        else if (n.includes("5060") || n.includes("4060")) newPrice = 7990000;
        else if (n.includes("3060")) newPrice = 6890000;
        else if (n.includes("3050") || n.includes("5050") || n.includes("6600")) newPrice = 4990000;
        else if (n.includes("6500") || n.includes("1650")) newPrice = 3490000;
        else if (n.includes("1030") || n.includes("730")) newPrice = 1490000;
        else newPrice = 7500000;
      }
    }

    // 2. RAM (cat 3)
    if (cat === 3) {
      if (p < 300000 || p === 1000000 && (n.includes("64gb") || n.includes("32gb") || n.includes("6000mhz"))) {
        const isDdr5 = n.includes("ddr5");
        if (n.includes("64gb") || n.includes("2x32")) newPrice = isDdr5 ? 4890000 : 3290000;
        else if (n.includes("32gb") || n.includes("2x16")) newPrice = isDdr5 ? 2690000 : 1790000;
        else if (n.includes("16gb")) newPrice = isDdr5 ? 1390000 : 850000;
        else if (n.includes("8gb")) newPrice = isDdr5 ? 750000 : 450000;
      }
    }

    // 3. SSD (cat 5)
    if (cat === 5) {
      if (p === 30000000 || p < 400000 || p > 15000000) {
        if (n.includes("4tb")) newPrice = 7500000;
        else if (n.includes("2tb")) newPrice = 3690000;
        else if (n.includes("1tb") || n.includes("1000g")) newPrice = 1890000;
        else if (n.includes("500g") || n.includes("512g")) newPrice = 1090000;
        else if (n.includes("250g") || n.includes("256g")) newPrice = 650000;
        else newPrice = 1490000;
      }
    }

    // 4. Mainboard (cat 2)
    if (cat === 2) {
      if (p < 1200000 || p > 40000000) {
        if (n.includes("x870") || n.includes("z890")) newPrice = 9890000;
        else if (n.includes("x670") || n.includes("z790")) newPrice = 6990000;
        else if (n.includes("b650") || n.includes("b760")) newPrice = 3690000;
        else if (n.includes("a620") || n.includes("h610")) newPrice = 1950000;
        else if (n.includes("b550") || n.includes("b450")) newPrice = 2290000;
        else newPrice = 3290000;
      }
    }

    // 5. PSU (cat 6)
    if (cat === 6) {
      if (p < 500000 || p > 12000000) {
        const m = n.match(/(\d{3,4})\s*w/i);
        const w = m ? Number(m[1]) : 650;
        if (w >= 1000) newPrice = 4290000;
        else if (w >= 850) newPrice = 2890000;
        else if (w >= 750) newPrice = 1990000;
        else if (w >= 650) newPrice = 1450000;
        else if (w >= 550) newPrice = 1150000;
        else newPrice = 850000;
      }
    }

    // 6. Cooling (cat 8)
    if (cat === 8) {
      if (p === 30000000 || p < 150000) {
        if (n.includes("360")) newPrice = 2490000;
        else if (n.includes("240")) newPrice = 1590000;
        else if (n.includes("ak620") || n.includes("peerless") || n.includes("dual")) newPrice = 990000;
        else newPrice = 450000;
      }
    }

    if (newPrice !== p) {
      await query("UPDATE product_skus SET price = ? WHERE id = ?", [newPrice, item.skuId]);
      await query("UPDATE products SET price = ? WHERE id = ?", [newPrice, item.prodId]);
      updated++;
    }
  }

  console.log(`✅ Đã điều chỉnh giá chuẩn cho ${updated} sản phẩm!`);
  process.exit(0);
}

healAllPrices().catch(console.error);
