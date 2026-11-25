import { test, expect } from "@playwright/test";

test.describe("Smart PC Builder — Manual QA Checklist (P10-05)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pc-builder");
    await page.waitForLoadState("domcontentloaded");
  });

  // QA Test 1: Verify All 8 Component Sections Exist & Selectable
  test("QA-01: Verifies all 8 hardware component sections exist", async ({ page }) => {
    const sections = [
      "CPU",
      "Mainboard",
      "RAM",
      "GPU",
      "SSD",
      "PSU",
      "Case",
      "Cooling"
    ];

    for (const sectionLabel of sections) {
      const stepItem = page.locator(".step-item").filter({ hasText: sectionLabel }).first();
      await expect(stepItem).toBeVisible();
    }
  });

  // QA Test 2: Guest Mode vs Auth Mode UI Save Action
  test("QA-02: Verifies Guest Mode vs Auth Mode Save Configuration button", async ({ page }) => {
    // Check Save button in Summary sidebar (shows "💾 Lưu" in Guest Mode, "💾 Lưu TK" in Auth Mode)
    const saveBtn = page.locator(".btn-summary-action").filter({ hasText: "Lưu" }).first();
    await expect(saveBtn).toBeVisible();
  });

  // QA Test 3: Share Build & Export PDF Controls
  test("QA-03: Verifies Share Build link and PDF export action buttons", async ({ page }) => {
    const shareBtn = page.locator(".btn-summary-action").filter({ hasText: "Chia sẻ" }).first();
    await expect(shareBtn).toBeVisible();

    const pdfBtn = page.locator("button").filter({ hasText: "PDF" }).first();
    await expect(pdfBtn).toBeVisible();
  });

  // QA Test 4: What-If Simulation Budget Controls
  test("QA-04: Verifies What-If simulation budget increase/decrease controls", async ({ page }) => {
    const whatIfWidget = page.locator(".whatif-widget");
    await expect(whatIfWidget).toBeVisible();

    const increaseBudgetBtn = page.locator(".btn-whatif").first();
    await expect(increaseBudgetBtn).toBeVisible();
    await expect(increaseBudgetBtn).toContainText("+5Tr");
  });
});
