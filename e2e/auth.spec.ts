import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should register new user", async ({ page }) => {
    await page.goto("/register");
    
    const uniqueEmail = `test${Date.now()}@example.com`;
    const uniquePhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
    // Fill registration form with all required fields
    await page.fill('input[name="full_name"]', "Test User");
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="phone"]', uniquePhone);
    await page.fill('input[name="password"]', "Test@123456");
    await page.fill('input[name="confirmPassword"]', "Test@123456");
    
    // Wait for email check debounce
    await page.waitForTimeout(600);

    // Submit form
    const registerBtn = page.getByRole("button", { name: "Tạo tài khoản PC Mall" });
    await expect(registerBtn).toBeEnabled({ timeout: 5000 });
    await registerBtn.click();
    
    // Should redirect to login or home
    await expect(page).toHaveURL(/\/(login|home|$)/, { timeout: 10000 });
  });

  test("should login with valid credentials", async ({ page }) => {
    await page.goto("/login");
    
    // Fill login form
    await page.fill('input[name="email"]', "admin@cnm.local");
    await page.fill('input[name="password"]', "Admin@123");
    
    // Submit form
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    
    // Should redirect to admin dashboard or home
    await expect(page).toHaveURL(/\/(admin|home|$)/, { timeout: 10000 });
  });

  test("should show error with invalid credentials", async ({ page }) => {
    await page.goto("/login");
    
    // Fill login form with invalid credentials
    await page.fill('input[name="email"]', "invalid@example.com");
    await page.fill('input[name="password"]', "wrongpassword");
    
    // Submit form
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    
    // Should show error message
    await expect(page.locator("text=/invalid|error|không chính xác|không đúng|thất bại/i")).toBeVisible();
  });
});
