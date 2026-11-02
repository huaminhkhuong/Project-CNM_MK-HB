import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateBuilderInsights, estimateProductPerformance } from "../../../utils/calculateBuilderInsights.js";

describe("Frontend Scoring Engine (calculateBuilderInsights & estimateProductPerformance)", () => {
  // Mock product helpers
  const mockCpuHigh = { id: 1, name: "Intel Core i9 14900K", price: 15000000, attributes: [{ name: "tdp", value: "125" }, { name: "socket", value: "LGA1700" }] };
  const mockCpuMid = { id: 2, name: "AMD Ryzen 5 7600X", price: 5500000, attributes: [{ name: "tdp", value: "65" }, { name: "socket", value: "AM5" }] };

  const mockGpu4K = { id: 10, name: "NVIDIA GeForce RTX 4090 24GB", price: 48000000, attributes: [{ name: "tdp", value: "450" }, { name: "length", value: "304" }] };
  const mockGpu2K = { id: 11, name: "NVIDIA GeForce RTX 4070 Super 12GB", price: 17500000, attributes: [{ name: "tdp", value: "220" }, { name: "length", value: "242" }] };
  const mockGpu1080p = { id: 12, name: "NVIDIA GeForce RTX 3060 12GB", price: 7200000, attributes: [{ name: "tdp", value: "170" }, { name: "length", value: "200" }] };

  const mockMainboardHigh = { id: 20, name: "MSI Z790 TOMAHAWK WIFI", price: 6800000, attributes: [{ name: "socket", value: "LGA1700" }, { name: "ram_slots", value: "4" }, { name: "form_factor", value: "ATX" }] };
  const mockMainboardMid = { id: 21, name: "MSI MAG B650 TOMAHAWK WIFI", price: 5400000, attributes: [{ name: "socket", value: "AM5" }, { name: "ram_slots", value: "4" }, { name: "form_factor", value: "ATX" }] };

  const mockRam32GB = { id: 30, name: "Corsair Vengeance 32GB (2x16GB) DDR5", price: 3200000, attributes: [{ name: "memory type", value: "DDR5" }] };
  const mockPsu1000W = { id: 40, name: "Corsair RM1000x 1000W 80 Plus Gold", price: 4500000, attributes: [{ name: "watt", value: "1000" }] };
  const mockCooling360 = { id: 50, name: "NZXT Kraken Elite 360 RGB AIO", price: 6500000, attributes: [{ name: "cooling capacity", value: "300" }] };

  // Test 1: estimateProductPerformance GPU and CPU tier rating
  it("estimates product performance score accurately for different GPU and CPU tiers", () => {
    assert.equal(estimateProductPerformance(mockGpu4K, "gpu"), 98, "RTX 4090 should score 98 in GPU performance");
    assert.equal(estimateProductPerformance(mockGpu2K, "gpu"), 80, "RTX 4070 should score 80 in GPU performance");
    assert.equal(estimateProductPerformance(mockGpu1080p, "gpu"), 64, "RTX 3060 should score 64 in GPU performance");
    assert.equal(estimateProductPerformance(mockCpuHigh, "cpu"), 96, "Core i9 14900K should score 96 in CPU performance");
    assert.equal(estimateProductPerformance(mockCpuMid, "cpu"), 76, "Ryzen 5 7600X should score 76 in CPU performance");
  });

  // Test 2: FPS Estimates for Different Resolutions (1080p, 2K, 4K)
  it("computes accurate FPS estimates scaling across 1080p, 2K, and 4K resolutions", () => {
    const selectedItems4K = {
      cpu: mockCpuHigh,
      gpu: mockGpu4K
    };

    const insights1080p = calculateBuilderInsights(selectedItems4K, 2, { resolution: "1080p" });
    const insights2K    = calculateBuilderInsights(selectedItems4K, 2, { resolution: "2k" });
    const insights4K    = calculateBuilderInsights(selectedItems4K, 2, { resolution: "4k" });

    assert.ok(insights1080p.fps > insights2K.fps, "1080p FPS should be strictly higher than 2K FPS");
    assert.ok(insights2K.fps > insights4K.fps, "2K FPS should be strictly higher than 4K FPS");
    assert.equal(Math.round(insights1080p.fps * 0.7), insights2K.fps);
    assert.equal(Math.round(insights1080p.fps * 0.45), insights4K.fps);
  });

  // Test 3: FPS Scale for Different GPU Tiers (RTX 4090 vs RTX 4070 vs RTX 3060)
  it("scales FPS estimates correctly between High Tier (4090), Mid Tier (4070), and Entry (3060)", () => {
    const items4090 = { cpu: mockCpuMid, gpu: mockGpu4K };
    const items4070 = { cpu: mockCpuMid, gpu: mockGpu2K };
    const items3060 = { cpu: mockCpuMid, gpu: mockGpu1080p };

    const fps4090 = calculateBuilderInsights(items4090, 2, { resolution: "1080p" }).fps;
    const fps4070 = calculateBuilderInsights(items4070, 2, { resolution: "1080p" }).fps;
    const fps3060 = calculateBuilderInsights(items3060, 2, { resolution: "1080p" }).fps;

    assert.ok(fps4090 > fps4070, "RTX 4090 FPS must exceed RTX 4070 FPS");
    assert.ok(fps4070 > fps3060, "RTX 4070 FPS must exceed RTX 3060 FPS");
  });

  // Test 4: requirementMatchScore for Gaming 4K vs Gaming 1080p
  it("calculates requirementMatchScore based on GPU capability for 4K Gaming profile", () => {
    const itemsHigh = { cpu: mockCpuHigh, gpu: mockGpu4K, mainboard: mockMainboardHigh };
    const itemsEntry = { cpu: mockCpuMid, gpu: mockGpu1080p, mainboard: mockMainboardMid };

    const score4KHigh = calculateBuilderInsights(itemsHigh, 3, { purpose: "gaming", resolution: "4k" }).requirementMatchScore;
    const score4KEntry = calculateBuilderInsights(itemsEntry, 3, { purpose: "gaming", resolution: "4k" }).requirementMatchScore;

    assert.equal(score4KHigh, 95, "RTX 4090 should achieve 95% match for 4K Gaming");
    assert.ok(score4KEntry < 80, "RTX 3060 should have a lower match score for 4K Gaming");
  });

  // Test 5: requirementMatchScore for Content Creation / Editing (CPU & 32GB RAM)
  it("calculates requirementMatchScore for Editing profile requiring high CPU & >= 32GB RAM", () => {
    const editingBuild = {
      cpu: mockCpuHigh,
      ram: mockRam32GB,
      mainboard: mockMainboardHigh
    };

    const insights = calculateBuilderInsights(editingBuild, 3, { purpose: "editing" });
    assert.equal(insights.requirementMatchScore, 96, "High CPU + 32GB RAM kit yields 96% match score for Editing");
  });

  // Test 6: Future Need Upgrade RAM Bonus
  it("adds +5 upgradeability bonus when futureNeed is 'upgrade_ram' and Mainboard has 4 slots", () => {
    const build = { mainboard: mockMainboardMid };
    const baseScore = calculateBuilderInsights(build, 1, { purpose: "office" }).requirementMatchScore;
    const bonusScore = calculateBuilderInsights(build, 1, { purpose: "office", futureNeed: "upgrade_ram" }).requirementMatchScore;

    assert.equal(bonusScore, Math.min(99, baseScore + 5));
  });

  // Test 7: System Wattage & PSU Margin Calculation
  it("computes system power draw and warns when PSU wattage margin is under 20%", () => {
    const buildFull = {
      cpu: mockCpuHigh,            // 125W (socket LGA1700)
      mainboard: mockMainboardHigh,      // LGA1700
      gpu: mockGpu4K,              // 450W
      psu: mockPsu1000W,            // 1000W
      cooling: mockCooling360       // AIO Cooler
    };

    const insights = calculateBuilderInsights(buildFull, 5, {});
    // Power = 125 + 450 + 85 = 660W
    assert.equal(insights.power, 660);
    // PSU margin = (1000 - 660) / 1000 = 34%
    assert.equal(insights.psuMarginPercent, 34);
    assert.equal(insights.buildReadiness, "WARNINGS_ACKNOWLEDGED"); // incomplete count 5 < requiredCount 8
  });

  // Test 8: RAM Quantity Multiplier & Dual-Channel slot checking
  it("multiplies RAM sticks by quantity and verifies slot capacity correctly", () => {
    const mockMainboard2Slots = {
      id: 25,
      name: "ASUS PRIME H610M-K DDR4",
      price: 1800000,
      attributes: [{ name: "ram_slots", value: "2" }]
    };
    const mockSingleStickRam = {
      id: 31,
      name: "Kingston Fury Beast 8GB DDR4 3200",
      price: 500000,
      attributes: [{ name: "ram_type", value: "DDR4" }]
    };

    // 1 stick in 2 slots => Pass (1 stick / 2 slots)
    const build1Stick = {
      mainboard: mockMainboard2Slots,
      ram: { product: mockSingleStickRam, quantity: 1 }
    };
    const insights1 = calculateBuilderInsights(build1Stick, 2, {});
    const ramSlotCheck1 = insights1.checks.find((c) => c.label.includes("Khe cắm RAM khả dụng"));
    assert.equal(ramSlotCheck1.ok, true);
    assert.ok(ramSlotCheck1.detail.includes("1 thanh RAM / 2 khe Mainboard"));

    // 2 sticks (Dual Channel toggle) in 2 slots => Pass (2 sticks / 2 slots)
    const build2Sticks = {
      mainboard: mockMainboard2Slots,
      ram: { product: mockSingleStickRam, quantity: 2 }
    };
    const insights2 = calculateBuilderInsights(build2Sticks, 2, {});
    const ramSlotCheck2 = insights2.checks.find((c) => c.label.includes("Khe cắm RAM khả dụng"));
    assert.equal(ramSlotCheck2.ok, true);
    assert.ok(ramSlotCheck2.detail.includes("2 thanh RAM / 2 khe Mainboard"));

    // 3 sticks in 2 slots => Fail
    const build3Sticks = {
      mainboard: mockMainboard2Slots,
      ram: { product: mockSingleStickRam, quantity: 3 }
    };
    const insights3 = calculateBuilderInsights(build3Sticks, 2, {});
    const ramSlotCheck3 = insights3.checks.find((c) => c.label.includes("Khe cắm RAM khả dụng"));
    assert.equal(ramSlotCheck3.ok, false);
    assert.ok(ramSlotCheck3.detail.includes("3 thanh RAM / 2 khe Mainboard"));
  });

  // Test 9: Dual M.2 SSD Slot Verification (COMP-009)
  it("verifies M.2 NVMe SSD capacity against Mainboard m2_slots correctly for dual storage", () => {
    const mockMainboard1M2 = {
      id: 26,
      name: "ASUS H510M-E",
      attributes: [{ name: "m2_slots", value: "1" }]
    };
    const mockMainboard2M2 = {
      id: 27,
      name: "B760M GAMING PLUS",
      attributes: [{ name: "m2_slots", value: "2" }]
    };

    const mockM2Ssd1 = { id: 91, name: "Samsung 980 Pro 1TB NVMe M.2", attributes: [{ name: "storage_type", value: "M.2 NVMe" }] };
    const mockM2Ssd2 = { id: 92, name: "Kingston NV2 500GB NVMe M.2", attributes: [{ name: "storage_type", value: "M.2 NVMe" }] };
    const mockSataHdd = { id: 93, name: "Seagate 1TB SATA 3.5 HDD", attributes: [{ name: "storage_type", value: "SATA" }] };

    // 2 M.2 SSDs on 1 M.2 slot Mainboard => Fail
    const buildFail = {
      mainboard: mockMainboard1M2,
      storage: mockM2Ssd1,
      storage_2: mockM2Ssd2
    };
    const insightsFail = calculateBuilderInsights(buildFail, 3, {});
    const m2CheckFail = insightsFail.checks.find((c) => c.label.includes("COMP-009"));
    assert.equal(m2CheckFail.ok, false);
    assert.ok(m2CheckFail.detail.includes("2 ổ M.2 NVMe / 1 khe Mainboard"));

    // 2 M.2 SSDs on 2 M.2 slot Mainboard => Pass
    const buildPass = {
      mainboard: mockMainboard2M2,
      storage: mockM2Ssd1,
      storage_2: mockM2Ssd2
    };
    const insightsPass = calculateBuilderInsights(buildPass, 3, {});
    const m2CheckPass = insightsPass.checks.find((c) => c.label.includes("COMP-009"));
    assert.equal(m2CheckPass.ok, true);
    assert.ok(m2CheckPass.detail.includes("2 ổ M.2 NVMe / 2 khe Mainboard"));

    // 1 M.2 SSD + 1 SATA HDD on 1 M.2 slot Mainboard => Pass (only 1 M.2 used)
    const buildSataPass = {
      mainboard: mockMainboard1M2,
      storage: mockM2Ssd1,
      storage_2: mockSataHdd
    };
    const insightsSataPass = calculateBuilderInsights(buildSataPass, 3, {});
    const m2CheckSata = insightsSataPass.checks.find((c) => c.label.includes("COMP-009"));
    assert.equal(m2CheckSata.ok, true);
    assert.ok(m2CheckSata.detail.includes("1 ổ M.2 NVMe / 1 khe Mainboard"));
  });

  // Test 10: Stock cooler exclusion for unlocked/high-end CPUs (COMP-005)
  it("enforces separate cooling requirement for Intel K/KF/KS/Ultra and AMD X/X3D CPUs even if marked box", () => {
    const mockCpuUnlocked = {
      id: 101,
      name: "CPU Intel Core i7-14700K Boxed Chính Hãng",
      attributes: [{ name: "tdp", value: "253" }, { name: "socket", value: "LGA1700" }]
    };
    const mockCpuRegularBoxed = {
      id: 102,
      name: "CPU Intel Core i5-12400 Boxed",
      attributes: [{ name: "tdp", value: "65" }, { name: "socket", value: "LGA1700" }]
    };

    // Unlocked 14700K without cooler => cooling required, check COMP-005 fails
    const insightsUnlocked = calculateBuilderInsights({ cpu: mockCpuUnlocked }, 1, {});
    const coolerCheckUnlocked = insightsUnlocked.checks.find(c => c.label.includes("COMP-005"));
    assert.equal(coolerCheckUnlocked.ok, false);
    assert.ok(coolerCheckUnlocked.detail.includes("Bắt buộc chọn tản nhiệt rời"));

    // Regular i5-12400 Boxed without cooler => cooling optional, check COMP-005 passes
    const insightsRegular = calculateBuilderInsights({ cpu: mockCpuRegularBoxed }, 1, {});
    const coolerCheckRegular = insightsRegular.checks.find(c => c.label.includes("COMP-005"));
    assert.equal(coolerCheckRegular.ok, true);
    assert.ok(coolerCheckRegular.detail.includes("CPU có kèm tản stock"));
  });

  // Test 11: PCIe bandwidth warning for legacy APU with flagship GPU (COMP-003)
  it("triggers PCIe bandwidth warning when Pairing legacy APU with limited PCIe lanes with high-end GPU", () => {
    const mockApu = {
      id: 103,
      name: "CPU AMD Ryzen 5 3400G (4 Cores / 8 Threads)",
      attributes: [{ name: "socket", value: "AM4" }]
    };
    const mockMb = {
      id: 104,
      name: "Mainboard ASUS PRIME B550M-A",
      attributes: [{ name: "socket", value: "AM4" }]
    };
    const mockFlagshipGpu = {
      id: 105,
      name: "Card màn hình Asus ROG ASTRAL RTX 5080 16G GAMING",
      attributes: [{ name: "tdp", value: "350" }]
    };

    const insights = calculateBuilderInsights({
      cpu: mockApu,
      mainboard: mockMb,
      gpu: mockFlagshipGpu
    }, 3, {});

    const pcieCheck = insights.checks.find(c => c.label.includes("COMP-003"));
    assert.equal(pcieCheck.ok, false);
    assert.equal(pcieCheck.severity, "WARNING");
    assert.ok(pcieCheck.detail.includes("APU chỉ cấp 8 làn PCIe x8"));
  });
});

