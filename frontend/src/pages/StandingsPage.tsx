import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";

export default function StandingsPage() {
  const { activeSaveId } = useSave();
  const [standings, setStandings] = useState<any>({ conferenceName: null, rows: [] });

  useEffect(() => {
    if (activeSaveId) api.getStandings(activeSaveId).then(setStandings);
  }, [activeSaveId]);

  return (
    <div>
      <h1>Standings</h1>
      <div className="card" style={{ overflowX: "auto" }}>
        <h3>{standings.conferenceName ?? "Conference"}</h3>
        <table>
          <thead>
            <tr><th>Team</th><th>Overall</th><th>Conference</th></tr>
          </thead>
          <tbody>
            {standings.rows.map((r: any) => (
              <tr key={r.teamId}>
                <td>{r.name}</td>
                <td>{r.wins}-{r.losses}</td>
                <td>{r.confWins}-{r.confLosses}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {standings.rows.length === 0 && <p>No standings yet.</p>}
      </div>
    </div>
  );
}
