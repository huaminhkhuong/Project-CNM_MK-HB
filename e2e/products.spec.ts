import { test, expect } from "@playwright/test";

test.describe("Products", () => {
  test("should display products list", async ({ page }) => {
    await page.goto("/products");
    
    // Should show product cards
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
  });

  test("should filter products by category", async ({ page }) => {
    await page.goto("/products");
    
    // Click category filter item directly
    const catBtn = page.locator('button').filter({ hasText: /CPU|Mainboard/i }).first();
    await expect(catBtn).toBeVisible();
    await catBtn.click();
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Should still show products
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
  });

  test("should navigate to product detail", async ({ page }) => {
    await page.goto("/products");
    
    // Click first product card link
    const firstCard = page.locator('[data-testid="product-card"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.locator("a").first().click();
    
    // Should be on product detail page
    await expect(page).toHaveURL(/\/products\/[^/]+/, { timeout: 10000 });
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
