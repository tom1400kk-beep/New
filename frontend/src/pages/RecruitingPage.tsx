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
  if (p.source === "INTERNATIONAL") return p.hometownCity ? `${p.hometownCity}, ${p.countryOfOrigin}` : p.countryOfOrigin;
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// No individual high school games are actually simulated, so this projects
// a plausible senior-season stat line from the scouting report itself —
// framed as an estimate, not a tracked box score.
function estimateHighSchoolStats(p: any): { ppg: number; rpg: number; apg: number } {
  const s = p.scouted;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    ppg: round1(clamp(6 + s.scoring * 0.28 + p.starRating * 1.5, 8, 38)),
    rpg: round1(clamp(1 + s.rebounding * 0.11, 1, 15)),
    apg: round1(clamp(0.5 + s.playmaking * 0.08, 0.5, 11)),
  };
}

const ORIGIN_LABELS: Record<string, string> = {
  HIGH_SCHOOL: "High School", JUCO: "Junior College", INTERNATIONAL: "International",
};

export default function RecruitingPage() {
  const { activeSaveId } = useSave();
  const [board, setBoard] = useState<any[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [selectedRecruit, setSelectedRecruit] = useState<any>(null);

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
                <td>
                  <button className="player-name-link" onClick={() => setSelectedRecruit(p)}>
                    {p.firstName} {p.lastName}
                  </button>
                </td>
                <td>{p.position}</td>
                <td>
                  {"★".repeat(p.starRating)}
                  {p.playedEYBL && (
                    <span className="text-muted" style={{ marginLeft: 4, fontSize: "0.72rem" }} title={`Played EYBL for ${p.eyblTeam} — the Nike circuit that culminates each July at the Peach Jam`}>
                      EYBL
                    </span>
                  )}
                </td>
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

      {selectedRecruit && (
        <div className="modal-backdrop" onClick={() => setSelectedRecruit(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedRecruit.firstName} {selectedRecruit.lastName}</h2>
            <p className="text-muted">
              {selectedRecruit.position}
              {" · "}{"★".repeat(selectedRecruit.starRating)}{"☆".repeat(5 - selectedRecruit.starRating)}
              {" · "}Class of {selectedRecruit.graduationYear}
              {" · "}{ORIGIN_LABELS[selectedRecruit.source] ?? selectedRecruit.source}
            </p>
            {selectedRecruit.playedEYBL && (
              <p className="text-muted" style={{ marginTop: -8 }}>
                EYBL Circuit: {selectedRecruit.eyblTeam} — the Nike grassroots circuit culminating each July at the Peach Jam
              </p>
            )}

            <div className="player-detail-grid">
              <div>
                <div className="label">Hometown</div>
                <div className="value" title={pipelineTitle(selectedRecruit)}>{homeLabel(selectedRecruit)}</div>
              </div>
              <div><div className="label">Interest</div><div className="value">{selectedRecruit.interestLevel}</div></div>
              <div><div className="label">Points Invested</div><div className="value">{selectedRecruit.pointsInvested}</div></div>
              {selectedRecruit.pipelineScore != null && (
                <div><div className="label">Pipeline</div><div className="value">{selectedRecruit.pipelineScore}/100</div></div>
              )}
            </div>

            <h3 style={{ marginTop: 16 }}>Estimated Senior Season</h3>
            <div className="player-detail-grid">
              {(() => {
                const hs = estimateHighSchoolStats(selectedRecruit);
                return (
                  <>
                    <div><div className="label">PPG</div><div className="value">{hs.ppg}</div></div>
                    <div><div className="label">RPG</div><div className="value">{hs.rpg}</div></div>
                    <div><div className="label">APG</div><div className="value">{hs.apg}</div></div>
                  </>
                );
              })()}
            </div>
            <p className="text-muted" style={{ fontSize: "0.76rem", marginTop: -4 }}>
              Projected from scouting reports, not a tracked box score.
            </p>

            <h3 style={{ marginTop: 16 }}>Scouted Ratings*</h3>
            <div className="player-detail-grid">
              <div><div className="label">Scoring</div><div className="value">{selectedRecruit.scouted.scoring}</div></div>
              <div><div className="label">3PT</div><div className="value">{selectedRecruit.scouted.threePoint}</div></div>
              <div><div className="label">Finishing</div><div className="value">{selectedRecruit.scouted.finishing}</div></div>
              <div><div className="label">Playmaking</div><div className="value">{selectedRecruit.scouted.playmaking}</div></div>
              <div><div className="label">Rebounding</div><div className="value">{selectedRecruit.scouted.rebounding}</div></div>
              <div><div className="label">Defense</div><div className="value">{selectedRecruit.scouted.defense}</div></div>
              <div><div className="label">Athleticism</div><div className="value">{selectedRecruit.scouted.athleticism}</div></div>
              <div><div className="label">Character</div><div className="value">{selectedRecruit.scouted.characterRating}</div></div>
              <div><div className="label">Discipline</div><div className="value">{selectedRecruit.scouted.disciplineRating}</div></div>
            </div>

            <h3 style={{ marginTop: 16 }}>Priorities</h3>
            <p>{priorityLabel(selectedRecruit)}</p>

            <button style={{ marginTop: 12 }} onClick={() => setSelectedRecruit(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
