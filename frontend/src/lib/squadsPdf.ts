import type { jsPDF } from "jspdf";
import type { Player, Team } from "./types";

// Data Axle brand colours (the same values as the @theme tokens in index.css), as RGB for the PDF.
const INK: RGB = [34, 31, 32];
const BRAND: RGB = [0, 160, 220];
const BRAND_DARK: RGB = [0, 119, 168];
const MIST: RGB = [230, 244, 251];
const SKY: RGB = [127, 205, 241];
const STEEL: RGB = [60, 68, 86];
type RGB = [number, number, number];

/** What the builder needs from outside: font files (base64 TTF) and round photos (PNG data URLs
 *  keyed by photo URL). Both are optional, so the PDF always builds: Helvetica and initials. */
export type PdfAssets = {
  fonts?: { display: string; body: string; bold: string };
  photos?: Map<string, string>;
};

const W = 210;
const H = 297;
const M = 16; // page margin, mm
const BAND = 34; // header band height
const PHOTO = 9; // player photo diameter in the table
const COLS = { no: M + 4, photo: M + 12, name: M + 25, dept: M + 85, sports: M + 130 };

const ARMS = [
  [0, 0, 30, 0, 75, 60, 45, 60],
  [120, 0, 90, 0, 45, 60, 75, 60],
  [75, 60, 45, 60, 0, 120, 30, 120],
  [45, 60, 75, 60, 120, 120, 90, 120],
];

const rgb = (hex: string): RGB => {
  const n = parseInt(hex.replace("#", ""), 16);
  return Number.isNaN(n) ? BRAND : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

type Ctx = { doc: jsPDF; assets: PdfAssets };
type Face = "display" | "body" | "bold";

/** Switch font: the embedded brand fonts when loaded, otherwise built-in Helvetica. */
function face({ doc, assets }: Ctx, which: Face, size: number) {
  if (assets.fonts) doc.setFont(which === "display" ? "Bricolage" : "Inter", which === "bold" ? "bold" : "normal");
  else doc.setFont("helvetica", which === "body" ? "normal" : "bold");
  doc.setFontSize(size);
}

function embedFonts(doc: jsPDF, fonts: NonNullable<PdfAssets["fonts"]>) {
  doc.addFileToVFS("Bricolage-ExtraBold.ttf", fonts.display);
  doc.addFont("Bricolage-ExtraBold.ttf", "Bricolage", "normal");
  doc.addFileToVFS("Inter-Regular.ttf", fonts.body);
  doc.addFont("Inter-Regular.ttf", "Inter", "normal");
  doc.addFileToVFS("Inter-Bold.ttf", fonts.bold);
  doc.addFont("Inter-Bold.ttf", "Inter", "bold");
}

/** The Sports Axle mark: Data Axle's X with a blue ball at the axle, `size` mm square. */
function logo(doc: jsPDF, x: number, y: number, size: number, arms: RGB, ground: RGB) {
  const k = size / 120;
  doc.setFillColor(...arms);
  for (const p of ARMS) {
    const pts = p.map((v, i) => v * k + (i % 2 ? y : x));
    const rel: number[][] = [];
    for (let i = 2; i < pts.length; i += 2) rel.push([pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]]);
    doc.lines(rel, pts[0], pts[1], [1, 1], "F", true);
  }
  doc.setFillColor(...ground).circle(x + 60 * k, y + 60 * k, 17 * k, "F");
  doc.setFillColor(...BRAND).circle(x + 60 * k, y + 60 * k, 11 * k, "F");
}

/** A round photo if we have one, otherwise the initials on a tinted disc (as in the app). */
function avatar(ctx: Ctx, name: string, url: string | null, x: number, y: number, d: number, tint: RGB) {
  const { doc, assets } = ctx;
  const photo = url ? assets.photos?.get(url) : undefined;
  if (photo) return void doc.addImage(photo, "PNG", x, y, d, d);
  doc.setFillColor(...tint).circle(x + d / 2, y + d / 2, d / 2, "F");
  face(ctx, "bold", d * 0.95);
  doc.setTextColor(...BRAND_DARK).text(initials(name), x + d / 2, y + d / 2 + d * 0.13, { align: "center" });
}

function header(ctx: Ctx, subtitle: string) {
  const { doc } = ctx;
  doc.setFillColor(...INK).rect(0, 0, W, BAND, "F");
  doc.setFillColor(...BRAND).rect(0, BAND, W, 1.2, "F");
  logo(doc, M, 7, 20, [255, 255, 255], INK);
  face(ctx, "display", 22);
  doc.setTextColor(255, 255, 255).text("Sports", M + 26, 18);
  doc.setTextColor(...BRAND).text("Axle", M + 26 + doc.getTextWidth("Sports"), 18);
  face(ctx, "body", 9);
  doc.setTextColor(200, 205, 210).text("DATA AXLE INDIA  ·  " + subtitle.toUpperCase(), M + 26, 25);
}

function footer(ctx: Ctx, page: number, pages: number) {
  const { doc } = ctx;
  doc.setDrawColor(...MIST).setLineWidth(0.4).line(M, H - 14, W - M, H - 14);
  face(ctx, "body", 8);
  doc.setTextColor(...STEEL).text("Sports Axle · Data Axle India", M, H - 9);
  doc.text(`Page ${page} of ${pages}`, W - M, H - 9, { align: "right" });
}

function tableHead(ctx: Ctx, y: number) {
  const { doc } = ctx;
  doc.setFillColor(...INK).roundedRect(M, y, W - 2 * M, 8, 1.5, 1.5, "F");
  face(ctx, "bold", 8.5);
  doc.setTextColor(255, 255, 255);
  const base = y + 5.3;
  doc.text("#", COLS.no, base).text("PLAYER", COLS.name, base);
  doc.text("DEPARTMENT", COLS.dept, base).text("SPORTS", COLS.sports, base);
  return y + 10;
}

function cover(ctx: Ctx, teams: Team[], players: Player[]) {
  const { doc } = ctx;
  header(ctx, "Final squads");
  face(ctx, "display", 34);
  doc.setTextColor(...INK).text("Final squads", M, 62);
  doc.setFillColor(...BRAND).rect(M, 67, 24, 1.6, "F");
  face(ctx, "body", 11);
  const signed = players.filter((p) => p.team_id !== null).length;
  doc.setTextColor(...STEEL).text(`${teams.length} teams · ${signed} players signed`, M, 76);
  let y = 92;
  const dense = teams.length > 10;
  const step = dense ? Math.min(20, Math.floor((H - 115) / teams.length)) : 20;
  const avSize = dense ? Math.max(8, step - 4) : 12;
  for (const team of teams) {
    const count = players.filter((p) => p.team_id === team.id).length;
    doc.setFillColor(...rgb(team.color)).roundedRect(M, y - 5, 3, Math.max(7, avSize - 1), 1, 1, "F");
    avatar(ctx, team.captain, team.captain_photo_url, M + 8, y - 5.5, avSize, MIST);
    face(ctx, "display", dense ? 11.5 : 14);
    doc.setTextColor(...INK).text(team.name, M + 12 + avSize, y);
    face(ctx, "body", dense ? 8.5 : 10);
    doc.setTextColor(...STEEL).text(`Captain ${team.captain}`, M + 12 + avSize, y + (dense ? 4.2 : 5.5));
    face(ctx, "display", dense ? 13 : 16);
    doc.setTextColor(...BRAND_DARK).text(String(count), W - M, y + (dense ? 1.5 : 2), { align: "right" });
    y += step;
    if (y > H - 22) break;
  }
}

function teamPage(ctx: Ctx, team: Team, squad: Player[]) {
  const { doc } = ctx;
  header(ctx, "Squad");
  doc.setFillColor(...rgb(team.color)).rect(M, 46, 3, 22, "F");
  face(ctx, "display", 27);
  doc.setTextColor(...INK).text(team.name, M + 8, 56);
  face(ctx, "body", 11);
  doc.setTextColor(...STEEL);
  doc.text(`Captain ${team.captain}  ·  ${squad.length} ${squad.length === 1 ? "player" : "players"}`, M + 8, 64);
  avatar(ctx, team.captain, team.captain_photo_url, W - M - 22, 46, 22, MIST);
  let y = tableHead(ctx, 76);
  if (squad.length === 0) {
    face(ctx, "body", 10);
    doc.setTextColor(...STEEL).text("No players yet", M + 4, y + 6);
    return;
  }
  squad.forEach((p, i) => {
    face(ctx, "body", 9);
    const dept = doc.splitTextToSize(p.department, 42) as string[];
    const sports = doc.splitTextToSize(p.sports || "—", W - M - COLS.sports - 2) as string[];
    face(ctx, "bold", 10);
    const name = doc.splitTextToSize(p.name, 56) as string[];
    const rows = Math.max(dept.length, sports.length, name.length);
    const h = Math.max(PHOTO + 3.5, 4 + rows * 4.6);
    if (y + h > H - 20) {
      doc.addPage();
      header(ctx, `${team.name} · squad`);
      y = tableHead(ctx, BAND + 10);
    }
    const zebra = i % 2 === 0;
    if (zebra) doc.setFillColor(...MIST).rect(M, y, W - 2 * M, h, "F");
    const line = (lines: string[], x: number) => {
      const top = y + h / 2 - ((lines.length - 1) * 4.6) / 2 + 1.2;
      doc.text(lines, x, top, { lineHeightFactor: 1.35 });
    };
    face(ctx, "bold", 9);
    doc.setTextColor(...BRAND_DARK).text(String(i + 1), COLS.no, y + h / 2 + 1.2);
    avatar(ctx, p.name, p.photo_url, COLS.photo, y + (h - PHOTO) / 2, PHOTO, zebra ? SKY : MIST);
    face(ctx, "bold", 10);
    doc.setTextColor(...INK);
    line(name, COLS.name);
    face(ctx, "body", 9);
    doc.setTextColor(...STEEL);
    line(dept, COLS.dept);
    line(sports, COLS.sports);
    y += h;
  });
}

/** One cover page, then a page (or more) per team. Never includes prices: those are private. */
export async function buildSquadsPdf(teams: Team[], players: Player[], assets: PdfAssets = {}): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf"); // loaded only when someone asks for the PDF
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({ title: "Sports Axle · Final squads", author: "Data Axle India" });
  if (assets.fonts) embedFonts(doc, assets.fonts);
  const ctx: Ctx = { doc, assets };
  cover(ctx, teams, players);
  for (const team of teams) {
    doc.addPage();
    teamPage(ctx, team, players.filter((p) => p.team_id === team.id));
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    footer(ctx, page, pages);
  }
  return doc;
}
