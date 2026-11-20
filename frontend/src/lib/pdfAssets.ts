import bricolage from "../assets/fonts/Bricolage-ExtraBold.ttf?url";
import interBold from "../assets/fonts/Inter-Bold.ttf?url";
import interRegular from "../assets/fonts/Inter-Regular.ttf?url";
import type { PdfAssets } from "./squadsPdf";
import type { Player, Team } from "./types";

const PHOTO_PX = 160; // enough for a 22 mm circle at print quality, small enough for 150 players

async function base64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Crop to the centre square and clip to a circle, like the avatars on the site. */
async function roundPhoto(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  const bitmap = await createImageBitmap(await res.blob());
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_PX;
  const g = canvas.getContext("2d")!;
  g.beginPath();
  g.arc(PHOTO_PX / 2, PHOTO_PX / 2, PHOTO_PX / 2, 0, Math.PI * 2);
  g.clip();
  g.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
  return canvas.toDataURL("image/png");
}

/** Fetch the brand fonts and every photo. Anything that fails is skipped: the PDF falls back to
 *  Helvetica and to initials, so a missing photo or font never blocks the download. */
export async function loadPdfAssets(teams: Team[], players: Player[]): Promise<PdfAssets> {
  const urls = [...new Set([...teams.map((t) => t.captain_photo_url), ...players.map((p) => p.photo_url)])].filter(
    (u): u is string => !!u,
  );
  const [fonts, photos] = await Promise.all([
    Promise.all([base64(bricolage), base64(interRegular), base64(interBold)]).then(
      ([display, body, bold]) => ({ display, body, bold }),
      () => undefined,
    ),
    Promise.allSettled(urls.map(async (u) => [u, await roundPhoto(u)] as const)),
  ]);
  const ok = photos.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  return { fonts, photos: new Map(ok) };
}
