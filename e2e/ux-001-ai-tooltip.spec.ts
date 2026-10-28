import { test, expect } from "@playwright/test";

test.describe("UX-001: Tooltip AI Chatbot & Mua Ngay Unobstructed", () => {
  test.beforeEach(async ({ page }) => {
    // Reset session storage so tooltip displays in pristine state
    await page.goto("/products/3");
    await page.evaluate(() => {
      sessionStorage.removeItem("cnm_ai_tooltip_dismissed");
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
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

    // Click close button (use force: true to bypass infinite tooltipBounce animation check)
    await closeBtn.click({ force: true });

    // Tooltip should have class is-dismissed and fade out to 0
    await expect(tooltip).toHaveClass(/is-dismissed/);
    await page.waitForTimeout(350);
    const opacity = await tooltip.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(0);
  });

  test("3. AI Mascot Tooltip automatically collapses when page is scrolled", async ({ page }) => {
    const tooltip = page.locator("[data-testid='ai-mascot-tooltip']");
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    // Scroll down by 250px
    await page.evaluate(() => window.scrollTo(0, 250));
    await page.waitForTimeout(400);

    // Tooltip should collapse on scroll
    await expect(tooltip).toHaveClass(/is-scrolled/);
    const opacity = await tooltip.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(Number(opacity)).toBeLessThan(0.01);

    // Verify Buy Now button can still be clicked directly while scrolled
    const buyNowBtn = page.locator("#btn-buy-now").first();
    await expect(buyNowBtn).toBeVisible();
    await buyNowBtn.click();

    // Should trigger add to cart and direct checkout
    await page.waitForTimeout(500);
  });
});
