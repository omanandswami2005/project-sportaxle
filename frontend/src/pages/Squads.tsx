import { Avatar } from "../components/PlayerCard";
import { usePoll } from "../lib/api";
import { loadPdfAssets } from "../lib/pdfAssets";
import { buildSquadsPdf } from "../lib/squadsPdf";
import type { Player, Team } from "../lib/types";

// Names come from a public form: a cell starting with = + - @ would run as a formula in Excel.
const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;

/** One row per player: team, captain, player, department, sports. No prices (they are private). */
export function squadsCsv(teams: Team[], players: Player[]) {
  const rows = [["Team", "Captain", "Player", "Department", "Sports"]];
  for (const team of teams) {
    for (const p of players.filter((p) => p.team_id === team.id)) {
      rows.push([team.name, team.captain, p.name, p.department, p.sports]);
    }
  }
  return rows.map((row) => row.map(cell).join(",")).join("\n") + "\n";
}

function download(name: string, text: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Final squads for the organisers: print it, save it as PDF, or download a CSV. */
export default function Squads() {
  const { data: teams } = usePoll<Team[]>("/teams", 30_000);
  const { data: players } = usePoll<Player[]>("/players", 10_000);
  if (!teams || !players) return <p className="p-10 text-center text-steel">Loading squads…</p>;
  const unsigned = players.filter((p) => p.status !== "sold");

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <p className="text-sm font-bold tracking-widest text-brand-dark uppercase">Sports Axle · Final squads</p>
          <h1 className="text-4xl">Squads</h1>
        </div>
        <button
          className="btn print:hidden"
          onClick={async () => (await buildSquadsPdf(teams, players, await loadPdfAssets(teams, players))).save("sportsaxle-squads.pdf")}
        >
          Download PDF
        </button>
        <button className="btn-ghost print:hidden" onClick={() => window.print()}>
          Print
        </button>
        <button className="btn-ghost print:hidden" onClick={() => download("sportsaxle-squads.csv", squadsCsv(teams, players))}>
          Download CSV
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        {teams.map((team) => {
          const squad = players.filter((p) => p.team_id === team.id);
          return (
            <article key={team.id} className="card break-inside-avoid p-0" data-testid="squad">
              <div className="h-2 rounded-t-2xl" style={{ background: team.color }} />
              <div className="flex items-center gap-3 p-4">
                <Avatar name={team.captain} src={team.captain_photo_url} className="h-12 w-12 text-base" />
                <div>
                  <h2 className="text-2xl">{team.name}</h2>
                  <p className="text-sm text-steel">Captain {team.captain} · {squad.length} {squad.length === 1 ? "player" : "players"}</p>
                </div>
              </div>
              <ol className="list-decimal border-t border-ink/10 px-4 py-3 pl-9 text-sm">
                {squad.map((p) => (
                  <li key={p.id} className="py-0.5">
                    <b>{p.name}</b> · {p.department} <span className="text-steel">· {p.sports}</span>
                  </li>
                ))}
                {squad.length === 0 && <li className="list-none text-steel">No players yet</li>}
              </ol>
            </article>
          );
        })}
      </div>

      {unsigned.length > 0 && (
        <p className="mt-6 text-sm text-steel">
          <b>Not in a squad ({unsigned.length}):</b> {unsigned.map((p) => p.name).join(", ")}
        </p>
      )}
    </section>
  );
}
