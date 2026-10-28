import { test, expect } from "@playwright/test";

test.describe("UX-003: Header Announcement Bar Truncation & Responsive Adaptability", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  test("1. Desktop 1280px: AnnouncementBar renders clearly without ellipsis or truncation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const announcementBar = page.locator("[data-testid='announcement-bar']");
    await expect(announcementBar).toBeVisible({ timeout: 10000 });

    const announcementText = page.locator("[data-testid='announcement-text']");
    await expect(announcementText).toBeVisible({ timeout: 5000 });

    const textContent = await announcementText.innerText();
    expect(textContent.length).toBeGreaterThan(10);
    // MUST NOT contain ellipsis truncation '...'
    expect(textContent).not.toContain("...");
  });

  test("2. Controls: Next and Prev buttons switch announcement messages properly", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const announcementText = page.locator("[data-testid='announcement-text']");
    const initialText = await announcementText.innerText();

    const nextBtn = page.locator("[data-testid='announcement-next']");
    await expect(nextBtn).toBeVisible({ timeout: 5000 });
    await nextBtn.click();

    // Text should change to next promotion / warranty message
    await expect(async () => {
      const newText = await announcementText.innerText();
      expect(newText).not.toBe(initialText);
      expect(newText).not.toContain("...");
    }).toPass({ timeout: 5000 });
  });

  test("3. Tablet 768px / 110% Zoom: Announcement text remains intact and visible without '...'", async ({ page }) => {
    // 768px tablet width or 110% zoom simulation
    await page.setViewportSize({ width: 768, height: 1024 });

    const announcementBar = page.locator("[data-testid='announcement-bar']");
    await expect(announcementBar).toBeVisible({ timeout: 5000 });

    const announcementText = page.locator("[data-testid='announcement-text']");
    await expect(announcementText).toBeVisible({ timeout: 5000 });

    const text = await announcementText.innerText();
    expect(text.length).toBeGreaterThan(5);
    expect(text).not.toContain("...");

    // Check that announcement track does not have clipped overflow
    const isOverflowing = await page.evaluate(() => {
      const el = document.querySelector(".announcement-bar__track");
      if (!el) return false;
      return el.scrollWidth > el.clientWidth + 5; // tolerance
    });
    expect(isOverflowing).toBe(false);
  });

  test("4. Mobile 480px: Compact announcement displays cleanly without crashing or overflowing", async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 850 });

    const announcementBar = page.locator("[data-testid='announcement-bar']");
    await expect(announcementBar).toBeVisible({ timeout: 5000 });

    const announcementText = page.locator("[data-testid='announcement-text']");
    await expect(announcementText).toBeVisible({ timeout: 5000 });

    const text = await announcementText.innerText();
    expect(text.length).toBeGreaterThan(3);
    expect(text).not.toContain("...");
  });

  test("5. Clicking announcement item navigates to destination page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const announcementItem = page.locator("[data-testid='announcement-item']");
    await expect(announcementItem).toBeVisible({ timeout: 5000 });

    const href = await announcementItem.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href).toMatch(/\/pc-builder|\/warranties|\/products|\/ai-chat/);

    await announcementItem.click();
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(new RegExp(href!));
  });
});
