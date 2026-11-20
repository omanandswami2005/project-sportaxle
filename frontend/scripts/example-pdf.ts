// Builds docs/example/squads-example.pdf from the demo seed, with generated placeholder portraits.
// Run: make example-pdf   (Node runs TypeScript directly; nothing here is real staff data.)
import { readFileSync, writeFileSync } from "node:fs";
import { buildSquadsPdf } from "../src/lib/squadsPdf.ts";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const font = (name: string) => readFileSync(new URL(`../src/assets/fonts/${name}`, import.meta.url)).toString("base64");

const seed = JSON.parse(read("backend/seed.example.json").toString());
const portraits = [1, 2, 3, 4, 5, 6].map((n) => `data:image/png;base64,${read(`docs/example/avatars/${n}.png`).toString("base64")}`);

const teams = seed.teams.map((t: any, i: number) => ({ id: i + 1, name: t.name, captain: t.captain, color: t.color, captain_photo_url: `captain/${i}` }));
const players = seed.players.map((p: any, i: number) => ({
  id: i + 1, ...p, base_price: 0, status: "sold", team_id: (i % teams.length) + 1,
  photo_url: i % 3 === 2 ? null : `player/${i}`, // every third player has no photo: shows the initials
}));

const photos = new Map<string, string>();
teams.forEach((t: any, i: number) => photos.set(`captain/${i}`, portraits[i % portraits.length]));
players.forEach((p: any, i: number) => p.photo_url && photos.set(p.photo_url, portraits[(i + 2) % portraits.length]));

const doc = await buildSquadsPdf(teams, players, {
  fonts: { display: font("Bricolage-ExtraBold.ttf"), body: font("Inter-Regular.ttf"), bold: font("Inter-Bold.ttf") },
  photos,
});
writeFileSync(new URL("docs/example/squads-example.pdf", root), Buffer.from(doc.output("arraybuffer")));
console.log(`docs/example/squads-example.pdf: ${doc.getNumberOfPages()} pages`);
