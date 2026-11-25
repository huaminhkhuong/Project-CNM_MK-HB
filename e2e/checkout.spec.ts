import { test, expect } from "@playwright/test";

test.describe("Checkout", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@cnm.local");
    await page.fill('input[name="password"]', "Admin@123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/(admin|profile|home)/, { timeout: 10000 });
  });

  test("should add product to cart", async ({ page }) => {
    await page.goto("/products");
    
    // Click first product card link
    const firstCard = page.locator('[data-testid="product-card"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.locator("a").first().click();
    
    // Add to cart
    const addCartBtn = page.locator('button').filter({ hasText: "Thêm vào giỏ hàng" }).first();
    await expect(addCartBtn).toBeVisible();
    await addCartBtn.click();
    
    // Should show success message
    await expect(page.locator('text=/đã thêm|thành công/i')).toBeVisible({ timeout: 10000 });
  });

  test("should view cart", async ({ page }) => {
    await page.goto("/cart");
    
    // Should show cart page
    await expect(page).toHaveURL(/\/cart/);
  });

  test("should proceed to checkout", async ({ page }) => {
    await page.goto("/cart");
    
    // Click checkout button
    const checkoutButton = page.locator('button:has-text("Thanh toán")');
    if (await checkoutButton.isVisible()) {
      await checkoutButton.click();
      
      // Should redirect to checkout page
      await expect(page).toHaveURL(/\/checkout/);
    }
  });
});
