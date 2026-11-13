import { useState, type FormEvent, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { PlayerCard } from "../components/PlayerCard";
import { api, usePoll } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Player, Team } from "../lib/types";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <div className="mt-1 font-normal">{children}</div>
    </label>
  );
}

/** A form that posts to the API, resets on success and shows the outcome. */
function AdminForm(props: {
  title: string;
  submitLabel: string;
  send: (data: FormData) => Promise<string>; // resolves to a success message
  children: ReactNode;
}) {
  const [note, setNote] = useState<{ ok: boolean; text: string }>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      setNote({ ok: true, text: await props.send(new FormData(form)) });
      form.reset();
    } catch (err) {
      setNote({ ok: false, text: (err as Error).message });
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-3 p-6" aria-label={props.title}>
      <h2 className="text-2xl">{props.title}</h2>
      {props.children}
      <button className="btn w-full">{props.submitLabel}</button>
      {note && (
        <p role={note.ok ? "status" : "alert"} className={`font-bold ${note.ok ? "text-brand-dark" : ""}`}>
          {note.text}
        </p>
      )}
    </form>
  );
}

export default function Admin() {
  const isAdmin = useAuth().session?.role === "admin";
  const { data: teams, refresh: refreshTeams } = usePoll<Team[]>(isAdmin ? "/teams" : null);
  const { data: players, refresh: refreshPlayers } = usePoll<Player[]>(isAdmin ? "/players" : null);
  const [error, setError] = useState<string>();

  if (!isAdmin) return <Navigate to="/login" replace />;

  const addTeam = async (data: FormData) => {
    const body = { ...Object.fromEntries(data), purse: Number(data.get("purse")) };
    const team = await api<Team>("/teams", "POST", body);
    refreshTeams();
    return `${team.name} added. Share the access code with ${team.captain}.`;
  };

  const addPlayer = async (data: FormData) => {
    if ((data.get("photo") as File).size === 0) data.delete("photo");
    const player = await api<Player>("/players", "POST", data);
    refreshPlayers();
    return `${player.name} added to the auction pool.`;
  };

  const removePlayer = (player: Player) =>
    api(`/players/${player.id}`, "DELETE").then(
      () => (setError(undefined), refreshPlayers()),
      (err: Error) => setError(err.message),
    );

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm font-bold tracking-widest text-brand-dark uppercase">Auctioneer</p>
      <h1 className="text-4xl">Event setup</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminForm title="Add a team" submitLabel="Add team" send={addTeam}>
          <Field label="Team name">
            <input name="name" required maxLength={60} className="field" />
          </Field>
          <Field label="Captain">
            <input name="captain" required maxLength={80} className="field" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purse (₹)">
              <input name="purse" type="number" required min={1} defaultValue={10000} className="field" />
            </Field>
            <Field label="Team colour">
              <input name="color" type="color" defaultValue="#00a0dc" className="field h-[42px] p-1" />
            </Field>
          </div>
          <Field label="Captain's access code (6+ characters)">
            <input name="pin" required minLength={6} maxLength={64} autoComplete="off" className="field" />
          </Field>
        </AdminForm>

        <AdminForm title="Add a player" submitLabel="Add player" send={addPlayer}>
          <Field label="Player name">
            <input name="name" required maxLength={80} className="field" />
          </Field>
          <Field label="Department">
            <input name="department" required maxLength={80} className="field" />
          </Field>
          <Field label="Details (role, sports)">
            <input name="details" maxLength={120} placeholder="All-rounder · Cricket" className="field" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base price (₹)">
              <input name="base_price" type="number" required min={1} defaultValue={200} className="field" />
            </Field>
            <Field label="Photo (optional, max 2 MB)">
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="field text-sm" />
            </Field>
          </div>
        </AdminForm>
      </div>

      <h2 className="mt-10 text-2xl">Teams · {teams?.length ?? 0}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {teams?.map((team) => (
          <li key={team.id} className="flex items-center gap-2 rounded-full border border-ink/10 py-1 pr-4 pl-1">
            <span className="h-7 w-7 rounded-full" style={{ background: team.color }} />
            <b>{team.name}</b> <span className="text-steel">{team.captain}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-2xl">Players · {players?.length ?? 0}</h2>
      {error && <p role="alert" className="mt-2 font-bold">{error}</p>}
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {players?.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            footer={
              player.status !== "sold" && (
                <button className="font-bold underline" onClick={() => removePlayer(player)}>
                  Remove {player.name}
                </button>
              )
            }
          />
        ))}
      </div>
    </section>
  );
}
