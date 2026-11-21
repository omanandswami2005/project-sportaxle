import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Confetti } from "../components/Confetti";
import { CreditsShow } from "./Credits";
import { Logo, Wordmark } from "../components/Logo";
import { Avatar, SportChips } from "../components/PlayerCard";
import { usePoll } from "../lib/api";
import { money } from "../lib/format";
import { preloadImages } from "../lib/preload";
import { enableSound, soundOn, sounds } from "../lib/sound";
import type { AuctionState, Player, Team } from "../lib/types";

/** Projector view of the live auction: huge type, the countdown and a SOLD splash.
 *  Covers the site header; prices of past sales are never shown (they are private). */
export default function Screen() {
  const { data: state } = usePoll<AuctionState>("/auction", 1000);
  const { data: teams } = usePoll<Team[]>("/teams", 30_000);
  const { data: players } = usePoll<Player[]>("/players", 30_000);
  const team = (id: number | null) => teams?.find((t) => t.id === id);
  const [sound, setSound] = useState(false);

  // Warm every photo the reveal could need, so none of them waits on the network.
  useEffect(() => preloadImages([...(teams ?? []).map((t) => t.captain_photo_url), ...(players ?? []).map((p) => p.photo_url)]), [teams, players]);
  useAuctionSounds(state, sound);

  return (
    <div className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-ink text-white">
      <div className="hero-stripes" aria-hidden="true" />
      <div className="credits-glow" aria-hidden="true" />
      <header className="relative flex items-center gap-4 px-[4vw] pt-[3vh]">
        <Logo light className="h-[6vh] w-[6vh]" />
        <Wordmark className="text-[4vh] text-white" />
        <span className="ml-auto flex items-center gap-3 text-[2.4vh] font-bold tracking-widest uppercase">
          <span className="h-[1.6vh] w-[1.6vh] animate-pulse rounded-full bg-brand" /> Live auction
        </span>
        <button
          type="button"
          onClick={() => enableSound(!sound).then(setSound)}
          className="rounded-full border border-white/30 px-[1.4vh] py-[0.6vh] text-[1.8vh] text-white/70"
        >
          {sound ? "Sound on" : "Enable sound"}
        </button>
        <Link to="/auction" className="text-[1.8vh] text-white/50 underline">
          Exit
        </Link>
      </header>

      <main className={`relative flex flex-1 items-center ${state && !state.player && !state.last ? "pb-[2vh]" : "px-[4vw]"}`}>
        {!state ? null : state.player ? (
          <OnBlock state={state} leader={team(state.team_id)} />
        ) : state.last ? (
          <Result key={state.last.id} state={state} buyer={team(state.last.team_id)} />
        ) : (
          <CreditsShow /> // before the first player: roll the credits until "Next player"
        )}
      </main>
    </div>
  );
}

function OnBlock({ state, leader }: { state: AuctionState; leader?: Team }) {
  const player = state.player!;
  const seconds = state.seconds_left ?? 0;
  const urgent = !state.paused && seconds <= 10;
  return (
    <div className="grid w-full grid-cols-[auto_1fr] items-center gap-[4vw]" data-testid="screen-on-block">
      <Avatar name={player.name} src={player.photo_url} className="h-[52vh] w-[52vh] text-[16vh]" />
      <div className="min-w-0">
        <p className="text-[2.6vh] font-bold tracking-widest text-sky uppercase">{player.department}</p>
        <h1 className="truncate text-[11vh] leading-none">{player.name}</h1>
        <SportChips sports={player.sports} className="mt-[1.5vh]" big />

        <div className="mt-[4vh] flex flex-wrap items-end gap-[3vw]">
          <div>
            <p className="text-[2.2vh] tracking-widest text-sky uppercase">
              {state.bid === null ? `Opens at` : "Current bid"}
            </p>
            <p key={state.bid} className="animate-pop font-display text-[14vh] leading-none font-extrabold tabular-nums">
              {money(state.bid ?? player.base_price)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[2.2vh] tracking-widest text-sky uppercase">
              {state.paused ? "Paused" : seconds <= 5 ? "Going twice…" : urgent ? "Going once…" : "Closes in"}
            </p>
            <p
              className={`rounded-[2vh] px-[2vh] font-display text-[11vh] leading-none font-extrabold tabular-nums ${
                urgent ? "animate-pulse bg-white text-ink" : "bg-white/10"
              }`}
              data-testid="screen-countdown"
            >
              0:{String(seconds).padStart(2, "0")}
            </p>
          </div>
        </div>

        <div className="mt-[4vh] flex items-center gap-[1.5vw] text-[3.4vh]">
          {leader ? (
            <>
              <span className="h-[5vh] w-[1vh] rounded-full" style={{ background: leader.color }} />
              <Avatar name={leader.captain} src={leader.captain_photo_url} className="h-[7vh] w-[7vh] text-[2.6vh]" />
              <span>
                Leading: <b>{leader.name}</b>
              </span>
            </>
          ) : (
            <span className="text-white/60">Waiting for the first bid</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Result({ state, buyer }: { state: AuctionState; buyer?: Team }) {
  const player = state.last!;
  const sold = player.status === "sold";
  return (
    <div className="relative w-full text-center" data-testid="screen-result">
      {sold && <Confetti count={60} reach={320} />}
      <p
        className={`rise font-display text-[22vh] leading-none font-extrabold ${sold ? "text-brand" : "text-white/50"}`}
      >
        {sold ? "SOLD!" : "UNSOLD"}
      </p>
      <div className="rise mt-[3vh] flex items-center justify-center gap-[2vw]" style={{ animationDelay: "0.2s" }}>
        <Avatar name={player.name} src={player.photo_url} className="h-[16vh] w-[16vh] text-[6vh]" />
        <p className="text-left text-[7vh] leading-tight font-extrabold">
          {player.name}
          {sold && buyer && (
            <span className="block text-[4.5vh] font-bold text-white/80">
              to{" "}
              <span
                className="mr-[1vh] inline-block h-[3.5vh] w-[3.5vh] rounded-full align-middle ring-[0.4vh] ring-white/60"
                style={{ background: buyer.color }}
              />
              {buyer.name}
            </span>
          )}
        </p>
        {sold && buyer && (
          <Avatar name={buyer.captain} src={buyer.captain_photo_url} className="h-[16vh] w-[16vh] text-[6vh]" />
        )}
      </div>
      <p className="mt-[5vh] text-[2.6vh] text-white/50">Next player coming up…</p>
    </div>
  );
}

/** Plays a cue when the bid changes, in the last five seconds, and when a player is sold. */
function useAuctionSounds(state: AuctionState | undefined, on: boolean) {
  const prev = useRef<AuctionState | undefined>(undefined);
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (!on || !state || !before || !soundOn()) return;
    if (state.player && state.bid !== before.bid && state.bid !== null) sounds.bid();
    else if (state.player && !state.paused && state.seconds_left !== before.seconds_left && (state.seconds_left ?? 99) <= 5) sounds.tick();
    if (before.player && !state.player && state.last) state.last.status === "sold" ? sounds.sold() : sounds.unsold();
  }, [state, on]);
}
