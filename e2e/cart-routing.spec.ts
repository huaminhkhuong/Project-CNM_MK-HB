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

    // Must render CartPage heading and empty state
    await expect(page.getByRole("heading", { name: "Giỏ hàng", exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Giỏ hàng siêu nhẹ" })).toBeVisible({ timeout: 10000 });

    // Ensure Not Found Page is NOT displayed
    await expect(page.locator("text=/404|Không tìm thấy trang/i")).toHaveCount(0);
  });

  test("2. Access to /giohang redirects automatically to /cart", async ({ page }) => {
    await page.goto("/giohang");
    await page.waitForLoadState("networkidle");

    // Should redirect to /cart
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.getByRole("heading", { name: "Giỏ hàng", exact: true })).toBeVisible({ timeout: 10000 });
  });

  test("3. Data consistency between /cart and /gio-hang with items in cart", async ({ page }) => {
    // Add item to cart via Product Detail Page (Product 3: Asus B760M)
    await page.goto("/products/3");
    await page.waitForLoadState("networkidle");

    const addBtn = page.locator("#btn-add-to-cart, button:has-text('Thêm vào giỏ hàng')").first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // Verify feedback
    await expect(page.locator("text=/Đã thêm|thành công/i").first()).toBeVisible({ timeout: 10000 });

    // Step A: Visit /cart
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Giỏ hàng", exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("article.cart-item-card")).toHaveCount(1, { timeout: 10000 });
    
    // Grab product title
    const productTitleInCart = await page.locator("article.cart-item-card h3, article.cart-item-card h4").first().textContent();

    // Step B: Navigate to /gio-hang
    await page.goto("/gio-hang");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Giỏ hàng", exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("article.cart-item-card")).toHaveCount(1, { timeout: 10000 });

    const productTitleInGioHang = await page.locator("article.cart-item-card h3, article.cart-item-card h4").first().textContent();
    expect(productTitleInGioHang?.trim()).toBe(productTitleInCart?.trim());

    // Both pages must show the checkout button
    await expect(page.getByRole("button", { name: /XÁC NHẬN THANH TOÁN|ĐĂNG NHẬP ĐỂ THANH TOÁN/i })).toBeVisible();
  });

  test("4. Checkout button on /gio-hang correctly leads to checkout flow", async ({ page }) => {
    // Add item first
    await page.goto("/products/3");
    await page.waitForLoadState("networkidle");
    const addBtn = page.locator("#btn-add-to-cart, button:has-text('Thêm vào giỏ hàng')").first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();
    await expect(page.locator("text=/Đã thêm|thành công/i").first()).toBeVisible({ timeout: 10000 });

    // Navigate to /gio-hang
    await page.goto("/gio-hang");
    await page.waitForLoadState("networkidle");

    const checkoutBtn = page.getByRole("button", { name: /XÁC NHẬN THANH TOÁN|ĐĂNG NHẬP ĐỂ THANH TOÁN/i });
    await expect(checkoutBtn).toBeVisible({ timeout: 10000 });
    await checkoutBtn.click();

    // As guest, button directs to /login (with redirect state to /checkout) or /checkout
    await expect(page).toHaveURL(/\/login|\/checkout/, { timeout: 10000 });
  });

  test("5. Payment & Checkout aliases (/thanh-toan and /thanhtoan) routing", async ({ page }) => {
    // Visit /thanh-toan
    await page.goto("/thanh-toan", { waitUntil: "domcontentloaded" });

    // Checkout page or login redirect if required, but definitely NOT 404
    await expect(page.locator("text=/404|Không tìm thấy trang/i")).toHaveCount(0);
    expect(page.url()).toContain("thanh-toan");

    // Visit /thanhtoan -> redirects to /checkout
    await page.goto("/thanhtoan", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/checkout/, { timeout: 10000 });
    await expect(page.locator("text=/404|Không tìm thấy trang/i")).toHaveCount(0);
  });
});
