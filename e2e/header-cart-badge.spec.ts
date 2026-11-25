import { test, expect } from "@playwright/test";

test.describe("Header Cart Badge [BUG-003]", () => {
  test.describe.configure({ mode: "serial" });

  test("Cart badge updates immediately when adding product as Guest", async ({ page }) => {
    // 1. Visit Homepage as Guest and clear any existing guest cart
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("cnm_guest_cart_v1");
      window.dispatchEvent(new CustomEvent("cnm_cart_changed"));
    });
    await page.waitForTimeout(500);

    // Initial badge should not exist when cart is empty
    const badge = page.locator("#header-cart-badge");
    await expect(badge).toHaveCount(0);

    // 2. Go to product detail page (Product 3: stock > 10)
    await page.goto("/products/3");
    await page.waitForLoadState("networkidle");

    // 3. Click Add to Cart button
    const addBtn = page.locator("#btn-add-to-cart, button:has-text('Thêm vào giỏ hàng')").first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();

    // 4. Verify feedback on page
    await expect(page.locator("text=/Đã thêm|thành công/i").first()).toBeVisible({ timeout: 5000 });

    // 5. Header Cart Badge MUST be visible and show at least '1'
    await expect(badge).toBeVisible({ timeout: 5000 });
    const countText = await badge.textContent();
    expect(Number(countText)).toBeGreaterThanOrEqual(1);
  });

  test("Cart badge updates immediately when adding product as Logged-in Customer", async ({ page }) => {
    // 1. Login
    await page.goto("/login");
    await page.fill('input[name="email"]', "customer@pcmall.vn");
    await page.fill('input[name="password"]', "Customer@123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/(profile|home|$)/, { timeout: 10000 });

    // 2. Go to product detail page (Product 3: Asus B760M, stock = 15)
    await page.goto("/products/3");
    await page.waitForLoadState("networkidle");

    const badge = page.locator("#header-cart-badge");
    let initialCount = 0;
    if (await badge.isVisible().catch(() => false)) {
      initialCount = Number(await badge.textContent()) || 0;
    }

    // 3. Click Add to Cart
    const addBtn = page.locator("#btn-add-to-cart, button:has-text('Thêm vào giỏ hàng')").first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();

    // 4. Verify feedback
    await expect(page.locator("text=/Đã thêm|thành công/i").first()).toBeVisible({ timeout: 5000 });

    // 5. Cart badge MUST update immediately (initialCount + 1)
    await expect(badge).toBeVisible({ timeout: 5000 });
    await expect(badge).toHaveText(String(initialCount + 1), { timeout: 5000 });
  });

  test("Cart badge synchronizes in real time when cart items are updated in CartPage", async ({ page }) => {
    // 1. Login
    await page.goto("/login");
    await page.fill('input[name="email"]', "customer@pcmall.vn");
    await page.fill('input[name="password"]', "Customer@123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/(profile|home|$)/, { timeout: 10000 });

    // 2. Add Product 2 (stock = 5) to ensure we can increase quantity
    await page.goto("/products/2");
    await page.waitForLoadState("networkidle");
    const addBtn = page.locator("#btn-add-to-cart, button:has-text('Thêm vào giỏ hàng')").first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();
    await page.waitForTimeout(1000);

    // 3. Go to /cart
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const badge = page.locator("#header-cart-badge");
    await expect(badge).toBeVisible();
    const countBefore = Number(await badge.textContent()) || 0;

    // 4. Click + button on Product 2
    const plusBtn = page.locator(".qty-btn:has-text('+')").first();
    await expect(plusBtn).toBeEnabled({ timeout: 5000 });
    await plusBtn.click();

    // Badge must increment by 1
    await expect(badge).toHaveText(String(countBefore + 1), { timeout: 5000 });

    // 5. Click - button to decrement back
    const minusBtn = page.locator(".qty-btn:has-text('−')").first();
    await minusBtn.click();

    // Badge returns to countBefore
    await expect(badge).toHaveText(String(countBefore), { timeout: 5000 });

    // 6. Test removing item
    const removeBtn = page.locator("button[title='Xóa khỏi giỏ hàng']").first();
    await removeBtn.click();
    await page.waitForTimeout(1000);

    // If items remain, badge is lower; if empty, badge disappears
    if (countBefore - 1 > 0) {
      await expect(badge).toHaveText(String(countBefore - 1), { timeout: 5000 });
    } else {
      await expect(badge).toHaveCount(0, { timeout: 5000 });
    }
  });
});
