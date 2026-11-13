// Fast UI unit tests: render to a string, no browser or DOM emulation needed.
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PlayerCard } from "./components/PlayerCard";
import { initials, money, teamName } from "./lib/format";
import type { Player } from "./lib/types";

const player: Player = {
  id: 1,
  name: "Kabir Shah",
  department: "Engineering",
  details: "All-rounder",
  photo_url: null,
  base_price: 500,
  status: "sold",
  team_id: 2,
};

test("format helpers", () => {
  expect(money(125000)).toBe("₹1,25,000");
  expect(initials("kabir shah")).toBe("KS");
  expect(initials("  Cher ")).toBe("C");
  expect(teamName([{ id: 2, name: "Bravo", captain: "B", color: "#000" }], 2)).toBe("Bravo");
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
    <PlayerCard player={{ ...player, status: "available", photo_url: "/photos/kabir.jpg" }} />,
  );
  expect(html).toContain('src="/photos/kabir.jpg"');
  expect(html).toContain("Available");
  expect(html).not.toContain("₹");
});
