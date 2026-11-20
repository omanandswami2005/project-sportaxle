import type { Team } from "./types";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const money = (amount: number) => rupees.format(amount);

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");

export const teamName = (teams: Team[] | undefined, id: number | null) =>
  teams?.find((team) => team.id === id)?.name ?? "—";

// Fixture times are event-local wall-clock strings ("2026-11-25T10:00:00"); new Date() reads them as local.
const day = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });
const clock = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

export const fixtureDay = (startsAt: string) => day.format(new Date(startsAt));
export const fixtureTime = (startsAt: string) => clock.format(new Date(startsAt));

/** Distinct sport names, case-insensitive, first spelling wins, alphabetical. */
export function sportsOf(rows: { sport: string }[] | undefined) {
  const seen = new Map<string, string>();
  for (const { sport } of rows ?? []) {
    const key = sport.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, sport.trim());
  }
  return [...seen.values()].sort();
}
