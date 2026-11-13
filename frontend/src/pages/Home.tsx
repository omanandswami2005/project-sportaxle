import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { usePoll } from "../lib/api";
import { initials, money, teamName } from "../lib/format";
import { CountUp, Reveal, Tilt, useInView } from "../lib/motion";
import type { AuctionState, Player, Standing, Team } from "../lib/types";

const FILM = `${import.meta.env.BASE_URL}media/SportsAxle_by_DataAxle.mp4`;
const ORBIT = ["🏏", "🏸", "♟️", "🏓", "🎯"];
const BANDS = [
  { text: "CRICKET · CARROM · TABLE TENNIS · CHESS · BADMINTON · ", className: "bg-brand text-ink" },
  { text: "AUCTION · TEAMS · SCORES · WINNERS · ", className: "-rotate-2 bg-ink text-white", reverse: true },
  { text: "PLAY · CHEER · REPEAT · ", className: "bg-mist text-ink" },
];
const PITCH = [
  ["Bid for ", "your squad."],
  ["Track ", "every match."],
  ["Celebrate ", "every win."],
];
const CONFETTI = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * Math.PI * 2;
  const reach = 130 + ((i * 53) % 110);
  return {
    "--x": `${Math.round(Math.cos(angle) * reach)}px`,
    "--y": `${Math.round(Math.sin(angle) * reach * 0.8)}px`,
    "--r": `${(i * 137) % 720}deg`,
    background: ["#00a0dc", "#ffffff", "#7fcdf1"][i % 3],
    animationDelay: `${1 + (i % 5) * 0.02}s`,
  } as CSSProperties;
});

/** Letters drop in one by one, like the film's title card. */
function Letters({ text, start, className = "" }: { text: string; start: number; className?: string }) {
  return [...text].map((char, i) => (
    <span key={i} className={`letter ${className}`} style={{ animationDelay: `${start + i * 0.05}s` }}>
      {char}
    </span>
  ));
}

function Hero({ auction, teams }: { auction?: AuctionState; teams?: Team[] }) {
  // The spotlight follows the pointer via two CSS variables: no re-render.
  const spotlight = (event: MouseEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - box.top}px`);
  };

  return (
    <section className="hero relative overflow-hidden bg-ink px-4 pt-10 pb-28 text-center text-white" onMouseMove={spotlight}>
      <div className="hero-stripes" aria-hidden="true" />
      <div className="hero-spot" aria-hidden="true" />

      <div className="relative flex flex-col items-center">
        {auction?.player ? (
          <Link to="/auction" className="live-pill" data-testid="live-pill">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" />
            <b>LIVE</b> {auction.player.name} is on the block ·{" "}
            {auction.bid === null
              ? `opens at ${money(auction.player.base_price)}`
              : `${money(auction.bid)} · ${teamName(teams, auction.team_id)}`}{" "}
            →
          </Link>
        ) : (
          <span className="live-pill">Data Axle India · Sports league</span>
        )}

        <div className="relative mt-14 mb-10 h-40 w-40 sm:h-48 sm:w-48">
          <div className="orbit" aria-hidden="true">
            {ORBIT.map((icon, i) => (
              <span key={icon} style={{ "--a": `${(i / ORBIT.length) * 360}deg` } as CSSProperties}>
                <i>{icon}</i>
              </span>
            ))}
          </div>
          <Logo light animated className="h-full w-full" />
          <div className="absolute top-1/2 left-1/2" aria-hidden="true">
            {CONFETTI.map((style, i) => (
              <b key={i} className="confetti" style={style} />
            ))}
          </div>
        </div>

        <h1 className="text-6xl leading-none sm:text-8xl lg:text-9xl" aria-label="SportsAxle">
          <Letters text="Sports" start={1} />
          <Letters text="Axle" start={1.3} className="text-brand" />
        </h1>
        <p className="rise mt-3 font-display text-2xl font-extrabold sm:text-3xl" style={{ animationDelay: "1.7s" }}>
          by Data Axle
        </p>
        <p className="rise mt-3 max-w-xl text-lg text-white/70" style={{ animationDelay: "1.9s" }}>
          Where Data Axle plays. One live auction, every team, every result, all in one place.
        </p>
        <div className="rise mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "2.1s" }}>
          <Link to="/auction" className="btn-glow text-lg">
            Watch the live auction
          </Link>
          <Link to="/leaderboard" className="btn-ghost border-white/40 text-lg text-white hover:bg-white/10">
            Points table
          </Link>
        </div>
      </div>
    </section>
  );
}

function Stats({ items }: { items: [string, number][] }) {
  return (
    <div className="relative z-[1] mx-auto -mt-16 grid max-w-5xl grid-cols-2 gap-3 px-4 sm:grid-cols-4">
      {items.map(([label, value], i) => (
        <Reveal key={label} delay={i * 90}>
          <div className="rounded-2xl border border-ink/10 bg-white p-5 text-center shadow-xl shadow-brand/10">
            <p className="font-display text-5xl font-extrabold text-brand-dark tabular-nums">
              <CountUp value={value} />
            </p>
            <p className="text-sm font-bold tracking-widest uppercase">{label}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function Film() {
  const { ref, inView } = useInView<HTMLVideoElement>(0.5, false);
  const [muted, setMuted] = useState(true); // browsers only autoplay muted video

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (inView) video.play().catch(() => {});
    else video.pause();
  }, [inView, ref]);

  return (
    <section className="stripes px-4 py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[2fr_3fr]">
        <div>
          <p className="text-sm font-bold tracking-widest text-brand-dark uppercase">The film</p>
          <div className="mt-3 space-y-3">
            {PITCH.map(([lead, rest], i) => (
              <Reveal key={lead} from="left" delay={i * 180}>
                <h2 className="text-3xl sm:text-4xl sm:whitespace-nowrap">
                  {lead}
                  <span className="text-brand">{rest}</span>
                </h2>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal from="right">
          <div className="film-frame relative">
            <video
              ref={ref}
              src={FILM}
              muted={muted}
              loop
              playsInline
              controls
              preload="metadata"
              aria-label="Sports Axle by Data Axle: the film"
              className="block aspect-video w-full rounded-2xl bg-ink"
              onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
            />
            {muted && (
              <button className="btn absolute top-3 right-3 py-1.5 text-sm" onClick={() => setMuted(false)}>
                🔊 Turn sound on
              </button>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Teams({ teams, players }: { teams?: Team[]; players?: Player[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <Reveal>
        <p className="text-sm font-bold tracking-widest text-brand-dark uppercase">The contenders</p>
        <h2 className="text-4xl sm:text-5xl">Teams &amp; captains</h2>
      </Reveal>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {teams?.map((team, i) => {
          const squad = players?.filter((player) => player.team_id === team.id) ?? [];
          return (
            <Reveal key={team.id} delay={i * 100}>
              <Tilt className="team-card" style={{ "--team": team.color } as CSSProperties} testId="team-card">
                <div className="relative h-28 overflow-hidden rounded-t-2xl" style={{ background: team.color }}>
                  <span className="team-initial" aria-hidden="true">
                    {initials(team.name.replace(/^team\s+/i, "")).charAt(0)}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-2xl">{team.name}</h3>
                  <p className="mt-2 text-xs font-bold tracking-widest text-steel uppercase">Captain</p>
                  <p className="text-lg font-bold">{team.captain}</p>
                  <p className="mt-4 text-xs font-bold tracking-widest text-steel uppercase">
                    Squad · {squad.length} {squad.length === 1 ? "player" : "players"}
                  </p>
                  <ul className="mt-2 flex min-h-9 flex-wrap gap-1.5">
                    {squad.map((player) => (
                      <li key={player.id} title={player.name} className="rounded-full bg-mist px-2.5 py-1 text-sm font-bold">
                        {player.name}
                      </li>
                    ))}
                    {squad.length === 0 && <li className="text-sm text-steel">Waiting for the auction</li>}
                  </ul>
                </div>
              </Tilt>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function Race({ table }: { table: Standing[] }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const top = Math.max(1, ...table.map((row) => row.points));

  return (
    <section className="bg-ink px-4 py-20 text-white">
      <div className="mx-auto max-w-4xl" ref={ref}>
        <p className="flex items-center gap-2 text-sm font-bold tracking-widest text-sky uppercase">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" /> Live leaderboard
        </p>
        <h2 className="text-4xl sm:text-5xl">The title race</h2>
        <ol className="mt-8 space-y-5">
          {table.map((row, i) => (
            <li key={row.team_id} className="grid grid-cols-[2rem_8rem_1fr_3rem] items-center gap-3 sm:grid-cols-[2rem_11rem_1fr_3rem]">
              <span className="font-display text-xl font-extrabold text-sky">{row.rank}</span>
              <b className="truncate font-display text-lg sm:text-2xl">{row.team}</b>
              <div className="h-4 overflow-hidden rounded-full bg-white/10">
                <div
                  className="race-bar"
                  style={{ width: inView ? `${(row.points / top) * 100}%` : 0, transitionDelay: `${i * 150}ms` }}
                />
              </div>
              <span className="text-right font-display text-2xl font-extrabold tabular-nums">{row.points}</span>
            </li>
          ))}
        </ol>
        <Link to="/leaderboard" className="btn-glow mt-10">
          Full points table →
        </Link>
      </div>
    </section>
  );
}

export default function Home() {
  const { data: teams } = usePoll<Team[]>("/teams", 30_000);
  const { data: players } = usePoll<Player[]>("/players", 10_000);
  const { data: auction } = usePoll<AuctionState>("/auction", 3000);
  const { data: table } = usePoll<Standing[]>("/standings", 10_000);

  const sold = players?.filter((player) => player.status === "sold").length ?? 0;
  const matches = (table?.reduce((sum, row) => sum + row.played, 0) ?? 0) / 2;

  return (
    <>
      <Hero auction={auction} teams={teams} />
      <Stats
        items={[
          ["Teams", teams?.length ?? 0],
          ["Players", players?.length ?? 0],
          ["Players sold", sold],
          ["Matches played", matches],
        ]}
      />

      <div className="mt-16 overflow-hidden py-4" aria-hidden="true">
        {BANDS.map(({ text, className, reverse }) => (
          <div key={text} className={`-mx-8 py-3 ${className}`}>
            <div className={`marquee ${reverse ? "marquee-reverse" : ""}`}>
              <span>{text.repeat(6)}</span>
              <span>{text.repeat(6)}</span>
            </div>
          </div>
        ))}
      </div>

      <Film />
      <Teams teams={teams} players={players} />
      {table && <Race table={table} />}

      <section className="relative overflow-hidden bg-brand px-4 py-16 text-center text-ink">
        <Reveal>
          <h2 className="text-5xl sm:text-7xl">Play. Cheer. Repeat.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/players" className="btn border-ink bg-ink text-lg hover:bg-white hover:text-ink">
              Meet the players
            </Link>
            <Link to="/login" className="btn-ghost border-ink text-lg hover:bg-white">
              Captains, sign in
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
