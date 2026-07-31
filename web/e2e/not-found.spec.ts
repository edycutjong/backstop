import { test, expect } from "@playwright/test";

// A bad URL must render the branded 404 and return an HTTP 404 status.
test.describe("404 not-found page", () => {
  test("renders the branded 404 and returns status 404", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole("heading", { name: /This page isn't in the net/i }),
    ).toBeVisible();
    await expect(page.getByText("404").first()).toBeVisible();

    // The recovery links back to home and to the verify page.
    await expect(
      page.getByRole("link", { name: /Back to home/i }),
    ).toBeVisible();
  });
});
