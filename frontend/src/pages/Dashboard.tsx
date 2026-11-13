import { Navigate } from "react-router-dom";
import { PlayerCard } from "../components/PlayerCard";
import { usePoll } from "../lib/api";
import { useAuth } from "../lib/auth";
import { money } from "../lib/format";
import type { Dashboard as DashboardData } from "../lib/types";

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${strong ? "bg-ink text-white" : "bg-mist"}`}>
      <p className="text-sm tracking-widest uppercase opacity-70">{label}</p>
      <p className="font-display text-4xl font-extrabold" data-testid={label}>
        {value}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { session } = useAuth();
  const isCaptain = session?.role === "captain";
  const { data } = usePoll<DashboardData>(isCaptain ? "/me/dashboard" : null);

  if (!isCaptain) return <Navigate to="/login" replace />;
  if (!data) return <p className="p-10 text-center text-steel">Loading your dashboard…</p>;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm font-bold tracking-widest text-brand-dark uppercase">Captain · private</p>
      <h1 className="text-4xl">{data.team.name}</h1>
      <p className="text-steel">{data.team.captain}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Remaining purse" value={money(data.remaining)} strong />
        <Stat label="Total spent" value={money(data.spent)} />
        <Stat label="Starting purse" value={money(data.purse)} />
      </div>

      <h2 className="mt-10 text-2xl">Your squad · {data.players.length}</h2>
      {data.players.length === 0 && <p className="mt-2 text-steel">No players bought yet.</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.players.map((player) => (
          <PlayerCard key={player.id} player={player} footer={<>Bought for <b>{money(player.sold_price)}</b></>} />
        ))}
      </div>
    </section>
  );
}
