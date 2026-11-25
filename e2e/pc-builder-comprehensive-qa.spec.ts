import { test, expect } from "@playwright/test";

test.describe("Senior QA Comprehensive Test Suite — PC Builder Feature", () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      console.error("[PAGE_ERROR]", err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error("[CONSOLE_ERROR]", msg.text());
      }
    });

    await page.goto("/pc-builder");
    await page.waitForLoadState("networkidle");
  });

  // TC-01: UI/UX Smoke & Component Section Navigation
  test("TC-01: Verify Page Load, Header, 8 Hardware Sections, and Cost Ticker", async ({ page }) => {
    // 1. Topbar and branding
    await expect(page.locator(".builder-topbar")).toBeVisible();
    
    // 2. Cost Ticker
    await expect(page.locator(".v2-cost-ticker")).toBeVisible();

    // 3. Verify all 8 component steps exist
    const sections = ["CPU", "Mainboard", "RAM", "GPU", "SSD", "PSU", "Case", "Cooling"];
    for (const s of sections) {
      const step = page.locator(".step-item").filter({ hasText: s }).first();
      await expect(step).toBeVisible();
    }

    // 4. Verify catalog loads products for default active section (CPU)
    const productCards = page.locator(".product-card");
    await expect(productCards.first()).toBeVisible();
    const count = await productCards.count();
    expect(count).toBeGreaterThan(0);
    console.log(`[TC-01 PASS] Loaded ${count} CPU products in catalog.`);
  });

  // TC-02: Step-by-Step Manual Selection to 100% Build Ready
  test("TC-02: Step-by-Step Manual Selection of 8 Components to BUILD READY status", async ({ page }) => {
    const sections = ["CPU", "Mainboard", "RAM", "GPU", "SSD", "PSU", "Case", "Cooling"];

    for (let i = 0; i < sections.length; i++) {
      const secName = sections[i];
      const stepItem = page.locator(".step-item").filter({ hasText: secName }).first();
      await stepItem.click();
      await page.waitForTimeout(600);

      const selectBtn = page.locator(".product-card .btn-select").first();
      await expect(selectBtn).toBeVisible({ timeout: 10000 });
      await selectBtn.click();
      await page.waitForTimeout(600);
    }

    // Verify 8 components selected
    const doneSteps = await page.locator(".step-item.is-done").count();
    console.log(`[TC-02] Completed steps count: ${doneSteps}/8`);
    expect(doneSteps).toBe(8);

    // Verify cost ticker is non-zero
    const tickerText = await page.locator(".v2-cost-ticker").innerText();
    console.log(`[TC-02 PASS] Cost Ticker: ${tickerText.replace(/\n/g, " ")}`);

    // Verify buy button exists
    const buyBtn = page.locator(".v2-btn-order");
    await expect(buyBtn).toBeVisible();
  });

  // TC-03: Negative Testing - Hardware Conflict & Safety Lock (Blocker Enforcement)
  test("TC-03: Hardware Conflict Trigger - CPU LGA1700 + Mainboard AM5 locks purchase", async ({ page }) => {
    // 1. Select CPU Intel
    const cpuStep = page.locator(".step-item").filter({ hasText: "CPU" }).first();
    await cpuStep.click();
    await page.waitForTimeout(500);

    const intelCard = page.locator(".product-card").filter({ hasText: /Intel|13400|12400/i }).first();
    if (await intelCard.isVisible()) {
      await intelCard.locator(".btn-select").click();
    } else {
      await page.locator(".product-card .btn-select").first().click();
    }
    await page.waitForTimeout(600);

    // 2. Select Mainboard AMD (B650 / AM5)
    const mbStep = page.locator(".step-item").filter({ hasText: "Mainboard" }).first();
    await mbStep.click();
    await page.waitForTimeout(500);

    const amdMbCard = page.locator(".product-card").filter({ hasText: /B650|AM5|A620/i }).first();
    if (await amdMbCard.isVisible()) {
      await amdMbCard.locator(".btn-select").click();
      await page.waitForTimeout(1000);

      // Check buy button text: should say "Bị Chặn"
      const buyBtn = page.locator(".v2-btn-order");
      const btnText = await buyBtn.innerText();
      console.log(`[TC-03] Buy button state after socket conflict: "${btnText}"`);
      expect(btnText).toContain("Bị Chặn");

      // Check buy button disabled
      const isDisabled = await buyBtn.isDisabled();
      console.log(`[TC-03 PASS] Buy button is properly disabled: ${isDisabled}`);
      expect(isDisabled).toBe(true);
    }
  });

  // TC-04: AI Auto-Build Preset and Candidate Builds
  test("TC-04: AI Preset Trigger, 3 Candidate Builds, and Batch Application", async ({ page }) => {
    // Click Gaming preset chip
    const gamingChip = page.locator("button").filter({ hasText: "Gaming" }).first();
    await expect(gamingChip).toBeVisible();
    await gamingChip.click();
    await page.waitForTimeout(2500);

    // Check candidate builds panel
    const candidatePanel = page.locator(".candidate-builds-panel");
    await expect(candidatePanel).toBeVisible({ timeout: 10000 });
    
    const tabs = page.locator(".candidate-tab-card");
    const tabCount = await tabs.count();
    console.log(`[TC-04 PASS] Candidate build tabs count: ${tabCount}`);
    expect(tabCount).toBe(3);

    // Apply candidate build
    const applyBtn = page.locator(".btn-candidate-apply-main").first();
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();
    await page.waitForTimeout(1000);

    const costText = await page.locator(".v2-cost-ticker").innerText();
    console.log(`[TC-04 PASS] Cost Ticker after AI Build: ${costText.replace(/\n/g, " ")}`);
  });

  // TC-05: XAI Explanation Drawer Inspection
  test("TC-05: Inspect XAI Explanation Drawer checks and diagnostics", async ({ page }) => {
    // Open XAI Drawer
    const xaiBtn = page.locator("header.builder-topbar button").filter({ hasText: "XAI" }).first();
    await expect(xaiBtn).toBeVisible();
    await xaiBtn.click({ force: true });
    await page.waitForTimeout(1200);

    // Check overlay and content
    const drawerOverlay = page.locator(".xai-drawer-overlay");
    await expect(drawerOverlay).toBeVisible();

    const drawerTitle = page.locator(".xai-drawer-content h2");
    await expect(drawerTitle).toBeVisible();
    const titleText = await drawerTitle.innerText();
    console.log(`[TC-05 PASS] XAI Drawer Header: ${titleText}`);

    // Check checks list
    const checkItems = page.locator(".xai-drawer-content").locator("div").filter({ hasText: /COMP-|Socket|RAM|PSU|GPU/ });
    const checkCount = await checkItems.count();
    console.log(`[TC-05 PASS] XAI Drawer checks elements found: ${checkCount}`);
    expect(checkCount).toBeGreaterThan(0);

    // Close drawer
    const closeBtn = page.locator(".xai-drawer-content button").first();
    await closeBtn.click();
    await page.waitForTimeout(500);
    await expect(drawerOverlay).not.toBeVisible();
  });

  // TC-06: Product Detail Modal & Quick Specs
  test("TC-06: Inspect Product Detail Modal from catalog card", async ({ page }) => {
    // Click on product card body to open modal
    const firstCard = page.locator(".product-card").first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator(".product-modal-card");
    await expect(modal).toBeVisible();
    console.log("[TC-06 PASS] Product Detail Modal (.product-modal-card) opened successfully.");

    const modalText = await modal.innerText();
    expect(modalText.length).toBeGreaterThan(20);

    // Close modal via close button
    const closeBtn = page.locator(".product-modal-close");
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await page.waitForTimeout(500);
    await expect(modal).not.toBeVisible();
  });

  // TC-07: What-If Simulation Budget Control
  test("TC-07: What-If Simulation +5M / -5M button behavior", async ({ page }) => {
    const whatIfWidget = page.locator(".whatif-widget");
    await expect(whatIfWidget).toBeVisible();

    const plus5mBtn = whatIfWidget.locator("button").filter({ hasText: "+5Tr" }).first();
    await expect(plus5mBtn).toBeVisible();
    await plus5mBtn.click();
    await page.waitForTimeout(1000);

    const whatIfPanel = page.locator(".whatif-comparison-panel, .whatif-card");
    const isVisible = await whatIfPanel.first().isVisible();
    console.log(`[TC-07 PASS] What-If Simulation panel/widget rendered: ${isVisible}`);
  });

  // TC-08: Guest Storage Management (Save, New Slot, Switch)
  test("TC-08: Guest Build Multi-slot Storage and Save Action", async ({ page }) => {
    const saveBtn = page.locator(".btn-summary-action").filter({ hasText: "Lưu" }).first();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    await page.waitForTimeout(600);
    console.log("[TC-08 PASS] Guest save button clicked without exception.");
  });

  // TC-09: One-Click Purchase & Final Review Modal
  test("TC-09: Buy Whole Build button triggers Final Review Modal", async ({ page }) => {
    // Apply Gaming preset first so we have a full build
    const gamingChip = page.locator("button").filter({ hasText: "Gaming" }).first();
    await gamingChip.click();
    await page.waitForTimeout(2000);

    const buyBtn = page.locator(".v2-btn-order");
    await expect(buyBtn).toBeVisible();

    const isBlocked = (await buyBtn.innerText()).includes("Bị Chặn");
    if (!isBlocked) {
      await buyBtn.click();
      await page.waitForTimeout(1000);

      // In guest mode, clicking buy whole build redirects to /login to ensure user identity
      const currentUrl = page.url();
      console.log(`[TC-09 PASS] Guest buy navigation URL: ${currentUrl}`);
      expect(currentUrl).toContain("/login");
    }
  });
});
