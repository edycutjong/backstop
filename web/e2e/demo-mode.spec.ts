import { test, expect } from "@playwright/test";

// Smoke test: the landing page loads in "demo mode" — no wallet connected, no
// keys — with the correct title, the hero, the honest proof strip, and no
// application JavaScript errors.
//
// NOTE: this app reads live Coston2 state on load (no wallet). The public RPC
// occasionally answers a viem batch eth_call with HTTP 400 / a transient
// network failure — that is external testnet noise, not an app fault, so we
// filter resource-load and RPC errors out. Any *uncaught JS exception*
// (pageerror) or genuine application console error still fails the test.
const isNetworkNoise = (text: string) =>
  /Failed to load resource/i.test(text) ||
  /\b(400|429|500|502|503|504)\b/.test(text) ||
  /net::ERR_/i.test(text) ||
  /(rpc|coston2|flare\.network|fetch failed|HTTP request failed)/i.test(text);

test.describe("landing page (demo mode, no wallet)", () => {
  test("loads with the correct title and no application errors", async ({
    page,
  }) => {
    const appErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !isNetworkNoise(msg.text())) {
        appErrors.push(msg.text());
      }
    });
    // Uncaught JS exceptions are always a real fault.
    page.on("pageerror", (err) => appErrors.push(err.message));

    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);

    // Root layout sets the default document title.
    await expect(page).toHaveTitle(
      "Backstop — redemption insurance for FXRP on Flare",
    );

    // No application JS errors while the read-only app hydrates.
    await page.waitForLoadState("networkidle");
    expect(appErrors).toEqual([]);
  });

  test("shows the hero headline and primary CTAs", async ({ page }) => {
    await page.goto("/");

    // Hero headline (split across lines in the markup).
    await expect(
      page.getByRole("heading", { level: 1, name: /Redeem FXRP/i }),
    ).toBeVisible();
    await expect(page.getByText("Insurance you can audit")).toBeVisible();

    // Primary + secondary CTAs.
    await expect(
      page.getByRole("link", { name: /Guard a redemption/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Underwrite & earn/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Verify the integration/i }).first(),
    ).toBeVisible();
  });

  test("shows the honest proof strip (no fabricated user counts)", async ({
    page,
  }) => {
    await page.goto("/");

    // The proof strip advertises hard, verifiable facts.
    await expect(page.getByText("Day-4 FDC gate · live Coston2")).toBeVisible();
    await expect(page.getByText("tests · 100% unit coverage")).toBeVisible();
    await expect(page.getByText("Flare engine methods, wired")).toBeVisible();

    // The "live pool state" read-from-chain block is present without a wallet.
    await expect(
      page.getByText(
        /Live pool state · read from Coston2 · no wallet required/i,
      ),
    ).toBeVisible();
  });
});
