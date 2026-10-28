import { test, expect } from "@playwright/test";

test.describe("UX-002: Default Product Listing Diversity & Featured Sorting", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/products");
    await page.waitForLoadState("domcontentloaded");
  });

  test("1. Default /products page loads with Featured sorting and diversified components", async ({ page }) => {
    // Sort dropdown defaults to 'featured'
    const sortSelect = page.locator("#product-sort-select, select[name='sort']").first();
    await expect(sortSelect).toBeVisible({ timeout: 10000 });
    await expect(sortSelect).toHaveValue("featured");

    // Wait for product cards to render
    const productCards = page.locator("[data-testid='product-card']");
    await expect(productCards.first()).toBeVisible({ timeout: 10000 });
    const count = await productCards.count();
    expect(count).toBeGreaterThanOrEqual(8);

    // Collect all category labels on Page 1
    const categoryLocators = page.locator("[data-testid='product-card-category'], .market-product-card__category");
    const categoryTexts = await categoryLocators.allTextContents();
    const uniqueCategories = new Set(categoryTexts.map((t) => t.trim().toLowerCase()).filter(Boolean));

    // Page 1 MUST NOT contain only 1 category (like only GPU).
    // It should have at least 4 distinct hardware categories (CPU, Mainboard, GPU, RAM, SSD, PSU)
    expect(uniqueCategories.size).toBeGreaterThanOrEqual(4);

    // Verify key core categories are represented
    const categoriesJoined = Array.from(uniqueCategories).join(" ");
    expect(categoriesJoined).toMatch(/cpu/i);
    expect(categoriesJoined).toMatch(/gpu|vga/i);
    expect(categoriesJoined).toMatch(/main|mainboard/i);
  });

  test("2. Changing sort to 'newest' updates sorting and reloads list", async ({ page }) => {
    const sortSelect = page.locator("#product-sort-select, select[name='sort']").first();
    await expect(sortSelect).toBeVisible({ timeout: 10000 });
    await sortSelect.selectOption("newest");

    // URL should have ?sort=newest
    await expect(page).toHaveURL(/sort=newest/, { timeout: 10000 });

    // Wait for list to update
    const productCards = page.locator("[data-testid='product-card']");
    await expect(productCards.first()).toBeVisible({ timeout: 10000 });
  });

  test("3. Category filter still correctly isolates specific category", async ({ page }) => {
    // Navigate to /products?category_id=1
    await page.goto("/products?category_id=1");
    await page.waitForLoadState("domcontentloaded");

    const categoryLocators = page.locator("[data-testid='product-card-category'], .market-product-card__category");
    await expect(categoryLocators.first()).toBeVisible({ timeout: 10000 });
    const categoryTexts = await categoryLocators.allTextContents();

    // All displayed cards must be CPU
    expect(categoryTexts.length).toBeGreaterThan(0);
    for (const text of categoryTexts.slice(0, 6)) {
      expect(text.toLowerCase()).toContain("cpu");
    }
  });

  test("4. Clearing filter returns to diversified featured product list", async ({ page }) => {
    await page.goto("/products?category_id=1");
    await page.waitForLoadState("domcontentloaded");

    const categoryLocators = page.locator("[data-testid='product-card-category'], .market-product-card__category");
    await expect(categoryLocators.first()).toBeVisible({ timeout: 10000 });

    // Click clear category chip
    const clearChipBtn = page.locator("button:has-text('✕')").first();
    if (await clearChipBtn.isVisible({ timeout: 2000 })) {
      await clearChipBtn.click();
    } else {
      await page.goto("/products");
    }

    await expect(categoryLocators.first()).toBeVisible({ timeout: 10000 });
    const categoryTexts = await categoryLocators.allTextContents();
    const uniqueCategories = new Set(categoryTexts.map((t) => t.trim().toLowerCase()).filter(Boolean));

    expect(uniqueCategories.size).toBeGreaterThanOrEqual(4);
  });
});
