import { useState, type FormEvent } from "react";
import { api, usePoll } from "../lib/api";
import { useAuth } from "../lib/auth";
import { sportsOf, teamName } from "../lib/format";
import type { Match, Standing, Team } from "../lib/types";

const COLUMNS = ["#", "Team", "P", "W", "L", "T", "Pts"];

function ResultForm({ teams, sports, onSaved }: { teams: Team[]; sports: string[]; onSaved: () => void }) {
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const value = (name: string) => new FormData(form).get(name) as string;
    const [a, b] = [Number(value("a")), Number(value("b"))];
    const winner = { a, b, tie: null }[value("winner")];
    try {
      await api("/matches", "POST", { sport: value("sport"), team_a_id: a, team_b_id: b, winner_id: winner });
      setError(undefined);
      (form.elements.namedItem("sport") as HTMLInputElement).value = "";
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
    <form onSubmit={submit} className="card mt-8 grid gap-3 sm:grid-cols-5 sm:items-end">
      <label className="text-sm font-bold">
        Sport
        <input name="sport" required maxLength={40} list="known-sports" placeholder="Cricket" className="field mt-1 font-normal" />
        <datalist id="known-sports">
          {sports.map((sport) => (
            <option key={sport} value={sport} />
          ))}
        </datalist>
      </label>
      {teamSelect("a", "Team A", 0)}
      {teamSelect("b", "Team B", 1)}
      <label className="text-sm font-bold">
        Result
        <select name="winner" className="field mt-1 font-normal">
          <option value="a">Team A won</option>
          <option value="b">Team B won</option>
          <option value="tie">Tie</option>
        </select>
      </label>
      <button className="btn">Record result</button>
      {error && <p role="alert" className="font-bold sm:col-span-5">{error}</p>}
    </form>
  );
}

export default function Leaderboard() {
  const isAdmin = useAuth().session?.role === "admin";
  const [sport, setSport] = useState(""); // "" = overall table
  const query = sport ? `?sport=${encodeURIComponent(sport)}` : "";
  const { data: table, refresh: refreshTable } = usePoll<Standing[]>(`/standings${query}`);
  const { data: matches, refresh: refreshMatches } = usePoll<Match[]>("/matches");
  const sports = sportsOf(matches);
  const shown = matches?.filter((m) => !sport || m.sport.trim().toLowerCase() === sport.toLowerCase());
  const { data: teams } = usePoll<Team[]>("/teams", 60_000);

  const refresh = () => {
    refreshTable();
    refreshMatches();
  };
  const remove = (id: number) => api(`/matches/${id}`, "DELETE").then(refresh);
  const top = Math.max(1, ...(table?.map((row) => row.points) ?? []));

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <p className="flex items-center gap-2 font-bold uppercase">
        <span className="h-3 w-3 animate-pulse rounded-full bg-brand" /> Live leaderboard
      </p>
      <h1 className="text-4xl">Points table{sport && ` · ${sport}`}</h1>

      {sports.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Table for">
          {["", ...sports].map((name) => (
            <button
              key={name || "overall"}
              aria-pressed={sport === name}
              className={sport === name ? "btn py-1.5" : "btn-ghost py-1.5"}
              onClick={() => setSport(name)}
            >
              {name || "Overall"}
            </button>
          ))}
        </div>
      )}

      <div className="card mt-6 overflow-x-auto p-0">
        <table className="w-full text-left">
          <thead className="bg-ink text-white">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column} className="px-4 py-3 font-bold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table?.map((row) => (
              <tr key={row.team_id} className="border-t border-ink/10" data-testid="standing-row">
                <td className="px-4 py-3 font-display text-xl font-extrabold">{row.rank}</td>
                <td className="w-1/2 px-4 py-3">
                  <b>{row.team}</b>
                  <div className="mt-1 h-2 rounded-full bg-mist">
                    <div
                      className="h-2 rounded-full bg-brand transition-all duration-700"
                      style={{ width: `${(row.points / top) * 100}%` }}
                    />
                  </div>
                </td>
                {[row.played, row.wins, row.losses, row.ties].map((value, index) => (
                  <td key={index} className="px-4 py-3 tabular-nums">
                    {value}
                  </td>
                ))}
                <td className="px-4 py-3 font-display text-xl font-extrabold tabular-nums">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-steel">Win 2 points · Tie 1 point · Ranked by points, then wins.</p>

      {isAdmin && teams && <ResultForm teams={teams} sports={sports} onSaved={refresh} />}

      <h2 className="mt-10 text-2xl">Results</h2>
      {shown?.length === 0 && <p className="mt-2 text-steel">No matches played yet.</p>}
      <ul className="mt-3 space-y-2">
        {shown?.map((match) => (
          <li key={match.id} className="card flex flex-wrap items-center justify-between gap-2 py-3">
            <span>
              <b className="text-brand-dark">{match.sport}</b> · {teamName(teams, match.team_a_id)} vs{" "}
              {teamName(teams, match.team_b_id)} ·{" "}
              <b>{match.winner_id === null ? "Tie" : `${teamName(teams, match.winner_id)} won`}</b>
            </span>
            {isAdmin && (
              <button className="text-sm font-bold underline" onClick={() => remove(match.id)}>
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
