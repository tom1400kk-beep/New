import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import TeamLink from "../components/TeamLink";

const ARCHETYPE_LABELS: Record<string, string> = {
  OFFENSIVE_INNOVATOR: "Offensive Innovator",
  DEFENSIVE_ANCHOR: "Defensive Anchor",
  RECRUITER: "The Closer",
  PLAYER_DEVELOPER: "Player Developer",
  PROGRAM_BUILDER: "Program Builder",
  DISCIPLINARIAN: "Disciplinarian",
};

function heatLabel(level: number): { label: string; className: string } {
  if (level >= 70) return { label: "On the hot seat", className: "text-bad" };
  if (level >= 40) return { label: "Warm", className: "text-bad" };
  if (level >= 25) return { label: "Watching", className: "text-muted" };
  return { label: "Safe", className: "text-good" };
}

export default function HotSeatPage() {
  const { activeSaveId } = useSave();
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    if (activeSaveId) api.getHotSeatBoard(activeSaveId).then(setRows);
  }, [activeSaveId]);

  if (!rows) return <p>Loading…</p>;

  return (
    <div>
      <h1>Hot Seat Watch</h1>
      <p className="text-muted">
        Coaches around the country whose job security is in real question, ranked by how hot their seat is —
        driven by wins vs. what their program's prestige expects, their AD's temperament, and how the fanbase feels.
      </p>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Team</th><th>Coach</th><th>Style</th><th>Record</th><th>Prestige</th><th>Heat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const heat = heatLabel(r.coach.hotSeatLevel);
              return (
                <tr key={r.teamId} style={r.isUserTeam ? { background: "rgba(217, 103, 12, 0.12)" } : undefined}>
                  <td>
                    <TeamLink teamId={r.teamId} name={r.teamName} /> <span className="text-muted">({r.division})</span>
                    {r.isUserTeam && <strong> · You</strong>}
                  </td>
                  <td>{r.coach.name}</td>
                  <td className="text-muted">{ARCHETYPE_LABELS[r.coach.archetype] ?? r.coach.archetype}</td>
                  <td>{r.record.wins}-{r.record.losses}</td>
                  <td className="text-muted">{r.prestige}</td>
                  <td>
                    <span className={heat.className}>{heat.label}</span>{" "}
                    <span className="text-muted">({r.coach.hotSeatLevel})</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p>Every coach in the league is safe right now.</p>}
      </div>
    </div>
  );
}
