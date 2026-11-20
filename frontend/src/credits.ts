// Who made Sports Axle happen. Edit this list; sections with no people are not shown.
export type Credit = { name: string; role?: string };
export type CreditSection = { title: string; people: Credit[] };

export const CREDITS: CreditSection[] = [
  { title: "Under the guidance of", people: [{ name: "Sunil Mandaliya", role: "Guidance" }] },
  { title: "Built by", people: [] },
];
