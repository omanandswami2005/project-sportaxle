import { statSync } from "node:fs";
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

  // Hovering a team card offers that captain's sign-in, with the team preselected.
  const alphaCard = page.getByTestId("team-card").first();
  await alphaCard.hover();
  await alphaCard.getByRole("link", { name: "Captain sign in for Team Alpha" }).click();
  await expect(page.getByLabel("I am")).toHaveValue("1");
  await expect(page.getByLabel("Access code")).toBeFocused();

  // Credits: rolling on the big screen until the first player goes on the block.
  await page.goto("/screen");
  await expect(page.getByTestId("credits")).toContainText("SUNIL MANDALIYA");
  await page.goto("/");

  // Auctioneer picks a player, pauses and resumes the clock, closes, then undoes it.
  await signIn(page, "Auctioneer (admin)", "admin-1234");
  await page.getByLabel("Next player").selectOption({ label: "Dev Malhotra" });
  await page.getByRole("button", { name: "Next player" }).click();
  await expect(page.getByTestId("on-block")).toContainText("Dev Malhotra");
  await page.getByRole("button", { name: "Pause bidding" }).click();
  await expect(page.getByTestId("countdown")).toContainText("Paused");
  await page.getByRole("button", { name: "Resume bidding" }).click();
  await page.getByRole("button", { name: "Mark unsold" }).click();
  await page.getByRole("button", { name: "Undo: put Dev Malhotra back up" }).click();
  await expect(page.getByTestId("on-block")).toContainText("Dev Malhotra");
  await page.getByRole("button", { name: "Mark unsold" }).click();

  // The default "Next player" is a random draw (covered by pytest); choose one so later steps are stable.
  await page.getByLabel("Next player").selectOption({ label: "Kabir Shah" });
  await page.getByRole("button", { name: "Next player" }).click();
  await expect(page.getByTestId("on-block")).toContainText("Kabir Shah");
  await page.goto("/screen");
  await expect(page.getByTestId("screen-on-block")).toContainText("Kabir Shah");
  await page.getByRole("link", { name: "Exit" }).click(); // the big screen hides the site header
  await signOut(page);

  // Captain bids; the purse is shown only to them.
  await signIn(page, "Aarav Kulkarni · Team Alpha", "alpha-1234");
  await page.goto("/auction");
  await page.getByRole("button", { name: "Bid ₹500" }).click();
  await expect(page.getByText("You hold the highest bid.")).toBeVisible();
  await expect(page.getByTestId("current-bid")).toHaveText("₹500");
  await expect(page.getByTestId("countdown")).toContainText("0:"); // 30 s timer, restarted by the bid
  await signOut(page);

  // Auctioneer sells, then records a match result.
  await signIn(page, "Auctioneer (admin)", "admin-1234");
  await page.getByRole("button", { name: "Sold!", exact: true }).click();
  await expect(page.getByTestId("last-result")).toContainText("Team Alpha");
  await page.goto("/screen");
  await expect(page.getByTestId("screen-result")).toContainText("SOLD!");
  await expect(page.getByTestId("screen-result")).toContainText("Team Alpha");
  await page.goto("/auction");

  // A result needs two real squads, so Bravo buys a player too.
  await page.getByLabel("Next player").selectOption({ label: "Priya Menon" });
  await page.getByRole("button", { name: "Next player" }).click();
  await signOut(page);
  await signIn(page, "Meera Joshi · Team Bravo", "bravo-1234");
  await page.goto("/auction");
  await page.getByRole("button", { name: /^Bid ₹/ }).click();
  await signOut(page);
  await signIn(page, "Auctioneer (admin)", "admin-1234");
  await page.getByRole("button", { name: "Sold!", exact: true }).click();
  await expect(page.getByTestId("last-result")).toContainText("Team Bravo");

  await page.goto("/leaderboard");
  await page.getByRole("combobox", { name: "Sport" }).fill("Cricket");
  await page.getByLabel("Result").selectOption("b");
  await page.getByRole("button", { name: "Record result" }).click();
  await expect(page.getByTestId("standing-row").first()).toContainText("Team Bravo");

  // Schedule a fixture, record its result, and see that sport's own table.
  await page.goto("/schedule");
  const fixtureForm = page.getByRole("form", { name: "Add a fixture" });
  await fixtureForm.getByRole("combobox", { name: "Sport" }).fill("Chess");
  await fixtureForm.getByLabel("Starts").fill("2026-11-25T10:00");
  await fixtureForm.getByRole("button", { name: "Add fixture" }).click();
  await expect(page.getByTestId("fixture")).toContainText("Team Alpha vs Team Bravo");
  await page.getByRole("button", { name: "Team Alpha won" }).click();
  await expect(page.getByTestId("fixture")).toHaveCount(0);
  await page.goto("/leaderboard");
  await page.getByRole("button", { name: "Chess" }).click();
  await expect(page.getByRole("heading", { name: "Points table · Chess" })).toBeVisible();
  await expect(page.getByTestId("standing-row").first()).toContainText("Team Alpha");
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
  await signOut(page);

  // Auctioneer adds a team and a player from the admin page.
  await signIn(page, "Auctioneer (admin)", "admin-1234");
  await page.goto("/admin");
  const teamForm = page.getByRole("form", { name: "Add a team" });
  await teamForm.getByLabel("Team name").fill("Team Echo");
  await teamForm.getByLabel("Captain", { exact: true }).fill("Esha Rane");
  await teamForm.getByLabel(/access code/).fill("echo-1234");
  await teamForm.getByRole("button", { name: "Add team" }).click();
  await expect(teamForm.getByRole("status")).toContainText("Team Echo added");

  const playerForm = page.getByRole("form", { name: "Add a player" });
  await playerForm.getByLabel("Player name").fill("Zoya Mirza");
  await playerForm.getByLabel("Department").fill("Design");
  await playerForm.getByRole("button", { name: "Add player" }).click();
  await expect(playerForm.getByRole("status")).toContainText("Zoya Mirza added");
  await page.getByRole("button", { name: "Remove Zoya Mirza" }).click();
  await expect(page.getByRole("heading", { name: "Players · 16" })).toBeVisible();

  // Edit a player; the change shows everywhere.
  await page.getByText("Edit Priya Menon").click();
  const edit = page.getByRole("form", { name: "Edit Priya Menon" });
  await edit.getByLabel("Sports (comma separated)").fill("Chess, Carrom");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit.getByRole("status")).toHaveText("Saved.");

  // Squad size limit: the auctioneer can set it at any time.
  const limit = page.getByRole("form", { name: "Squad size limit" });
  await limit.getByLabel(/Most players/).fill("6");
  await limit.getByRole("button", { name: "Save limit" }).click();
  await expect(limit.getByRole("status")).toHaveText("Squad limit is now 6 players.");

  // Final squads sheet: every team, its players, no prices.
  await page.goto("/squads");
  await expect(page.getByTestId("squad")).toHaveCount(5);
  await expect(page.getByTestId("squad").first()).toContainText("Kabir Shah");
  await expect(page.getByRole("main")).not.toContainText("₹");

  // The PDF is built in the browser with the brand fonts (the size shows they were embedded).
  const [pdf] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PDF" }).click(),
  ]);
  expect(pdf.suggestedFilename()).toBe("sportsaxle-squads.pdf");
  expect(statSync((await pdf.path())!).size).toBeGreaterThan(50_000);

  await page.goto("/");
  await expect(page.getByTestId("team-card")).toHaveCount(5);
});
