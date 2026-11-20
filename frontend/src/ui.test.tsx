// Fast UI unit tests: render to a string, no browser or DOM emulation needed.
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PlayerCard } from "./components/PlayerCard";
import { sportsOf } from "./lib/format";
import { filledFields } from "./pages/Admin";
import { Countdown } from "./pages/Auction";
import { creditLine } from "./pages/Credits";
import { byDay } from "./pages/Schedule";
import { squadsCsv } from "./pages/Squads";
import { initials, money, teamName } from "./lib/format";
import type { Player } from "./lib/types";

const player: Player = {
  id: 1,
  name: "Kabir Shah",
  department: "Engineering",
  sports: "Cricket, Chess",
  photo_url: null,
  base_price: 500,
  status: "sold",
  team_id: 2,
};

test("format helpers", () => {
  expect(money(125000)).toBe("₹1,25,000");
  expect(initials("kabir shah")).toBe("KS");
  expect(initials("  Cher ")).toBe("C");
  expect(teamName([{ id: 2, name: "Bravo", captain: "B", color: "#000", captain_photo_url: null }], 2)).toBe("Bravo");
  expect(teamName(undefined, 2)).toBe("—");
});

test("player card shows name, department, status and an initials avatar", () => {
  const html = renderToStaticMarkup(<PlayerCard player={player} />);
  expect(html).toContain("Kabir Shah");
  expect(html).toContain("Engineering");
  expect(html).toContain("Sold");
  expect(html).toContain(">KS<");
  expect(html).not.toContain("<img");
});

test("player card shows the photo when one exists and never a price by itself", () => {
  const html = renderToStaticMarkup(
    <PlayerCard player={{ ...player, status: "available", photo_url: "/photos/kabir.webp" }} />,
  );
  expect(html).toContain('src="/photos/kabir.webp"');
  expect(html).toContain("Available");
  expect(html).not.toContain("₹");
});

test("countdown shows the time left and calls going once, going twice", () => {
  expect(renderToStaticMarkup(<Countdown seconds={23} />)).toContain("0:23");
  expect(renderToStaticMarkup(<Countdown seconds={8} />)).toContain("Going once");
  expect(renderToStaticMarkup(<Countdown seconds={3} />)).toContain("Going twice");
});

test("a paused countdown says so instead of going once", () => {
  const html = renderToStaticMarkup(<Countdown seconds={4} paused />);
  expect(html).toContain("Paused");
  expect(html).not.toContain("Going");
});

test("squads CSV lists each team's players and never a price", () => {
  const teams = [{ id: 2, name: "Bravo", captain: "Bala", color: "#000", captain_photo_url: null }];
  const csv = squadsCsv(teams, [player, { ...player, id: 9, team_id: null, name: "Free Agent" }]);
  expect(csv).toBe('"Team","Captain","Player","Department","Sports"\n"Bravo","Bala","Kabir Shah","Engineering","Cricket, Chess"\n');
});

test("squads CSV defuses spreadsheet formulas in names", () => {
  const teams = [{ id: 2, name: "Bravo", captain: "Bala", color: "#000", captain_photo_url: null }];
  const evil = { ...player, team_id: 2, name: '=HYPERLINK("http://x")', department: "@SUM(1)" };
  const csv = squadsCsv(teams, [evil]);
  expect(csv).toContain(`"'=HYPERLINK(""http://x"")","'@SUM(1)"`);
});

test("edit forms send only the fields the admin filled in", () => {
  const data = new FormData();
  data.set("name", "New name");
  data.set("pin", "");
  data.set("photo", new File([], ""));
  expect([...filledFields(data).keys()]).toEqual(["name"]);
});

test("fixtures group by day and sports are listed once", () => {
  const fixture = { id: 1, sport: "Chess", team_a_id: 1, team_b_id: 2, starts_at: "2026-11-25T10:00:00", venue: "" };
  const days = byDay([fixture, { ...fixture, id: 2, starts_at: "2026-11-25T15:00:00" }, { ...fixture, id: 3, starts_at: "2026-11-26T09:00:00" }]);
  expect(days.map(([, list]) => list.length)).toEqual([2, 1]);
  expect(sportsOf([{ sport: "Cricket" }, { sport: " cricket" }, { sport: "Chess" }])).toEqual(["Chess", "Cricket"]);
});

test("the credits band names the guide and every captain", () => {
  const line = creditLine([{ id: 1, name: "Team Sahil", captain: "Sahil Mehta", color: "#000", captain_photo_url: null }]);
  expect(line).toContain("SUNIL MANDALIYA · GUIDANCE");
  expect(line).toContain("SAHIL MEHTA · CAPTAIN, TEAM SAHIL");
});

test("squads PDF has a cover plus a page per team, and no prices", async () => {
  const teams = [1, 2].map((id) => ({ id, name: `Team ${id}`, captain: "Cap", color: "#00A0DC", captain_photo_url: null }));
  const many = Array.from({ length: 40 }, (_, i) => ({ ...player, id: i + 1, team_id: 1, name: `Player ${i}` }));
  const doc = await (await import("./lib/squadsPdf")).buildSquadsPdf(teams, many);
  expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(4); // cover, team 1 (overflows), team 2
  expect(String.fromCharCode(...new Uint8Array(doc.output("arraybuffer")).slice(0, 5))).toBe("%PDF-");
});
