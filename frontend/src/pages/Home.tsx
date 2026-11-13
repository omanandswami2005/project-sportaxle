import { Link } from "react-router-dom";
import { Logo, Wordmark } from "../components/Logo";
import { usePoll } from "../lib/api";
import type { Player, Team } from "../lib/types";

const SPORTS = "CRICKET · CARROM · TABLE TENNIS · CHESS · BADMINTON · ";

export default function Home() {
  const { data: teams } = usePoll<Team[]>("/teams", 30_000);
  const { data: players } = usePoll<Player[]>("/players", 30_000);

  return (
    <>
      <section className="stripes flex flex-col items-center px-4 py-16 text-center">
        <Logo className="h-32 w-32 animate-pop" />
        <h1 className="mt-6 text-6xl sm:text-8xl">
          <Wordmark />
        </h1>
        <p className="mt-2 font-display text-2xl font-extrabold">by Data Axle</p>
        <p className="mt-3 text-lg text-steel">Where Data Axle plays.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auction" className="btn text-lg">
            Watch the live auction
          </Link>
          <Link to="/leaderboard" className="btn-ghost text-lg">
            Points table
          </Link>
        </div>
      </section>

      <div className="-rotate-1 overflow-hidden bg-ink py-3 text-white" aria-hidden="true">
        <div className="flex w-max animate-ticker font-display text-2xl font-extrabold whitespace-pre">
          <span>{SPORTS.repeat(4)}</span>
          <span>{SPORTS.repeat(4)}</span>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-4xl">Teams &amp; captains</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {teams?.map((team) => {
            const squad = players?.filter((player) => player.team_id === team.id) ?? [];
            return (
              <article key={team.id} className="card overflow-hidden p-0" data-testid="team-card">
                <div className="h-2" style={{ background: team.color }} />
                <div className="p-4">
                  <h3 className="text-2xl">{team.name}</h3>
                  <p className="mt-1 text-sm text-steel">Captain</p>
                  <p className="font-bold">{team.captain}</p>
                  <p className="mt-3 text-sm text-steel">
                    Squad · {squad.length} {squad.length === 1 ? "player" : "players"}
                  </p>
                  <p className="text-sm">{squad.map((player) => player.name).join(", ") || "—"}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
