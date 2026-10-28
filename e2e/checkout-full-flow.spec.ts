import { test, expect } from "@playwright/test";

test.describe("E2E Full Checkout Flow [BUG-002]", () => {
  test.describe.configure({ mode: "serial" });

  test("Complete 4-step checkout journey from cart to order placement", async ({ page }) => {
    // 1. Login as Customer
    await page.goto("/login");
    await page.fill('input[name="email"]', "customer@pcmall.vn");
    await page.fill('input[name="password"]', "Customer@123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    // Wait for redirect to home or profile
    await expect(page).toHaveURL(/\/(profile|home|$)/, { timeout: 10000 });

    // 2. Ensure item is in cart
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    // Check if cart is empty, if so, add an item
    const emptyNotice = page.getByText("Giỏ hàng siêu nhẹ");
    if (await emptyNotice.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.goto("/products");
      const firstCard = page.locator('[data-testid="product-card"]').first();
      await expect(firstCard).toBeVisible({ timeout: 5000 });
      await firstCard.locator("a").first().click();

      const addBtn = page.locator('button').filter({ hasText: "Thêm vào giỏ hàng" }).first();
      await expect(addBtn).toBeVisible({ timeout: 5000 });
      await addBtn.click();
      await page.waitForTimeout(1500);
      await page.goto("/cart");
      await page.waitForLoadState("networkidle");
    }

    // 3. Click Checkout button in Cart
    const checkoutBtn = page.getByRole("button", { name: "XÁC NHẬN THANH TOÁN" });
    await expect(checkoutBtn).toBeVisible({ timeout: 5000 });
    await checkoutBtn.click();

    // 4. Verify we are on /checkout
    await expect(page).toHaveURL(/\/checkout/, { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Thanh toán");

    // --- STEP 1: Customer Info ---
    await expect(page.getByRole("heading", { name: "Bước 1: Thông tin khách hàng" })).toBeVisible();
    const phoneInput = page.locator("#checkout-phone-input");
    await expect(phoneInput).toBeVisible();

    // Test invalid phone validation
    await phoneInput.fill("12345");
    const saveOrNextBtn = page.locator("#btn-step1-save-phone, #btn-step1-next").first();
    await saveOrNextBtn.click();
    await expect(page.locator("text=/Số điện thoại Việt Nam không hợp lệ/i")).toBeVisible();

    // Restore valid phone
    await phoneInput.fill("0909876543");
    await saveOrNextBtn.click();

    // --- STEP 2: Shipping Address ---
    await expect(page.getByRole("heading", { name: "Bước 2: Địa chỉ giao hàng" })).toBeVisible({ timeout: 10000 });

    // Verify existing address card is visible
    const existingAddress = page.locator(".address-card").first();
    await expect(existingAddress).toBeVisible();

    // Test Adding a New Address
    const openNewAddrBtn = page.locator("#btn-open-new-address");
    await expect(openNewAddrBtn).toBeVisible();
    await openNewAddrBtn.click();

    // Form inputs
    const fullNameInput = page.locator("#address-fullname-input");
    await expect(fullNameInput).toBeVisible();
    await fullNameInput.fill("Nguyễn Văn E2E");

    await page.locator("#address-phone-input").fill("0987654321");
    await page.locator("#address-province-input").fill("TP. Hồ Chí Minh");
    await page.locator("#address-district-input").fill("Quận 1");
    await page.locator("#address-ward-input").fill("Phường Bến Nghé");
    await page.locator("#address-line-input").fill("Số 99 Đường E2E Test");

    // Click Save address
    const saveAddrBtn = page.locator("#btn-save-address");
    await expect(saveAddrBtn).toBeVisible();
    await saveAddrBtn.click();

    // After saving new address, system should auto-advance to Step 3
    await expect(page.getByRole("heading", { name: "Bước 3: Phương thức thanh toán" })).toBeVisible({ timeout: 10000 });

    // Test Back button to Step 2
    const backStep2Btn = page.locator("#btn-back-step2");
    await expect(backStep2Btn).toBeVisible();
    await backStep2Btn.click();

    await expect(page.getByRole("heading", { name: "Bước 2: Địa chỉ giao hàng" })).toBeVisible();
    // Verify newly added address is selected
    await expect(page.locator(".address-card.selected")).toContainText("Nguyễn Văn E2E");

    // Proceed to Step 3 via Next button
    const step2NextBtn = page.locator("#btn-checkout-step2-next");
    await expect(step2NextBtn).toBeVisible();
    await step2NextBtn.click();

    // --- STEP 3: Payment Method ---
    await expect(page.getByRole("heading", { name: "Bước 3: Phương thức thanh toán" })).toBeVisible({ timeout: 10000 });

    // Test Bank Transfer selection (shows QR details)
    const bankOption = page.locator("#payment-method-card-bank_transfer");
    await expect(bankOption).toBeVisible();
    await bankOption.click();
    await expect(page.locator("text=Thông tin tài khoản nhận")).toBeVisible();

    // Select COD
    const codOption = page.locator("#payment-method-card-cod");
    await expect(codOption).toBeVisible();
    await codOption.click();

    // Proceed to Step 4
    const step3NextBtn = page.locator("#btn-checkout-step3-next");
    await expect(step3NextBtn).toBeVisible();
    await step3NextBtn.click();

    // --- STEP 4: Order Confirmation ---
    await expect(page.getByRole("heading", { name: "Bước 4: Xác nhận thông tin đơn hàng" })).toBeVisible({ timeout: 10000 });

    // Verify confirmation summary
    await expect(page.locator("text=Nguyễn Văn E2E")).toBeVisible();
    await expect(page.locator("text=Thanh toán khi nhận hàng")).toBeVisible();

    // Fill note
    const noteArea = page.locator('textarea[name="note"]');
    await noteArea.fill("Đơn hàng test tự động E2E - Giao giờ hành chính");

    // Place Order
    const placeOrderBtn = page.locator("#btn-place-order");
    await expect(placeOrderBtn).toBeVisible();
    await expect(placeOrderBtn).toBeEnabled();
    await placeOrderBtn.click();

    // Should redirect to /orders
    await expect(page).toHaveURL(/\/orders/, { timeout: 15000 });

    // Verify orders list shows the new order
    await expect(page.getByText("Tiền mặt (COD)").first()).toBeVisible({ timeout: 10000 });
  });

  test("Step indicator direct navigation and VNPay payment gateway redirect", async ({ page }) => {
    // 1. Login as Customer
    await page.goto("/login");
    await page.fill('input[name="email"]', "customer@pcmall.vn");
    await page.fill('input[name="password"]', "Customer@123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/(profile|home|$)/, { timeout: 10000 });

    // 2. Add an item to cart
    await page.goto("/products");
    const firstCard = page.locator('[data-testid="product-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });
    await firstCard.locator("a").first().click();

    const addBtn = page.locator('button').filter({ hasText: "Thêm vào giỏ hàng" }).first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();
    await page.waitForTimeout(1500);

    // 3. Go directly to /checkout
    await page.goto("/checkout");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Thanh toán");

    // Test direct navigation via Step Indicators:
    // Click Step 2 directly (phone is already valid)
    await page.locator("#step-indicator-2").click();
    await expect(page.getByRole("heading", { name: "Bước 2: Địa chỉ giao hàng" })).toBeVisible({ timeout: 5000 });

    // Click Step 3 directly (address is already selected)
    await page.locator("#step-indicator-3").click();
    await expect(page.getByRole("heading", { name: "Bước 3: Phương thức thanh toán" })).toBeVisible({ timeout: 5000 });

    // Select VNPay payment method
    const vnpayOption = page.locator("#payment-method-card-vnpay");
    await expect(vnpayOption).toBeVisible();
    await vnpayOption.click();

    // Click Step 4 directly
    await page.locator("#step-indicator-4").click();
    await expect(page.getByRole("heading", { name: "Bước 4: Xác nhận thông tin đơn hàng" })).toBeVisible({ timeout: 5000 });

    // Click Step 1 indicator to go back and check responsiveness
    await page.locator("#step-indicator-1").click();
    await expect(page.getByRole("heading", { name: "Bước 1: Thông tin khách hàng" })).toBeVisible({ timeout: 5000 });

    // Jump back to Step 4
    await page.locator("#step-indicator-4").click();
    await expect(page.getByRole("heading", { name: "Bước 4: Xác nhận thông tin đơn hàng" })).toBeVisible({ timeout: 5000 });

    // Check VNPay label is shown on place order button
    const placeOrderBtn = page.getByRole("button", { name: "Đặt hàng ngay (VNPay)" });
    await expect(placeOrderBtn).toBeVisible();
    await placeOrderBtn.click();

    // Should redirect to VNPay mock/sandbox payment gateway
    await expect(page).toHaveURL(/(payment\/mock|vnpayment\.vn)/, { timeout: 15000 });
    await expect(page.getByRole("button", { name: /Thanh toán/i })).toBeVisible();
  });
});

