import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import { PRIORITY_LABELS } from "../engine/priorities";

function sourceLabel(source: string): string {
  if (source === "JUCO") return "JUCO";
  if (source === "INTERNATIONAL") return "Int'l";
  return "HS";
}

function homeLabel(p: any): string {
  if (p.source === "INTERNATIONAL") return p.countryOfOrigin;
  return p.hometownCity ? `${p.hometownCity}, ${p.hometownState}` : p.hometownState;
}

// Pipeline strength (a coach's persistent, per-state recruiting connection)
// shown as color on the home-state text: green = built pipeline, red = gone cold.
function pipelineClass(p: any): string {
  if (p.pipelineScore == null) return "";
  if (p.pipelineScore >= 70) return "text-good";
  if (p.pipelineScore <= 30) return "text-bad";
  return "";
}

function pipelineTitle(p: any): string | undefined {
  if (p.pipelineScore == null) return undefined;
  if (p.pipelineScore >= 70) return `Pipeline state (${p.pipelineScore}/100) — a well-built recruiting connection here`;
  if (p.pipelineScore <= 30) return `Cold state (${p.pipelineScore}/100) — this connection has gone cold from neglect`;
  return `Recruiting connection: ${p.pipelineScore}/100`;
}

function priorityLabel(p: any): string {
  if (!p.topPriorities || p.topPriorities.length === 0) return "—";
  return p.topPriorities.map((k: string) => PRIORITY_LABELS[k as keyof typeof PRIORITY_LABELS] ?? k).join(", ");
}

export default function RecruitingPage() {
  const { activeSaveId } = useSave();
  const [board, setBoard] = useState<any[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");

  async function refresh() {
    if (activeSaveId) setBoard(await api.getRecruitingBoard(activeSaveId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSaveId]);

  async function pursue(prospectId: string) {
    if (!activeSaveId) return;
    await api.pursueRecruit(activeSaveId, prospectId, 15);
    await refresh();
  }

  const filtered = board.filter((p) => sourceFilter === "ALL" || p.source === sourceFilter);

  return (
    <div>
      <h1>Recruiting</h1>
      <div className="card">
        <label>Source: </label>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="ALL">All</option>
          <option value="HIGH_SCHOOL">High School</option>
          <option value="JUCO">JUCO</option>
          <option value="INTERNATIONAL">International</option>
        </select>
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Pos</th><th>Stars</th><th>Home</th><th>Source</th>
              <th>Priorities</th>
              <th>Scoring</th><th>Defense</th><th>Character*</th><th>Discipline*</th><th>Interest</th><th>Points</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{p.firstName} {p.lastName}</td>
                <td>{p.position}</td>
                <td>{"★".repeat(p.starRating)}</td>
                <td className={pipelineClass(p)} title={pipelineTitle(p)}>{homeLabel(p)}</td>
                <td>{sourceLabel(p.source)}</td>
                <td className="text-muted" style={{ fontFamily: "inherit", whiteSpace: "nowrap" }}>{priorityLabel(p)}</td>
                <td>{p.scouted.scoring}</td>
                <td>{p.scouted.defense}</td>
                <td>{p.scouted.characterRating}</td>
                <td>{p.scouted.disciplineRating}</td>
                <td>{p.interestLevel}</td>
                <td>{p.pointsInvested}</td>
                <td><button className="secondary" onClick={() => pursue(p.id)}>Pursue (15 pts)</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p>No prospects loaded.</p>}
        <p className="text-muted" style={{ fontSize: "0.8rem", marginTop: 8 }}>
          * Scouted ratings carry uncertainty — true ability may differ from what your staff reports.
          International prospects carry extra uncertainty — harder to scout from overseas.
          "Priorities" are what this recruit actually cares about when picking a school.
          The home state is colored when you have a notable recruiting pipeline there (green) or it's gone cold (red) — hover for details.
        </p>
      </div>
    </div>
  );
}
