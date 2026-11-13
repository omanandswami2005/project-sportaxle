import { useState, type FormEvent } from "react";
import { Avatar, StatusBadge } from "../components/PlayerCard";
import { api, usePoll } from "../lib/api";
import { useAuth } from "../lib/auth";
import { money, teamName } from "../lib/format";
import type { AuctionState, Dashboard, Team } from "../lib/types";

export default function Auction() {
  const { session } = useAuth();
  const isCaptain = session?.role === "captain";
  const { data: state, refresh } = usePoll<AuctionState>("/auction", 1000);
  const { data: teams } = usePoll<Team[]>("/teams", 60_000);
  // Only the signed-in captain ever receives their own purse.
  const { data: mine, refresh: refreshMine } = usePoll<Dashboard>(isCaptain ? "/me/dashboard" : null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string>();

  const act = async (path: string, body?: unknown) => {
    try {
      await api(`/auction/${path}`, "POST", body);
      setError(undefined);
      setCustom("");
    } catch (err) {
      setError((err as Error).message);
    }
    refresh();
    refreshMine();
  };

  const submitCustom = (event: FormEvent) => {
    event.preventDefault();
    act("bid", { amount: Number(custom) });
  };

  if (!state) return <p className="p-10 text-center text-steel">Loading auction…</p>;
  const { player, bid, min_bid, last } = state;
  const leading = isCaptain && state.team_id === session.team_id;

  return (
    <section className="stripes min-h-[70vh] px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="flex items-center gap-2 font-bold uppercase">
          <span className="h-3 w-3 animate-pulse rounded-full bg-brand" /> Live auction
        </p>

        {player ? (
          <article className="card mt-4 p-6 sm:p-8" data-testid="on-block">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <Avatar player={player} className="h-40 w-40 text-5xl" />
              <div className="text-center sm:text-left">
                <h1 className="text-4xl sm:text-5xl">{player.name}</h1>
                <p className="mt-1 text-lg font-bold text-brand-dark">{player.department}</p>
                <p className="text-steel">{player.details}</p>
                <p className="mt-2 text-sm text-steel">Base price {money(player.base_price)}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-ink p-6 text-center text-white" aria-live="polite">
              <p className="text-sm tracking-widest text-sky uppercase">
                {bid === null ? "Waiting for the first bid" : "Current bid"}
              </p>
              <p key={bid} className="animate-pop font-display text-6xl font-extrabold" data-testid="current-bid">
                {money(bid ?? player.base_price)}
              </p>
              {bid !== null && (
                <p className="mt-1 text-lg">
                  Leading: <b>{teamName(teams, state.team_id)}</b>
                </p>
              )}
            </div>

            {isCaptain && min_bid !== null && (
              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <button className="btn text-lg" disabled={leading} onClick={() => act("bid", { amount: min_bid })}>
                    Bid {money(min_bid)}
                  </button>
                  <form onSubmit={submitCustom} className="flex gap-2">
                    <input
                      className="field w-36"
                      type="number"
                      min={min_bid}
                      placeholder="Your amount"
                      aria-label="Custom bid amount"
                      value={custom}
                      onChange={(event) => setCustom(event.target.value)}
                    />
                    <button className="btn-ghost" disabled={leading || !custom}>
                      Bid
                    </button>
                  </form>
                </div>
                <p className="mt-3 text-sm text-steel">
                  {leading && <b className="text-brand-dark">You hold the highest bid. </b>}
                  {mine && <>Your remaining purse: <b className="text-ink">{money(mine.remaining)}</b></>}
                </p>
              </div>
            )}
          </article>
        ) : (
          <article className="card mt-4 p-8 text-center">
            <h1 className="text-3xl">Waiting for the next player</h1>
            {last && (
              <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-lg" data-testid="last-result">
                <b>{last.name}</b> <StatusBadge status={last.status} />
                {last.status === "sold" && <>to <b>{teamName(teams, last.team_id)}</b></>}
              </p>
            )}
          </article>
        )}

        {session?.role === "admin" && (
          <div className="card mt-4 flex flex-wrap items-center gap-3">
            <b>Auctioneer</b>
            <button className="btn" disabled={!!player} onClick={() => act("next")}>
              Next player
            </button>
            <button className="btn-ghost" disabled={!player} onClick={() => act("close")}>
              {bid === null ? "Mark unsold" : "Sold!"}
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-ink px-4 py-3 font-bold text-white">
            {error}
          </p>
        )}
        {!session && <p className="mt-4 text-center text-sm text-steel">Captains: sign in to bid.</p>}
      </div>
    </section>
  );
}
