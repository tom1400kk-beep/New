import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";

function overall(p: any): number {
  return Math.round((p.scoring + p.threePoint + p.finishing + p.playmaking + p.rebounding + p.defense + p.athleticism + p.basketballIq) / 8);
}

export default function RosterPage() {
  const { activeSaveId } = useSave();
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    if (activeSaveId) api.getRoster(activeSaveId).then(setPlayers);
  }, [activeSaveId]);

  return (
    <div>
      <h1>Roster</h1>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Pos</th><th>Yr</th><th>OVR</th><th>Scoring</th><th>3PT</th><th>Finish</th>
              <th>Playmaking</th><th>Rebounding</th><th>Defense</th><th>Character</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>{p.firstName} {p.lastName}</td>
                <td>{p.position}</td>
                <td>{p.classYear}</td>
                <td>{overall(p)}</td>
                <td>{p.scoring}</td>
                <td>{p.threePoint}</td>
                <td>{p.finishing}</td>
                <td>{p.playmaking}</td>
                <td>{p.rebounding}</td>
                <td>{p.defense}</td>
                <td className={p.characterRating < 40 ? "text-bad" : p.characterRating > 75 ? "text-good" : ""}>
                  {p.characterRating}
                </td>
                <td>{p.isInjured ? `Injured (${p.injuryWeeksLeft}d)` : "Healthy"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {players.length === 0 && <p>No roster loaded.</p>}
      </div>
    </div>
  );
}
