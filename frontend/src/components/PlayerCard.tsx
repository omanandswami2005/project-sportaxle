import type { ReactNode } from "react";
import { initials } from "../lib/format";
import type { Player, PlayerStatus } from "../lib/types";

const BADGE: Record<PlayerStatus, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-mist text-brand-dark" },
  sold: { label: "Sold", className: "bg-ink text-white" },
  unsold: { label: "Unsold", className: "bg-fog text-steel" },
};

export function StatusBadge({ status }: { status: PlayerStatus }) {
  const { label, className } = BADGE[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${className}`}>
      {label}
    </span>
  );
}

export function Avatar({ player, className = "h-16 w-16 text-xl" }: { player: Player; className?: string }) {
  const shape = `shrink-0 rounded-2xl object-cover ${className}`;
  return player.photo_url ? (
    <img src={player.photo_url} alt={player.name} className={shape} />
  ) : (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center bg-mist font-display font-extrabold text-brand-dark ${shape}`}
    >
      {initials(player.name)}
    </div>
  );
}

/** One player row. `footer` lets a page add what only it may show (team, price). */
export function PlayerCard({ player, footer }: { player: Player; footer?: ReactNode }) {
  return (
    <article className="card flex gap-4">
      <Avatar player={player} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-lg">{player.name}</h3>
          <StatusBadge status={player.status} />
        </div>
        <p className="text-sm font-medium text-brand-dark">{player.department}</p>
        <p className="truncate text-sm text-steel">{player.details}</p>
        {footer && <div className="mt-2 text-sm">{footer}</div>}
      </div>
    </article>
  );
}
