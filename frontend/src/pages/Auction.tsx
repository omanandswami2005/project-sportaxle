import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Avatar, SportChips, StatusBadge } from "../components/PlayerCard";
import { api, usePoll } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useSecondsLeft } from "../lib/countdown";
import { money, teamName } from "../lib/format";
import type { AuctionState, Dashboard, Player, Team } from "../lib/types";

/** Server-kept countdown; when it reaches zero the latest bid wins. */
export function Countdown({ seconds, paused = false }: { seconds: number; paused?: boolean }) {
  const urgent = !paused && seconds <= 10;
  const call = paused ? "Paused" : seconds <= 5 ? "Going twice…" : urgent ? "Going once…" : "Bidding closes in";
  return (
    <div className="mt-4 flex items-center justify-center gap-3" data-testid="countdown">
      <span className="text-sm tracking-widest text-sky uppercase">{call}</span>
      <span
        className={`rounded-full px-3 py-0.5 font-display text-2xl font-extrabold tabular-nums ${
          urgent ? "animate-pulse bg-white text-ink" : "bg-white/10"
        }`}
      >
        0:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}

/** The auctioneer's controls: pick who goes next, pause, close, undo. */
function AuctioneerPanel({ state, act }: { state: AuctionState; act: (path: string, body?: unknown) => Promise<void> }) {
  const { data: players, refresh: refreshPlayers } = usePoll<Player[]>("/players", 3000);
  const [pick, setPick] = useState("");
  const { player, bid, paused, last } = state;
  const waiting = players?.filter((p) => p.status !== "sold") ?? [];
  const run = async (path: string, body?: unknown) => {
    await act(path, body);
    refreshPlayers();
  };

  return (
    <div className="card mt-4 space-y-3">
      <b>Auctioneer</b>
      {player ? (
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn" onClick={() => run(paused ? "resume" : "pause")}>
            {paused ? "Resume bidding" : "Pause bidding"}
          </button>
          <button
            className="btn"
            onClick={async () => {
              await act("close");
              await run("next"); // straight on to the next (random) player
            }}
          >
            {bid === null ? "Unsold & next player →" : "Sold! & next player →"}
          </button>
          <button className="btn-ghost" onClick={() => run("close")}>
            {bid === null ? "Mark unsold" : "Sold!"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-bold">
            Next player
            <select className="field mt-1 font-normal" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Random player</option>
              {waiting.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === "unsold" ? " (unsold)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            onClick={() => (run("next", pick ? { player_id: Number(pick) } : undefined), setPick(""))}
          >
            Next player
          </button>
          {last && (
            <button className="btn-ghost" onClick={() => run("undo")}>
              Undo: put {last.name} back up
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Auction() {
  const { session } = useAuth();
  const isCaptain = session?.role === "captain";
  const { data: state, setData: setState, refresh } = usePoll<AuctionState>("/auction", 1000);
  const seconds = useSecondsLeft(state);
  const { data: teams } = usePoll<Team[]>("/teams", 60_000);
  // Only the signed-in captain ever receives their own purse.
  const { data: mine, refresh: refreshMine } = usePoll<Dashboard>(isCaptain ? "/me/dashboard" : null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string>();

  const act = async (path: string, body?: unknown) => {
    try {
      const next = await api<AuctionState>(`/auction/${path}`, "POST", body);
      setState(next);
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
  // The captain's own purse and squad (their dashboard) decide whether bidding is possible at all.
  const broke = !!mine && min_bid !== null && mine.remaining < min_bid;
  const full = !!mine && state.squad_limit !== null && mine.players.length >= state.squad_limit;
  const blocked = leading || broke || full;

  return (
    <section className="stripes min-h-[70vh] px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="flex items-center gap-2 font-bold uppercase">
          <span className="h-3 w-3 animate-pulse rounded-full bg-brand" /> Live auction
        </p>

        {player ? (
          <article className="card mt-4 p-6 sm:p-8" data-testid="on-block">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <Avatar name={player.name} src={player.photo_url} className="h-40 w-40 text-5xl" />
              <div className="text-center sm:text-left">
                <h1 className="text-4xl sm:text-5xl">{player.name}</h1>
                <p className="mt-1 text-lg font-bold text-brand-dark">{player.department}</p>
                <SportChips sports={player.sports} className="mt-2 justify-center sm:justify-start" />
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
              {seconds !== null && <Countdown seconds={seconds} paused={state.paused} />}
            </div>

            {isCaptain && min_bid !== null && (
              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <button className="btn text-lg" disabled={blocked} onClick={() => act("bid", { amount: min_bid })}>
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
                    <button className="btn-ghost" disabled={blocked || !custom}>
                      Bid
                    </button>
                  </form>
                </div>
                <p className="mt-3 text-sm text-steel">
                  {leading && <b className="text-brand-dark">You hold the highest bid. </b>}
                  {full && <b className="text-brand-dark">Your squad is full ({state.squad_limit} players). </b>}
                  {broke && !full && <b className="text-brand-dark">Not enough purse for this player. </b>}
                  {mine && <>Your remaining purse: <b className="text-ink">{money(mine.remaining)}</b></>}
                  {mine && state.squad_limit !== null && <> · Squad {mine.players.length}/{state.squad_limit}</>}
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

        {session?.role === "admin" && <AuctioneerPanel state={state} act={act} />}
        <p className="mt-4 text-center">
          <Link to="/screen" target="_blank" className="font-bold text-brand-dark underline">
            Open the big screen for the projector ↗
          </Link>
        </p>

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
