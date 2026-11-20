import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo, Wordmark } from "../components/Logo";
import { Avatar } from "../components/PlayerCard";
import { CREDITS } from "../credits";
import { usePoll } from "../lib/api";
import type { Team } from "../lib/types";

const SLIDE_MS = 7000;
const AMBIENT = `${import.meta.env.BASE_URL}media/credits-ambient.m4a`;
const SPORTS = [
  ["🏏", "Cricket"],
  ["🏸", "Badminton"],
  ["🏓", "Table Tennis"],
  ["♟️", "Chess"],
  ["🎯", "Carrom"],
  ["⚽", "Football"],
  ["🕹️", "Foosball"],
];
const RING = "SPORTS AXLE · DATA AXLE INDIA · PLAY · CHEER · REPEAT · ";

/** Logo inside a slowly turning ring of text, with the sports orbiting it. */
function Emblem() {
  return (
    <div className="relative mx-auto h-[min(42vh,70vw)] w-[min(42vh,70vw)]">
      <svg viewBox="0 0 200 200" className="credits-ring absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <path id="credits-ring" d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0" />
        </defs>
        <text className="fill-sky font-display text-[11.5px] font-extrabold tracking-[0.18em]">
          <textPath href="#credits-ring">{RING.repeat(2)}</textPath>
        </text>
      </svg>
      <div className="orbit [--radius:min(15vh,24vw)]" aria-hidden="true">
        {SPORTS.map(([icon], i) => (
          <span key={icon} style={{ "--a": `${(i / SPORTS.length) * 360}deg` } as CSSProperties}>
            <i>{icon}</i>
          </span>
        ))}
      </div>
      <Logo light animated className="absolute inset-[30%]" />
    </div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-[min(2.6vh,4vw)] font-bold tracking-[0.3em] text-sky uppercase">{children}</p>;
}

function Person({ name, role, photo, index }: { name: string; role?: string; photo?: string | null; index: number }) {
  return (
    <li className="rise flex flex-col items-center text-center" style={{ animationDelay: `${index * 0.08}s` }}>
      <Avatar name={name} src={photo ?? null} className="h-[min(14vh,18vw)] w-[min(14vh,18vw)] rounded-full! text-[min(5vh,6vw)] ring-4 ring-brand/60" />
      <b className="mt-[1.2vh] font-display text-[min(3vh,4.4vw)] leading-tight">{name}</b>
      {role && <span className="text-[min(2vh,3.2vw)] text-white/65">{role}</span>}
    </li>
  );
}

/** The slides, in order. Empty credit sections are skipped. */
function slides(teams: Team[] | undefined): ReactNode[] {
  const list: ReactNode[] = [
    <div key="title" className="text-center">
      <Emblem />
      <h1 className="mt-[2vh] text-[min(12vh,15vw)] leading-none" aria-label="SportsAxle">
        Sports<span className="text-brand">Axle</span>
      </h1>
      <Kicker>Data Axle India · The team behind the game</Kicker>
    </div>,
  ];
  for (const section of CREDITS) {
    if (section.people.length === 0) continue;
    const solo = section.people.length === 1 ? section.people[0] : null;
    list.push(
      solo ? (
        <div key={section.title} className="text-center">
          <Kicker>{section.title}</Kicker>
          <h2 className="mt-[2vh] text-[min(14vh,13vw)] leading-[0.95]">
            {solo.name.split(" ").map((word, i) => (
              <span key={i} className={`block ${i > 0 ? "text-brand" : ""}`}>
                {word}
              </span>
            ))}
          </h2>
          {solo.role && <p className="mt-[2vh] text-[min(3.2vh,5vw)] text-white/75">{solo.role}</p>}
        </div>
      ) : (
        <div key={section.title} className="w-full text-center">
          <Kicker>{section.title}</Kicker>
          <ul className="mx-auto mt-[4vh] flex max-w-[90vw] flex-wrap justify-center gap-x-[4vw] gap-y-[3vh]">
            {section.people.map((person, i) => (
              <Person key={person.name} name={person.name} role={person.role} index={i} />
            ))}
          </ul>
        </div>
      ),
    );
  }
  if (teams?.length) {
    list.push(
      <div key="captains" className="w-full text-center">
        <Kicker>Leading the charge · The captains</Kicker>
        <ul className="mx-auto mt-[4vh] grid max-w-[92vw] grid-cols-3 gap-x-[2vw] gap-y-[3vh] sm:grid-cols-5">
          {teams.map((team, i) => (
            <Person key={team.id} name={team.captain} role={team.name} photo={team.captain_photo_url} index={i} />
          ))}
        </ul>
      </div>,
    );
  }
  list.push(
    <div key="sports" className="text-center">
      <Kicker>Seven sports · One league</Kicker>
      <ul className="mt-[5vh] flex flex-wrap justify-center gap-[4vw]">
        {SPORTS.map(([icon, name], i) => (
          <li key={name} className="rise flex flex-col items-center" style={{ animationDelay: `${i * 0.1}s` }}>
            <span className="text-[min(12vh,14vw)] leading-none">{icon}</span>
            <b className="mt-[1.5vh] font-display text-[min(3.2vh,4.4vw)]">{name}</b>
          </li>
        ))}
      </ul>
    </div>,
    <div key="soon" className="text-center">
      <Kicker>Thank you for playing</Kicker>
      <h2 className="mt-[2vh] text-[min(13vh,14vw)] leading-[0.95]">
        Play. Cheer. <span className="text-brand">Repeat.</span>
      </h2>
      <p className="mt-[3vh] inline-flex items-center gap-3 text-[min(3vh,4.6vw)] text-white/80">
        <span className="h-[1.6vh] w-[1.6vh] animate-pulse rounded-full bg-brand" /> The auction begins shortly
      </p>
    </div>,
  );
  return list;
}

/** Every name, flowing across the bottom like the film's bands. */
export function creditLine(teams: Team[] | undefined) {
  const people = CREDITS.flatMap((section) => section.people.map((p) => `${p.name}${p.role ? ` · ${p.role}` : ""}`));
  const captains = (teams ?? []).map((team) => `${team.captain} · Captain, ${team.name}`);
  return [...people, ...captains].map((entry) => `${entry.toUpperCase()}  ✦  `).join("");
}

function Band({ text, className, reverse = false }: { text: string; className: string; reverse?: boolean }) {
  return (
    <div className={`-mx-8 overflow-hidden py-[1.2vh] ${className}`} aria-hidden="true">
      <div className={`marquee text-[min(3.4vh,5vw)] sm:text-[min(3.4vh,5vw)] ${reverse ? "marquee-reverse" : ""}`}>
        <span>{text.repeat(3)}</span>
        <span>{text.repeat(3)}</span>
      </div>
    </div>
  );
}

/** A quiet ambient loop. Browsers only start sound after a click, hence the button. */
function SoundToggle() {
  const audio = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(false);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (on) el.pause();
    else {
      el.volume = 0.7; // the file itself is mastered quiet (-20 LUFS)
      el.play().catch(() => setOn(false));
    }
    setOn(!on);
  };

  return (
    <>
      <audio ref={audio} src={AMBIENT} loop preload="none" />
      <button
        onClick={toggle}
        className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[min(1.9vh,3.4vw)] font-bold backdrop-blur hover:bg-white/20"
      >
        {on ? "♪ Sound off" : "♪ Sound on"}
      </button>
    </>
  );
}

/** The credits roll: rotating slides, flowing name bands and an optional soundtrack. */
export function CreditsShow() {
  const { data: teams } = usePoll<Team[]>("/teams", 60_000);
  const all = slides(teams);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => i + 1), SLIDE_MS);
    return () => clearInterval(timer);
  }, []);
  const current = index % all.length;

  return (
    <div className="relative flex h-full w-full flex-col" data-testid="credits">
      <div className="relative flex flex-1 items-center justify-center px-[4vw]">
        <div key={current} className="credits-slide w-full">
          {all[current]}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 pb-[2vh]" aria-hidden="true">
        {all.map((_, i) => (
          <span key={i} className={`h-[0.8vh] rounded-full transition-all duration-500 ${i === current ? "w-[5vh] bg-brand" : "w-[0.8vh] bg-white/30"}`} />
        ))}
      </div>
      <Band text={creditLine(teams)} className="-rotate-1 bg-brand text-ink" />
      <Band text={SPORTS.map(([, name]) => `${name.toUpperCase()}  ·  `).join("").repeat(2)} className="rotate-1 bg-white/10 text-white" reverse />
      <div className="absolute right-[3vw] bottom-[15vh] z-[1]">
        <SoundToggle />
      </div>
    </div>
  );
}

/** Full-screen credits page, for the projector before the auction. */
export default function Credits() {
  return (
    <div className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-ink pb-[2vh] text-white">
      <div className="hero-stripes" aria-hidden="true" />
      <div className="credits-glow" aria-hidden="true" />
      <header className="relative flex items-center gap-4 px-[4vw] pt-[3vh]">
        <Logo light className="h-[6vh] w-[6vh]" />
        <Wordmark className="text-[4vh] text-white" />
        <span className="ml-auto text-[2.2vh] font-bold tracking-widest text-sky uppercase">Credits</span>
        <Link to="/" className="text-[1.8vh] text-white/50 underline">
          Exit
        </Link>
      </header>
      <div className="relative flex-1">
        <CreditsShow />
      </div>
    </div>
  );
}
