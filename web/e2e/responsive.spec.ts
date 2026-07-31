import { test, expect } from "@playwright/test";

// Layout must hold at mobile, tablet, and desktop widths with no horizontal
// overflow and a header that fits the viewport.
const widths = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const vp of widths) {
  test.describe(`responsive layout @ ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("no horizontal overflow on the landing page", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      // Allow 1px for sub-pixel rounding.
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 1);
    });

    test("header fits within the viewport width", async ({ page }) => {
      await page.goto("/");
      const header = page.locator("header").first();
      await expect(header).toBeVisible();

      const box = await header.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(vp.width + 1);
    });

    test("no horizontal overflow on the verify page", async ({ page }) => {
      await page.goto("/integrations/verify");
      await page.waitForLoadState("networkidle");

      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 1);
    });
  });
}
