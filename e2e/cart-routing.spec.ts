import { test, expect } from "@playwright/test";

test.describe("Cart & Checkout Routing Consistency [BUG-005]", () => {
  test.beforeEach(async ({ page }) => {
    // Reset guest cart
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("cnm_guest_cart_v1");
      sessionStorage.removeItem("cnm_applied_coupon");
      window.dispatchEvent(new CustomEvent("cnm_cart_changed"));
    });
    await page.waitForTimeout(300);
  });

  test("1. Direct access to /gio-hang renders CartPage with empty state (No 404)", async ({ page }) => {
    await page.goto("/gio-hang");
    await page.waitForLoadState("networkidle");

    // Must render CartPage container and empty state
    await expect(page.locator("[data-testid='cart-page']")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("[data-testid='cart-empty-state']")).toBeVisible({ timeout: 5000 });

    // Ensure Not Found Page is NOT displayed
    await expect(page.locator("text=/404|Không tìm thấy trang/i")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Giỏ hàng", exact: true })).toBeVisible();
  });

  test("2. Access to /giohang redirects automatically to /cart", async ({ page }) => {
    await page.goto("/giohang");
    await page.waitForLoadState("networkidle");

    // Should redirect to /cart
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.locator("[data-testid='cart-page']")).toBeVisible({ timeout: 5000 });
  });

  test("3. Data consistency between /cart and /gio-hang with items in cart", async ({ page }) => {
    // Add item to cart via Product Detail Page (Product 3: Asus B760M)
    await page.goto("/products/3");
    await page.waitForLoadState("networkidle");

    const addBtn = page.locator("#btn-add-to-cart, button:has-text('Thêm vào giỏ hàng')").first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();

    // Verify feedback
    await expect(page.locator("text=/Đã thêm|thành công/i").first()).toBeVisible({ timeout: 5000 });

    // Step A: Visit /cart
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-testid='cart-page']")).toBeVisible();
    await expect(page.locator("[data-testid='cart-item']")).toHaveCount(1);
    
    // Grab product title and total amount text
    const productTitleInCart = await page.locator("[data-testid='cart-item'] h3, [data-testid='cart-item'] h4").first().textContent();

    // Step B: Navigate to /gio-hang
    await page.goto("/gio-hang");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-testid='cart-page']")).toBeVisible();
    await expect(page.locator("[data-testid='cart-item']")).toHaveCount(1);

    const productTitleInGioHang = await page.locator("[data-testid='cart-item'] h3, [data-testid='cart-item'] h4").first().textContent();
    expect(productTitleInGioHang?.trim()).toBe(productTitleInCart?.trim());

    // Both pages must show the checkout button
    await expect(page.locator("[data-testid='cart-checkout-button']")).toBeVisible();
  });

  test("4. Checkout button on /gio-hang correctly leads to checkout flow", async ({ page }) => {
    // Add item first
    await page.goto("/products/3");
    await page.waitForLoadState("networkidle");
    const addBtn = page.locator("#btn-add-to-cart, button:has-text('Thêm vào giỏ hàng')").first();
    await addBtn.click();
    await expect(page.locator("text=/Đã thêm|thành công/i").first()).toBeVisible({ timeout: 5000 });

    // Navigate to /gio-hang
    await page.goto("/gio-hang");
    await page.waitForLoadState("networkidle");

    const checkoutBtn = page.locator("[data-testid='cart-checkout-button']");
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.click();

    // As guest, button directs to /login?redirect=/checkout
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout|\/checkout/);
  });

  test("5. Payment & Checkout aliases (/thanh-toan and /thanhtoan) routing", async ({ page }) => {
    // Visit /thanh-toan
    await page.goto("/thanh-toan");
    await page.waitForLoadState("networkidle");

    // Checkout page or login redirect if required, but definitely NOT 404
    await expect(page.locator("text=/404|Không tìm thấy trang/i")).toHaveCount(0);
    expect(page.url()).toContain("thanh-toan");

    // Visit /thanhtoan -> redirects to /checkout
    await page.goto("/thanhtoan");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator("text=/404|Không tìm thấy trang/i")).toHaveCount(0);
  });
});
