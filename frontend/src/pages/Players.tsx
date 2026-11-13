import { useState } from "react";
import { PlayerCard } from "../components/PlayerCard";
import { usePoll } from "../lib/api";
import { teamName } from "../lib/format";
import type { Player, PlayerStatus, Team } from "../lib/types";

const FILTERS: { value: PlayerStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "sold", label: "Sold" },
  { value: "unsold", label: "Unsold" },
];

export default function Players() {
  const { data: players } = usePoll<Player[]>("/players");
  const { data: teams } = usePoll<Team[]>("/teams", 60_000);
  const [filter, setFilter] = useState<PlayerStatus | "all">("all");

  const shown = players?.filter((player) => filter === "all" || player.status === filter) ?? [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl">Players</h1>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter players">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={filter === value ? "btn" : "btn-ghost"}
          >
            {label} · {players?.filter((p) => value === "all" || p.status === value).length ?? 0}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            footer={player.status === "sold" && <>Sold to <b>{teamName(teams, player.team_id)}</b></>}
          />
        ))}
      </div>
      {players && shown.length === 0 && <p className="mt-6 text-steel">No players here yet.</p>}
    </section>
  );
}
