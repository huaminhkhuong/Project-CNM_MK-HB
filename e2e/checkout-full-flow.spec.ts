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
    await expect(page.getByRole("heading", { name: "Bước 1: Thông tin khách hàng" })).toBeVisible({ timeout: 10000 });
    const phoneInput = page.locator('input[placeholder="Ví dụ: 0901234567"]').first();
    await expect(phoneInput).toBeVisible({ timeout: 10000 });

    // Test invalid phone validation
    await phoneInput.fill("12345");
    const saveOrNextBtn = page.getByRole("button", { name: /Lưu và tiếp tục|Tiếp tục sang địa chỉ/i });
    await saveOrNextBtn.click();
    await expect(page.locator("text=/không hợp lệ|số điện thoại/i").first()).toBeVisible({ timeout: 5000 });

    // Restore valid phone
    await phoneInput.fill("0909876543");
    await page.getByRole("button", { name: /Lưu và tiếp tục|Tiếp tục sang địa chỉ/i }).click();

    // --- STEP 2: Shipping Address ---
    await expect(page.getByRole("heading", { name: "Bước 2: Địa chỉ giao hàng" })).toBeVisible({ timeout: 10000 });

    // Test Adding a New Address (open form if saved addresses exist)
    const openNewAddrBtn = page.getByRole("button", { name: /Thêm địa chỉ giao hàng mới/i });
    if (await openNewAddrBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await openNewAddrBtn.click();
    }

    // Form inputs inside #address-form-section
    const addrForm = page.locator("#address-form-section");
    await expect(addrForm).toBeVisible({ timeout: 5000 });
    await addrForm.locator('input[placeholder="Ví dụ: Nguyễn Văn A"]').fill("Nguyễn Văn E2E");
    await addrForm.locator('input[placeholder="Ví dụ: 0901234567"]').fill("0987654321");
    await addrForm.locator('input[placeholder="Hồ Chí Minh, Hà Nội..."]').fill("TP. Hồ Chí Minh");
    await addrForm.locator('input[placeholder="Quận 1, Cầu Giấy..."]').fill("Quận 1");
    await addrForm.locator('input[placeholder="Phường Bến Nghé..."]').fill("Phường Bến Nghé");
    await addrForm.locator('input[placeholder="Số nhà, tên đường, tòa nhà..."]').fill("Số 99 Đường E2E Test");

    // Click Save address
    const saveAddrBtn = addrForm.getByRole("button", { name: /Lưu địa chỉ và chọn|Cập nhật địa chỉ/i });
    await expect(saveAddrBtn).toBeVisible();
    await saveAddrBtn.click();

    // Verify newly added address is selected on Step 2
    await expect(page.locator(".address-card.selected")).toContainText("Nguyễn Văn E2E", { timeout: 10000 });

    // Proceed to Step 3 via Next button
    const step2NextBtn = page.getByRole("button", { name: /Tiếp tục bước 3/i });
    await expect(step2NextBtn).toBeVisible();
    await step2NextBtn.click();

    // --- STEP 3: Payment Method ---
    await expect(page.getByRole("heading", { name: "Bước 3: Phương thức thanh toán" })).toBeVisible({ timeout: 10000 });

    // Test Back button to Step 2 and return to Step 3
    const backStep2Btn = page.getByRole("button", { name: /Quay lại bước 2/i });
    await expect(backStep2Btn).toBeVisible();
    await backStep2Btn.click();
    await expect(page.getByRole("heading", { name: "Bước 2: Địa chỉ giao hàng" })).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".address-card.selected")).toContainText("Nguyễn Văn E2E");
    await page.getByRole("button", { name: /Tiếp tục bước 3/i }).click();
    await expect(page.getByRole("heading", { name: "Bước 3: Phương thức thanh toán" })).toBeVisible({ timeout: 10000 });

    // Test Bank Transfer selection (shows VietQR vault details)
    const bankOption = page.locator("#payment-method-card-bank_transfer");
    await expect(bankOption).toBeVisible();
    await bankOption.click();
    await expect(page.locator(".vietqr-vault")).toBeVisible({ timeout: 5000 });

    // Select COD
    const codOption = page.locator("#payment-method-card-cod");
    await expect(codOption).toBeVisible();
    await codOption.click();

    // Proceed to Step 4
    const step3NextBtn = page.getByRole("button", { name: /Tiếp tục bước 4/i });
    await expect(step3NextBtn).toBeVisible();
    await step3NextBtn.click();

    // --- STEP 4: Order Confirmation ---
    await expect(page.getByRole("heading", { name: "Bước 4: Xác nhận thông tin đơn hàng" })).toBeVisible({ timeout: 10000 });

    // Verify confirmation summary
    await expect(page.locator("text=Nguyễn Văn E2E")).toBeVisible();
    await expect(page.locator("text=Thanh toán khi nhận hàng").first()).toBeVisible();

    // Fill note
    const noteArea = page.locator('textarea[name="note"]');
    await noteArea.fill("Đơn hàng test tự động E2E - Giao giờ hành chính");

    // Place Order
    const placeOrderBtn = page.getByRole("button", { name: /Đặt hàng ngay/i });
    await expect(placeOrderBtn).toBeVisible();
    await expect(placeOrderBtn).toBeEnabled();
    await placeOrderBtn.click();

    // Should redirect to /orders
    await expect(page).toHaveURL(/\/orders/, { timeout: 15000 });

    // Verify orders list shows the new order
    await expect(page.locator("text=/COD|Tiền mặt|Thanh toán khi nhận hàng/i").first()).toBeVisible({ timeout: 10000 });
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
    await expect(firstCard).toBeVisible({ timeout: 15000 });
    await firstCard.locator("a").first().click();

    const addBtn = page.locator('button').filter({ hasText: "Thêm vào giỏ hàng" }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();
    await page.waitForTimeout(1500);

    // 3. Go directly to /checkout
    await page.goto("/checkout");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Thanh toán");

    // Advance cleanly from Step 1 -> Step 2 -> Step 3 (or handle restored step)
    if (await page.getByRole("heading", { name: "Bước 1: Thông tin khách hàng" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /Lưu và tiếp tục|Tiếp tục sang địa chỉ/i }).click();
    }
    if (await page.getByRole("heading", { name: "Bước 2: Địa chỉ giao hàng" }).isVisible({ timeout: 3000 }).catch(() => false)) {
      const firstAddr = page.locator(".address-card").first();
      if (await firstAddr.isVisible().catch(() => false)) {
        await firstAddr.click();
      }
      await page.getByRole("button", { name: /Tiếp tục bước 3/i }).click();
    }

    await expect(page.getByRole("heading", { name: "Bước 3: Phương thức thanh toán" })).toBeVisible({ timeout: 10000 });

    // Select VNPay payment method
    const vnpayOption = page.locator("#payment-method-card-vnpay");
    await expect(vnpayOption).toBeVisible();
    await vnpayOption.click();

    // Proceed to Step 4
    await page.getByRole("button", { name: /Tiếp tục bước 4/i }).click();
    await expect(page.getByRole("heading", { name: "Bước 4: Xác nhận thông tin đơn hàng" })).toBeVisible({ timeout: 5000 });

    // Test navigating back via completed Step 1 indicator
    await page.locator(".step-node").filter({ hasText: "1. Khách hàng" }).click();
    await expect(page.getByRole("heading", { name: "Bước 1: Thông tin khách hàng" })).toBeVisible({ timeout: 5000 });

    // Advance back to Step 4
    await page.getByRole("button", { name: /Lưu và tiếp tục|Tiếp tục sang địa chỉ/i }).click();
    await page.getByRole("button", { name: /Tiếp tục bước 3/i }).click();
    await page.getByRole("button", { name: /Tiếp tục bước 4/i }).click();
    await expect(page.getByRole("heading", { name: "Bước 4: Xác nhận thông tin đơn hàng" })).toBeVisible({ timeout: 5000 });

    // Check VNPay label is shown on place order button
    const placeOrderBtn = page.getByRole("button", { name: "Đặt hàng ngay (VNPay)" });
    await expect(placeOrderBtn).toBeVisible();
    await placeOrderBtn.click();

    // Should redirect to VNPay mock/sandbox payment gateway
    await expect(page).toHaveURL(/(payment\/mock|vnpayment\.vn|payment-result)/, { timeout: 15000 });
  });
});

