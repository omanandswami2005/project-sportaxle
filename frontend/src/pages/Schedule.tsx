import { useState, type FormEvent } from "react";
import { api, usePoll } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fixtureDay, fixtureTime, sportsOf, teamName } from "../lib/format";
import type { Fixture, Match, Team } from "../lib/types";

const SPORTS = ["Cricket", "Badminton", "Table Tennis", "Chess", "Carrom"];

/** Groups fixtures (already sorted by time) under their day. */
export function byDay(fixtures: Fixture[]) {
  const days = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const key = fixtureDay(fixture.starts_at);
    days.set(key, [...(days.get(key) ?? []), fixture]);
  }
  return [...days];
}

function FixtureForm({ teams, sports, onSaved }: { teams: Team[]; sports: string[]; onSaved: () => void }) {
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await api("/fixtures", "POST", {
        ...data,
        team_a_id: Number(data.team_a_id),
        team_b_id: Number(data.team_b_id),
      });
      setError(undefined);
      form.reset();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const teamSelect = (name: string, label: string, initial: number) => (
    <label className="text-sm font-bold">
      {label}
      <select name={name} className="field mt-1 font-normal" defaultValue={teams[initial]?.id}>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form onSubmit={submit} className="card mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:items-end" aria-label="Add a fixture">
      <label className="text-sm font-bold">
        Sport
        <input name="sport" required maxLength={40} list="sports" placeholder="Cricket" className="field mt-1 font-normal" />
        <datalist id="sports">
          {sportsOf([...SPORTS, ...sports].map((sport) => ({ sport }))).map((sport) => (
            <option key={sport} value={sport} />
          ))}
        </datalist>
      </label>
      {teamSelect("team_a_id", "Team A", 0)}
      {teamSelect("team_b_id", "Team B", 1)}
      <label className="text-sm font-bold">
        Starts
        <input name="starts_at" type="datetime-local" required className="field mt-1 font-normal" />
      </label>
      <label className="text-sm font-bold">
        Venue
        <input name="venue" maxLength={80} placeholder="Ground A" className="field mt-1 font-normal" />
      </label>
      <button className="btn">Add fixture</button>
      {error && <p role="alert" className="font-bold sm:col-span-3 lg:col-span-6">{error}</p>}
    </form>
  );
}

export default function Schedule() {
  const isAdmin = useAuth().session?.role === "admin";
  const { data: fixtures, refresh } = usePoll<Fixture[]>("/fixtures", 15_000);
  const { data: matches } = usePoll<Match[]>("/matches", 60_000);
  const { data: teams } = usePoll<Team[]>("/teams", 60_000);
  const [error, setError] = useState<string>();

  const act = (promise: Promise<unknown>) =>
    promise.then(
      () => (setError(undefined), refresh()),
      (err: Error) => setError(err.message),
    );
  const result = (fixture: Fixture, winner: number | null) =>
    act(api(`/fixtures/${fixture.id}/result`, "POST", { winner_id: winner }));

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm font-bold tracking-widest text-brand-dark uppercase">Fixtures</p>
      <h1 className="text-4xl">Schedule</h1>

      {isAdmin && teams && <FixtureForm teams={teams} sports={sportsOf(matches)} onSaved={refresh} />}
      {error && <p role="alert" className="mt-4 font-bold">{error}</p>}

      {fixtures?.length === 0 && <p className="mt-6 text-steel">No matches scheduled yet.</p>}
      {fixtures &&
        byDay(fixtures).map(([day, list]) => (
          <div key={day} className="mt-8">
            <h2 className="text-2xl">{day}</h2>
            <ul className="mt-3 space-y-2">
              {list.map((fixture) => {
                const [a, b] = [teamName(teams, fixture.team_a_id), teamName(teams, fixture.team_b_id)];
                return (
                  <li key={fixture.id} className="card flex flex-wrap items-center gap-x-4 gap-y-2 py-3" data-testid="fixture">
                    <b className="w-20 font-display text-xl tabular-nums">{fixtureTime(fixture.starts_at)}</b>
                    <span className="flex-1">
                      <b className="text-brand-dark">{fixture.sport}</b> · <b>{a}</b> vs <b>{b}</b>
                      {fixture.venue && <span className="text-steel"> · {fixture.venue}</span>}
                    </span>
                    {isAdmin && (
                      <span className="flex flex-wrap gap-2 text-sm">
                        <button className="btn-ghost py-1" onClick={() => result(fixture, fixture.team_a_id)}>
                          {a} won
                        </button>
                        <button className="btn-ghost py-1" onClick={() => result(fixture, fixture.team_b_id)}>
                          {b} won
                        </button>
                        <button className="btn-ghost py-1" onClick={() => result(fixture, null)}>
                          Tie
                        </button>
                        <button className="font-bold underline" onClick={() => act(api(`/fixtures/${fixture.id}`, "DELETE"))}>
                          Delete
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </section>
  );
}
