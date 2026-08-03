import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";

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
        </select>
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Pos</th><th>Stars</th><th>Home</th><th>Source</th>
              <th>Scoring</th><th>Defense</th><th>Character*</th><th>Interest</th><th>Points</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{p.firstName} {p.lastName}</td>
                <td>{p.position}</td>
                <td>{"★".repeat(p.starRating)}</td>
                <td>{p.hometownState}</td>
                <td>{p.source === "JUCO" ? "JUCO" : "HS"}</td>
                <td>{p.scouted.scoring}</td>
                <td>{p.scouted.defense}</td>
                <td>{p.scouted.characterRating}</td>
                <td>{p.interestLevel}</td>
                <td>{p.pointsInvested}</td>
                <td><button className="secondary" onClick={() => pursue(p.id)}>Pursue (15 pts)</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p>No prospects loaded.</p>}
        <p style={{ color: "#9aa4b2", fontSize: "0.8rem", marginTop: 8 }}>
          * Scouted ratings carry uncertainty — true ability may differ from what your staff reports.
        </p>
      </div>
    </div>
  );
}
