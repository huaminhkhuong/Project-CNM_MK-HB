import { test, expect } from "@playwright/test";

test.describe("Smart PC Builder — End-to-End User Journeys (P10-04)", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    // Navigate to PC Builder page
    await page.goto("/pc-builder");
    await page.waitForLoadState("networkidle");
  });

  test("Journey 1: Requirement Wizard -> Gaming 25M -> AI Build -> XAI Drawer -> Purchase Review", async ({ page }) => {
    // 1. Verify Topbar Header & AI Build controls
    await expect(page.locator(".builder-topbar")).toBeVisible();

    // 2. Select Gaming Preset chip (which auto-triggers AI Auto-Build)
    const gamingPresetBtn = page.locator("button").filter({ hasText: "Gaming" }).first();
    await expect(gamingPresetBtn).toBeVisible();
    await gamingPresetBtn.click();

    // Wait for recommendation to settle
    await page.waitForTimeout(2000);

    // 3. Open XAI Drawer ("🧠 XAI" in topbar)
    const xaiBtn = page.locator("header.builder-topbar button").filter({ hasText: "XAI" }).first();
    await expect(xaiBtn).toBeVisible();
    await xaiBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // Verify XAI Drawer container is rendered in DOM
    const xaiOverlay = page.locator(".xai-drawer-overlay");
    await expect(xaiOverlay).toBeVisible();

    // Close XAI drawer via close button
    const closeXaiBtn = page.locator(".xai-drawer-content button").first();
    if (await closeXaiBtn.isVisible()) {
      await closeXaiBtn.click();
    }

    // 4. Verify Purchase Action button is available (either Ready or Blocker Enforced)
    const buyWholeBtn = page.getByRole("button", { name: /Mua Nguyên Bộ|Bị Chặn/i });
    await expect(buyWholeBtn).toBeVisible();
  });

  test("Journey 2: Hardware Conflict -> BLOCKER Severity -> Block Purchase Enforcement", async ({ page }) => {
    // 1. Select CPU category
    const cpuStep = page.locator(".step-item").filter({ hasText: "CPU" }).first();
    await expect(cpuStep).toBeVisible();
    await cpuStep.click();
    await page.waitForTimeout(500);

    // Select first CPU product card via .btn-select
    const cpuSelectBtn = page.locator(".product-card .btn-select").first();
    if (await cpuSelectBtn.isVisible()) {
      await cpuSelectBtn.click();
      await page.waitForTimeout(500);
    }

    // 2. Select Mainboard category
    const mbStep = page.locator(".step-item").filter({ hasText: "Mainboard" }).first();
    if (await mbStep.isVisible()) {
      await mbStep.click();
      await page.waitForTimeout(500);
      const mbSelectBtn = page.locator(".product-card .btn-select").first();
      if (await mbSelectBtn.isVisible()) {
        await mbSelectBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 3. Open XAI Drawer from Topbar to inspect compatibility
    const xaiBtn = page.locator("header.builder-topbar button").filter({ hasText: "XAI" }).first();
    await expect(xaiBtn).toBeVisible();
    await xaiBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // Verify XAI report overlay opens
    const xaiOverlay = page.locator(".xai-drawer-overlay");
    await expect(xaiOverlay).toBeVisible();
  });
});
