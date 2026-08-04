import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import { PRIORITY_LABELS } from "../engine/priorities";

function overall(p: any): number {
  return Math.round((p.scoring + p.threePoint + p.finishing + p.playmaking + p.rebounding + p.defense + p.athleticism + p.basketballIq) / 8);
}

function homeLabel(p: any): string {
  const town = p.hometownCity ? `${p.hometownCity}, ${p.hometownState}` : p.hometownState;
  if (p.countryOfOrigin) return `${town} (${p.countryOfOrigin})`;
  return town;
}

// Pipeline strength (a coach's persistent, per-school transfer connection)
// shown as color on the previous-school text: green = built pipeline from a
// prior transfer, red = gone cold from neglect.
function pipelineClass(p: any): string {
  if (p.pipelineScore == null) return "";
  if (p.pipelineScore >= 70) return "text-good";
  if (p.pipelineScore <= 30) return "text-bad";
  return "";
}

function pipelineTitle(p: any): string | undefined {
  if (p.pipelineScore == null) return undefined;
  if (p.pipelineScore >= 70) return `Pipeline school (${p.pipelineScore}/100) — you've landed a transfer from here before`;
  if (p.pipelineScore <= 30) return `Cold connection (${p.pipelineScore}/100)`;
  return `Connection strength: ${p.pipelineScore}/100`;
}

function priorityLabel(p: any): string {
  if (!p.topPriorities || p.topPriorities.length === 0) return "—";
  return p.topPriorities.map((k: string) => PRIORITY_LABELS[k as keyof typeof PRIORITY_LABELS] ?? k).join(", ");
}

export default function TransfersPage() {
  const { activeSaveId } = useSave();
  const [board, setBoard] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

  async function refresh() {
    if (activeSaveId) setBoard(await api.getTransferBoard(activeSaveId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSaveId]);

  async function pursue(playerId: string) {
    if (!activeSaveId) return;
    await api.pursueTransfer(activeSaveId, playerId, 15);
    await refresh();
  }

  return (
    <div>
      <h1>Transfer Portal</h1>
      <p className="text-muted">
        Proven college players who've entered the portal. Their true ratings are already known — no scouting
        uncertainty. Landing one transfer builds a connection to their old program that makes the next transfer
        from that same school easier to land.
      </p>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Pos</th><th>Yr</th><th>Home</th><th>Previous School</th><th>Elig.</th>
              <th>Priorities</th>
              <th>OVR</th><th>Scoring</th><th>Defense</th><th>Character*</th><th>Interest</th><th>Points</th><th></th>
            </tr>
          </thead>
          <tbody>
            {board.map((p) => (
              <tr key={p.id}>
                <td>
                  <button className="player-name-link" onClick={() => setSelectedPlayer(p)}>
                    {p.firstName} {p.lastName}
                  </button>
                </td>
                <td>{p.position}</td>
                <td>{p.classYear}</td>
                <td>{homeLabel(p)}</td>
                <td className={pipelineClass(p)} title={pipelineTitle(p)}>{p.previousSchool ?? "—"}</td>
                <td>{p.eligibilityYearsLeft} yr</td>
                <td className="text-muted" style={{ fontFamily: "inherit", whiteSpace: "nowrap" }}>{priorityLabel(p)}</td>
                <td>{overall(p)}</td>
                <td>{p.scoring}</td>
                <td>{p.defense}</td>
                <td>{p.characterRating}</td>
                <td>{p.interestLevel}</td>
                <td>{p.pointsInvested}</td>
                <td><button className="secondary" onClick={() => pursue(p.id)}>Pursue (15 pts)</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {board.length === 0 && <p>No one's in the portal right now.</p>}
        <p className="text-muted" style={{ fontSize: "0.8rem", marginTop: 8 }}>
          * Off-court ratings for a transfer are already fully known — they've played real college minutes.
          "Priorities" are what this player actually cares about when picking their next school.
          The previous-school column is colored when you've built a connection there from a past transfer (green)
          or let it go cold (red) — hover for details.
        </p>
      </div>

      {selectedPlayer && (
        <div className="modal-backdrop" onClick={() => setSelectedPlayer(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedPlayer.firstName} {selectedPlayer.lastName}</h2>
            <p className="text-muted">
              {selectedPlayer.position} · {selectedPlayer.classYear} · Overall {overall(selectedPlayer)}
            </p>
            <div className="player-detail-grid">
              <div>
                <div className="label">Hometown</div>
                <div className="value">{homeLabel(selectedPlayer)}</div>
              </div>
              <div>
                <div className="label">Previous School</div>
                <div className="value">{selectedPlayer.previousSchool ?? "—"}</div>
              </div>
              <div>
                <div className="label">Eligibility Left</div>
                <div className="value">{selectedPlayer.eligibilityYearsLeft} yr</div>
              </div>
            </div>
            <div className="player-detail-grid">
              <div><div className="label">Scoring</div><div className="value">{selectedPlayer.scoring}</div></div>
              <div><div className="label">3PT</div><div className="value">{selectedPlayer.threePoint}</div></div>
              <div><div className="label">Finishing</div><div className="value">{selectedPlayer.finishing}</div></div>
              <div><div className="label">Playmaking</div><div className="value">{selectedPlayer.playmaking}</div></div>
              <div><div className="label">Rebounding</div><div className="value">{selectedPlayer.rebounding}</div></div>
              <div><div className="label">Defense</div><div className="value">{selectedPlayer.defense}</div></div>
              <div><div className="label">Athleticism</div><div className="value">{selectedPlayer.athleticism}</div></div>
              <div><div className="label">Basketball IQ</div><div className="value">{selectedPlayer.basketballIq}</div></div>
              <div><div className="label">Character</div><div className="value">{selectedPlayer.characterRating}</div></div>
              <div><div className="label">Discipline</div><div className="value">{selectedPlayer.disciplineRating}</div></div>
            </div>
            <p className="text-muted">Priorities: {priorityLabel(selectedPlayer)}</p>
            {selectedPlayer.careerStats && selectedPlayer.careerStats.length > 0 && (
              <>
                <h3 style={{ marginTop: 16, marginBottom: 6 }}>Career Stats{selectedPlayer.previousSchool ? ` — ${selectedPlayer.previousSchool}` : ""}</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Season</th><th>GP</th><th>MPG</th><th>PPG</th><th>RPG</th><th>APG</th><th>SPG</th><th>BPG</th><th>TOPG</th>
                      <th>FG%</th><th>3P%</th><th>FT%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPlayer.careerStats.map((s: any) => (
                      <tr key={s.seasonYear}>
                        <td>{s.seasonYear}</td>
                        <td>{s.gamesPlayed}</td>
                        <td>{s.mpg}</td>
                        <td>{s.ppg}</td>
                        <td>{s.rpg}</td>
                        <td>{s.apg}</td>
                        <td>{s.spg}</td>
                        <td>{s.bpg}</td>
                        <td>{s.topg}</td>
                        <td>{s.fgPct}%</td>
                        <td>{s.threePct}%</td>
                        <td>{s.ftPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <button style={{ marginTop: 12 }} onClick={() => setSelectedPlayer(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
