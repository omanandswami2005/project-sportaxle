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
