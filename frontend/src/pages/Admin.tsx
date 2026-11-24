import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Avatar, PlayerCard } from "../components/PlayerCard";
import { api, usePoll } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { AuctionState, Player, Team } from "../lib/types";

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
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setBusy(true);
    try {
      setNote({ ok: true, text: await props.send(new FormData(form)) });
      form.reset();
    } catch (err) {
      setNote({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-3 p-6" aria-label={props.title}>
      <h2 className="text-2xl">{props.title}</h2>
      {props.children}
      <button className="btn w-full" disabled={busy}>{props.submitLabel}</button>
      {note && (
        <p role={note.ok ? "status" : "alert"} className={`font-bold ${note.ok ? "text-brand-dark" : ""}`}>
          {note.text}
        </p>
      )}
    </form>
  );
}

/** Sends only the fields the admin filled in: blank means "leave as it is". */
export function filledFields(data: FormData) {
  for (const [key, value] of [...data.entries()]) {
    if (value === "" || (value instanceof File && value.size === 0)) data.delete(key);
  }
  return data;
}

/** A collapsed "Edit" panel that PATCHes one team or player. */
function EditPanel(props: { label: string; path: string; onSaved: () => void; children: ReactNode }) {
  const [note, setNote] = useState<{ ok: boolean; text: string }>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api(props.path, "PATCH", filledFields(new FormData(form)));
      // One-off fields (new code, purse, photo) are cleared so they are not sent again.
      form.querySelectorAll<HTMLInputElement>("[data-once]").forEach((input) => (input.value = ""));
      setNote({ ok: true, text: "Saved." });
      props.onSaved();
    } catch (err) {
      setNote({ ok: false, text: (err as Error).message });
    }
  };

  return (
    <details className="mt-2">
      <summary className="cursor-pointer font-bold text-brand-dark">{props.label}</summary>
      <form onSubmit={submit} className="mt-2 space-y-2" aria-label={props.label}>
        {props.children}
        <button className="btn py-1.5">Save changes</button>
        {note && (
          <p role={note.ok ? "status" : "alert"} className={`font-bold ${note.ok ? "text-brand-dark" : ""}`}>
            {note.text}
          </p>
        )}
      </form>
    </details>
  );
}

const PHOTO_TYPES = "image/jpeg,image/png,image/webp";

function EditTeam({ team, onSaved }: { team: Team; onSaved: () => void }) {
  return (
    <EditPanel label={`Edit ${team.name}`} path={`/teams/${team.id}`} onSaved={onSaved}>
      <Field label="Team name">
        <input name="name" defaultValue={team.name} maxLength={60} className="field" />
      </Field>
      <Field label="Captain">
        <input name="captain" defaultValue={team.captain} maxLength={80} className="field" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Team colour">
          <input name="color" type="color" defaultValue={team.color.toLowerCase()} className="field h-[42px] p-1" />
        </Field>
        <Field label="New purse (₹)">
          <input name="purse" type="number" min={1} placeholder="unchanged" className="field" data-once />
        </Field>
      </div>
      <Field label="New access code (6+ characters)">
        <input name="pin" minLength={6} maxLength={64} autoComplete="off" placeholder="leave blank to keep" className="field" data-once />
      </Field>
      <Field label="Captain photo (max 2 MB)">
        <input name="captain_photo" type="file" accept={PHOTO_TYPES} className="field text-sm" data-once />
      </Field>
    </EditPanel>
  );
}

function EditPlayer({ player, onSaved }: { player: Player; onSaved: () => void }) {
  return (
    <EditPanel label={`Edit ${player.name}`} path={`/players/${player.id}`} onSaved={onSaved}>
      <Field label="Player name">
        <input name="name" defaultValue={player.name} maxLength={80} className="field" />
      </Field>
      <Field label="Department">
        <input name="department" defaultValue={player.department} maxLength={80} className="field" />
      </Field>
      <Field label="Sports (comma separated)">
        <input name="sports" defaultValue={player.sports} maxLength={120} className="field" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Base price (₹)">
          <input name="base_price" type="number" min={1} defaultValue={player.base_price} className="field" />
        </Field>
        <Field label="New photo">
          <input name="photo" type="file" accept={PHOTO_TYPES} className="field text-sm" data-once />
        </Field>
      </div>
    </EditPanel>
  );
}

/** The most players a team may buy. Blank means no limit; it can be changed at any time. */
function SquadLimit() {
  const { data: state, refresh } = usePoll<AuctionState>("/auction", 5000);
  const send = async (data: FormData) => {
    const raw = String(data.get("limit") ?? "").trim();
    const next = await api<AuctionState>("/auction/squad-limit", "PUT", { limit: raw ? Number(raw) : null });
    refresh();
    return next.squad_limit === null ? "No squad limit." : `Squad limit is now ${next.squad_limit} players.`;
  };
  return (
    <AdminForm title="Squad size limit" submitLabel="Save limit" send={send}>
      <p className="text-sm text-steel">
        Now: <b className="text-ink">{state ? (state.squad_limit ?? "no limit") : "…"}</b>. Players a team may buy, not
        counting the captain. It can be raised or lowered during the auction, but not below a squad that already exists.
      </p>
      <Field label="Most players per team (blank = no limit)">
        <input name="limit" type="number" min={1} max={100} className="field" />
      </Field>
    </AdminForm>
  );
}

/** One base price for every player not yet sold; the player on the block keeps theirs. */
function BasePrice({ onSaved }: { onSaved: () => void }) {
  const send = async (data: FormData) => {
    const { updated } = await api<{ updated: number }>("/players/base-price", "PUT", {
      price: Number(data.get("price")),
    });
    onSaved();
    return `Base price set for ${updated} player${updated === 1 ? "" : "s"}.`;
  };
  return (
    <AdminForm title="Base price for all players" submitLabel="Set for all" send={send}>
      <p className="text-sm text-steel">
        Applies to every player not yet sold. Sold players and the player on the block keep their price. One
        player&apos;s price can still be changed under Edit.
      </p>
      <Field label="Base price (₹)">
        <input name="price" type="number" required min={1} className="field" />
      </Field>
    </AdminForm>
  );
}

/** Clear every bid and sale after a test run. Teams, players, photos and matches stay. */
function ResetAuction({ onSaved }: { onSaved: () => void }) {
  const send = async (data: FormData) => {
    if (data.get("confirm") !== "RESET") throw new Error("Type RESET to confirm.");
    await api("/auction/reset", "POST");
    onSaved();
    return "Auction reset: every player is available again and every purse is full.";
  };
  return (
    <AdminForm title="Reset the auction" submitLabel="Reset auction" send={send}>
      <p className="text-sm text-steel">
        For after a test run. Every sale is undone, the player on the block is taken off and every purse is full
        again. Teams, captains, access codes, players, photos, matches and the squad limit stay. There is no undo.
      </p>
      <Field label="Type RESET to confirm">
        <input name="confirm" required autoComplete="off" className="field" />
      </Field>
    </AdminForm>
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <p className="text-sm font-bold tracking-widest text-brand-dark uppercase">Auctioneer</p>
          <h1 className="text-4xl">Event setup</h1>
        </div>
        <Link to="/auction" className="btn-ghost">Run the auction</Link>
        <Link to="/schedule" className="btn-ghost">Schedule matches</Link>
        <Link to="/squads" className="btn">Final squads sheet</Link>
      </div>

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
          <Field label="Sports (comma separated)">
            <input name="sports" maxLength={120} placeholder="Cricket, Chess" className="field" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base price (₹)">
              <input name="base_price" type="number" required min={1} defaultValue={200} className="field" />
            </Field>
            <Field label="Photo (optional, max 2 MB)">
              <input name="photo" type="file" accept={PHOTO_TYPES} className="field text-sm" />
            </Field>
          </div>
        </AdminForm>

        <SquadLimit />
        <BasePrice onSaved={refreshPlayers} />
        <ResetAuction onSaved={refreshPlayers} />
      </div>

      <h2 className="mt-10 text-2xl">Teams · {teams?.length ?? 0}</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams?.map((team) => (
          <li key={team.id} className="card">
            <div className="flex items-center gap-3">
              <Avatar name={team.captain} src={team.captain_photo_url} className="h-12 w-12 text-base" />
              <div className="min-w-0">
                <b className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: team.color }} />
                  {team.name}
                </b>
                <span className="text-sm text-steel">{team.captain}</span>
              </div>
            </div>
            <EditTeam team={team} onSaved={refreshTeams} />
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
              <>
                {player.status !== "sold" && (
                  <button className="font-bold underline" onClick={() => removePlayer(player)}>
                    Remove {player.name}
                  </button>
                )}
                <EditPlayer player={player} onSaved={refreshPlayers} />
              </>
            }
          />
        ))}
      </div>
    </section>
  );
}
