import type { ReactNode } from "react";
import { initials } from "../lib/format";
import type { Player, PlayerStatus } from "../lib/types";

const BADGE: Record<PlayerStatus, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-mist text-brand-dark" },
  sold: { label: "Sold", className: "bg-ink text-white" },
  unsold: { label: "Unsold", className: "bg-fog text-steel" },
};

/** The sports a player signed up for, one chip each. */
export function SportChips({ sports, className = "", big = false }: { sports: string; className?: string; big?: boolean }) {
  const list = sports.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Sports">
      {list.map((sport) => (
        <li
          key={sport}
          className={`rounded-full ${big ? "bg-white/15 px-[1.6vh] py-[0.6vh] text-[2.6vh] font-bold text-white" : "bg-mist px-2.5 py-0.5 text-xs font-bold text-brand-dark"}`}
        >
          {sport}
        </li>
      ))}
    </ul>
  );
}

export function StatusBadge({ status }: { status: PlayerStatus }) {
  const { label, className } = BADGE[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${className}`}>
      {label}
    </span>
  );
}

/** A photo, or the person's initials when there is none. Used for players and captains. */
export function Avatar({ name, src, className = "h-16 w-16 text-xl" }: { name: string; src: string | null; className?: string }) {
  const shape = `shrink-0 rounded-2xl object-cover ${className}`;
  return src ? (
    <img src={src} alt={name} className={shape} />
  ) : (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center bg-mist font-display font-extrabold text-brand-dark ${shape}`}
    >
      {initials(name)}
    </div>
  );
}

/** One player row. `footer` lets a page add what only it may show (team, price). */
export function PlayerCard({ player, footer }: { player: Player; footer?: ReactNode }) {
  return (
    <article className="card flex gap-4">
      <Avatar name={player.name} src={player.photo_url} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-lg">{player.name}</h3>
          <StatusBadge status={player.status} />
        </div>
        <p className="text-sm font-medium text-brand-dark">{player.department}</p>
        <SportChips sports={player.sports} />
        {footer && <div className="mt-2 text-sm">{footer}</div>}
      </div>
    </article>
  );
}
