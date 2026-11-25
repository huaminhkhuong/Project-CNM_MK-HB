import { test, expect } from "@playwright/test";

test.describe("UX-004: Register Form Realtime Password Strength & Match Feedback", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("domcontentloaded");
  });

  test("1. Focusing password field reveals the 4-criteria checklist", async ({ page }) => {
    const passwordInput = page.locator("[data-testid='password-input']");
    await expect(passwordInput).toBeVisible({ timeout: 5000 });

    // Focus password field
    await passwordInput.focus();

    const criteriaList = page.locator("[data-testid='password-criteria-list']");
    await expect(criteriaList).toBeVisible({ timeout: 5000 });

    await expect(page.locator("[data-testid='criterion-length']")).toBeVisible();
    await expect(page.locator("[data-testid='criterion-uppercase']")).toBeVisible();
    await expect(page.locator("[data-testid='criterion-number']")).toBeVisible();
    await expect(page.locator("[data-testid='criterion-special']")).toBeVisible();
  });

  test("2. Typing weak password updates criteria and strength label in realtime", async ({ page }) => {
    const passwordInput = page.locator("[data-testid='password-input']");
    await passwordInput.fill("short");

    // Strength label should indicate weak
    const strengthLabel = page.locator("[data-testid='password-strength-label']");
    await expect(strengthLabel).toBeVisible({ timeout: 5000 });
    await expect(strengthLabel).toContainText(/Yếu/i);

    // Length criterion should be unchecked (less than 8 chars)
    const lengthCriterion = page.locator("[data-testid='criterion-length']");
    await expect(lengthCriterion).toContainText("○");
  });

  test("3. Typing strong password satisfies all criteria with checkmarks (✓)", async ({ page }) => {
    const passwordInput = page.locator("[data-testid='password-input']");
    await passwordInput.fill("StrongPass123!");

    // Strength label should indicate Mạnh
    const strengthLabel = page.locator("[data-testid='password-strength-label']");
    await expect(strengthLabel).toContainText(/Mạnh/i);

    // All criteria should have checkmarks (✓)
    await expect(page.locator("[data-testid='criterion-length']")).toContainText("✓");
    await expect(page.locator("[data-testid='criterion-uppercase']")).toContainText("✓");
    await expect(page.locator("[data-testid='criterion-number']")).toContainText("✓");
    await expect(page.locator("[data-testid='criterion-special']")).toContainText("✓");
  });

  test("4. Confirm password mismatch displays immediate realtime warning", async ({ page }) => {
    const passwordInput = page.locator("[data-testid='password-input']");
    const confirmInput = page.locator("[data-testid='confirm-password-input']");

    await passwordInput.fill("StrongPass123!");
    await confirmInput.fill("StrongPass123"); // Missing !

    const matchFeedback = page.locator("[data-testid='confirm-password-feedback']");
    await expect(matchFeedback).toBeVisible({ timeout: 5000 });
    await expect(matchFeedback).toContainText(/chưa khớp/i);
    await expect(matchFeedback).toContainText("✕");
  });

  test("5. Confirm password match displays immediate realtime success feedback", async ({ page }) => {
    const passwordInput = page.locator("[data-testid='password-input']");
    const confirmInput = page.locator("[data-testid='confirm-password-input']");

    await passwordInput.fill("StrongPass123!");
    await confirmInput.fill("StrongPass123!");

    const matchFeedback = page.locator("[data-testid='confirm-password-feedback']");
    await expect(matchFeedback).toBeVisible({ timeout: 5000 });
    await expect(matchFeedback).toContainText(/trùng khớp/i);
    await expect(matchFeedback).toContainText("✓");
  });
});
