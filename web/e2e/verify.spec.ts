import { test, expect } from "@playwright/test";
import { BACKSTOP_ADDRESS, BACKSTOP_POOL_ADDRESS } from "../lib/config";

// The /integrations/verify page is the judge-facing "prove it's real" surface.
// It reads live Coston2 state (no wallet) and shows the FDC proof + contract
// links. We assert on the stable structural labels, not on volatile chain data.
test.describe("integration verify page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/integrations/verify");
  });

  test("renders the live pool-state card", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Verify the Flare integration/i }),
    ).toBeVisible();
    await expect(
      page.getByText("Live pool state — read from Coston2"),
    ).toBeVisible();
    // Stat labels within the pool-state card.
    await expect(page.getByText("Pool TVL").first()).toBeVisible();
    await expect(page.getByText("Guards issued").first()).toBeVisible();
  });

  test("renders the Solvency card", async ({ page }) => {
    await expect(
      page.getByText("Solvency — coverage backed by real pool value"),
    ).toBeVisible();
    await expect(page.getByText("Pool value (USD)").first()).toBeVisible();
    await expect(page.getByText("Active coverage (USD)").first()).toBeVisible();
  });

  test("renders the FDC proof panel labelled as the Day-4 spike", async ({
    page,
  }) => {
    await expect(
      page.getByText("FDC default proof", { exact: true }),
    ).toBeVisible();
    // Honest labelling: the proof is the Day-4 go/no-go gate spike, not an
    // end-to-end claim. The badge text appears until a real Claimed event lands.
    await expect(
      page.getByText("Day-4 FDC gate (spike)").first(),
    ).toBeVisible();
  });

  test("shows the verified contract links", async ({ page }) => {
    await expect(
      page.getByText("Deployed contracts (Coston2, verified)"),
    ).toBeVisible();
    // Both deployed contract addresses are linked out to the explorer.
    await expect(
      page.getByRole("link", { name: new RegExp(BACKSTOP_ADDRESS, "i") }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(BACKSTOP_POOL_ADDRESS, "i") }),
    ).toBeVisible();
  });
});
