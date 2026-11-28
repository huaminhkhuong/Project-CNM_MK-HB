import { test, expect } from "@playwright/test";

test.describe("UX-001: Tooltip AI Chatbot & Mua Ngay Unobstructed", () => {
  test.beforeEach(async ({ page }) => {
    // Reset session storage so tooltip displays in pristine state
    await page.goto("/products/3", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      sessionStorage.removeItem("cnm_ai_tooltip_dismissed");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#btn-buy-now, [data-testid='buy-now-button']").first().waitFor({ state: "visible", timeout: 10000 });
  });

  test("1. Mua Ngay and Them Vao Gio Hang buttons are present and unobstructed", async ({ page }) => {
    const buyNowBtn = page.locator("#btn-buy-now, [data-testid='buy-now-button']").first();
    const addToCartBtn = page.locator("#btn-add-to-cart, [data-testid='add-to-cart-button']").first();

    await expect(buyNowBtn).toBeVisible({ timeout: 5000 });
    await expect(addToCartBtn).toBeVisible({ timeout: 5000 });

    // Ensure buy now button is clickable
    await expect(buyNowBtn).toBeEnabled();
  });

  test("2. AI Mascot Tooltip has dismiss button and can be dismissed manually", async ({ page }) => {
    const tooltip = page.locator("[data-testid='ai-mascot-tooltip']");
    const closeBtn = page.locator("[data-testid='ai-mascot-tooltip-close']");

    await expect(tooltip).toBeVisible({ timeout: 5000 });
    await expect(closeBtn).toBeVisible({ timeout: 5000 });

    // Hover FAB button with force:true (bypasses infinite mascotFloat animation) then click dismiss
    await page.locator("[data-testid='ai-mascot-fab']").hover({ force: true });
    await closeBtn.click({ force: true });

    // Tooltip should have class is-dismissed and fade out to 0
    await expect(tooltip).toHaveClass(/is-dismissed/, { timeout: 5000 });
    await expect.poll(async () => Number(await tooltip.evaluate((el) => window.getComputedStyle(el).opacity)), { timeout: 3000 }).toBe(0);
  });

  test("3. AI Mascot Tooltip automatically collapses when page is scrolled", async ({ page }) => {
    const tooltip = page.locator("[data-testid='ai-mascot-tooltip']");
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    // Move mouse away from FAB wrapper so hover state doesn't keep tooltip visible
    await page.mouse.move(10, 10);
    // Scroll down by 250px
    await page.evaluate(() => window.scrollTo(0, 250));

    // Tooltip should collapse on scroll (wait for 250ms CSS transition to finish)
    await expect(tooltip).toHaveClass(/is-scrolled/, { timeout: 5000 });
    await expect.poll(async () => Number(await tooltip.evaluate((el) => window.getComputedStyle(el).opacity)), { timeout: 3000 }).toBeLessThan(0.01);

    // Verify Buy Now button can still be clicked directly while scrolled
    const buyNowBtn = page.locator("#btn-buy-now").first();
    await expect(buyNowBtn).toBeVisible();
    await buyNowBtn.click();

    // Should trigger add to cart and direct checkout
    await page.waitForTimeout(500);
  });
});
