import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, who: string, pin: string) {
  await page.goto("/login");
  await page.getByLabel("I am").selectOption({ label: who });
  await page.getByLabel("Access code").fill(pin);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

const signOut = (page: Page) => page.getByRole("button", { name: "Sign out" }).click();

test("auction to leaderboard: the whole event in one pass", async ({ page }) => {
  // Home: branding, teams and captains.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SportsAxle" })).toBeVisible();
  await expect(page.getByTestId("team-card")).toHaveCount(4);
  await expect(page.getByText("Aarav Kulkarni")).toBeVisible();

  // Auctioneer puts the first player on the block.
  await signIn(page, "Auctioneer (admin)", "admin-1234");
  await page.getByRole("button", { name: "Next player" }).click();
  await expect(page.getByTestId("on-block")).toContainText("Kabir Shah");
  await signOut(page);

  // Captain bids; the purse is shown only to them.
  await signIn(page, "Aarav Kulkarni · Team Alpha", "alpha-1234");
  await page.goto("/auction");
  await page.getByRole("button", { name: "Bid ₹500" }).click();
  await expect(page.getByText("You hold the highest bid.")).toBeVisible();
  await expect(page.getByTestId("current-bid")).toHaveText("₹500");
  await signOut(page);

  // Auctioneer sells, then records a match result.
  await signIn(page, "Auctioneer (admin)", "admin-1234");
  await page.getByRole("button", { name: "Sold!" }).click();
  await expect(page.getByTestId("last-result")).toContainText("Team Alpha");
  await page.goto("/leaderboard");
  await page.getByRole("textbox", { name: "Sport" }).fill("Cricket");
  await page.getByLabel("Result").selectOption("b");
  await page.getByRole("button", { name: "Record result" }).click();
  await expect(page.getByTestId("standing-row").first()).toContainText("Team Bravo");
  await signOut(page);

  // Public player list: sold badge and team, but no price anywhere.
  await page.goto("/players");
  await expect(page.getByText("Sold to Team Alpha")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("₹");

  // The buyer's private dashboard has the money.
  await signIn(page, "Aarav Kulkarni · Team Alpha", "alpha-1234");
  await expect(page.getByTestId("Remaining purse")).toHaveText("₹9,500");
  await expect(page.getByTestId("Total spent")).toHaveText("₹500");
  await expect(page.getByText("Bought for ₹500")).toBeVisible();
});
