import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("Header Search Bar [BUG-004]", () => {
  test("1. Gõ 'CPU' vào Header Search Bar và nhấn Enter lọc đúng sản phẩm CPU", async ({ page }) => {
    // Navigate from homepage
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Header search bar should be visible
    const searchInput = page.locator("#header-search-input");
    await expect(searchInput).toBeVisible();

    // Type 'CPU' and submit
    await searchInput.fill("CPU");
    await searchInput.press("Enter");

    // URL should navigate to /products?search=CPU
    await expect(page).toHaveURL(/\/products\?search=CPU/, { timeout: 10000 });

    // Hero banner should indicate search query
    await expect(page.locator("h1")).toContainText("CPU");

    // Filter chip for search should be present
    const searchChip = page.locator('[data-testid="filter-chip-search"]');
    await expect(searchChip).toBeVisible({ timeout: 10000 });
    await expect(searchChip).toContainText("CPU");

    // Wait for CPU product cards to load
    const firstCard = page.locator('[data-testid="product-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await expect(firstCard).toContainText(/cpu|intel|ryzen/i, { timeout: 10000 });

    const firstCardText = await firstCard.innerText();
    expect(firstCardText).not.toContain("VGA Asus ROG Astral RTX 5080");
  });

  test("2. Gõ 'RTX' lọc ra đúng danh sách Card màn hình GPU", async ({ page }) => {
    await page.goto("/products");
    await page.waitForLoadState("domcontentloaded");

    const searchInput = page.locator("#header-search-input");
    await expect(searchInput).toBeVisible();

    // Fill 'RTX' and submit
    await searchInput.fill("RTX");
    await searchInput.press("Enter");

    await expect(page).toHaveURL(/\/products\?search=RTX/, { timeout: 10000 });

    const searchChip = page.locator('[data-testid="filter-chip-search"]');
    await expect(searchChip).toBeVisible({ timeout: 10000 });
    await expect(searchChip).toContainText("RTX");

    const firstCard = page.locator('[data-testid="product-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await expect(firstCard).toContainText(/rtx/i, { timeout: 10000 });
  });

  test("3. Bấm nút ✕ trên chip bộ lọc xóa từ khóa tìm kiếm và phục hồi danh sách", async ({ page }) => {
    await page.goto("/products?search=CPU");
    await page.waitForLoadState("domcontentloaded");

    const searchChip = page.locator('[data-testid="filter-chip-search"]');
    await expect(searchChip).toBeVisible({ timeout: 10000 });

    // Click ✕ on the search chip
    const clearBtn = page.locator('[data-testid="clear-search-chip"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // URL should return to /products without search parameter
    await expect(page).toHaveURL("/products", { timeout: 10000 });
    await expect(searchChip).not.toBeVisible();

    // Search input in header should also clear
    const searchInput = page.locator("#header-search-input");
    await expect(searchInput).toHaveValue("");
  });

  test("4. Chọn gợi ý tìm kiếm nhanh (Quick Suggestions) điều hướng chính xác", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const searchInput = page.locator("#header-search-input");
    await searchInput.click();

    // Quick suggestion item 0: "CPU Intel Core i9"
    const suggestion0 = page.locator('[data-testid="search-suggestion-0"]');
    await expect(suggestion0).toBeVisible({ timeout: 5000 });
    await suggestion0.click();

    // URL should contain search parameter
    await expect(page).toHaveURL(/\/products\?search=CPU(%20|\+)Intel(%20|\+)Core(%20|\+)i9/, { timeout: 10000 });

    // Wait for ProductListPage and search chip to render
    const searchChip = page.locator('[data-testid="filter-chip-search"]');
    await expect(searchChip).toBeVisible({ timeout: 10000 });
    await expect(searchChip).toContainText("CPU Intel Core i9");

    // Product cards for i9 should load
    const firstCard = page.locator('[data-testid="product-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    const firstCardText = await firstCard.innerText();
    expect(firstCardText.toLowerCase()).toContain("i9");
  });

  test("5. Tìm kiếm từ khóa không tồn tại hiển thị Empty State thân thiện", async ({ page }) => {
    await page.goto("/products");
    await page.waitForLoadState("domcontentloaded");

    const searchInput = page.locator("#header-search-input");
    await searchInput.fill("xyznonexistent999");
    await searchInput.press("Enter");

    await expect(page).toHaveURL(/\/products\?search=xyznonexistent999/, { timeout: 10000 });

    // Empty state should be visible
    await expect(page.locator("text=Không tìm thấy sản phẩm nào")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="product-card"]')).toHaveCount(0);
  });
});
