import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";

function fmtAttendance(n: number) {
  return n.toLocaleString();
}

export default function SchedulePage() {
  const { activeSaveId } = useSave();
  const [games, setGames] = useState<any[]>([]);

  useEffect(() => {
    if (activeSaveId) api.getSchedule(activeSaveId).then(setGames);
  }, [activeSaveId]);

  return (
    <div>
      <h1>Schedule</h1>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr><th>Date</th><th>Matchup</th><th>Result</th><th>Attendance</th><th>Type</th></tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id} style={g.isRivalry ? { background: "rgba(220, 80, 40, 0.1)" } : undefined}>
                <td>{new Date(g.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                <td>
                  {g.homeTeam.name} vs {g.awayTeam.name}
                  {g.isRivalry && <span className="text-bad" title={`Rivalry intensity ${g.rivalryIntensity}/100`}> 🔥 Rivalry</span>}
                </td>
                <td>
                  {g.isPlayed ? `${g.homeScore} - ${g.awayScore}` : "—"}
                </td>
                <td className="text-muted">{g.isPlayed && g.attendance != null ? fmtAttendance(g.attendance) : "—"}</td>
                <td>{g.tournament ? g.tournament.type.replace(/_/g, " ") : g.isConference ? "Conference" : "Non-Conf"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {games.length === 0 && <p>No games loaded.</p>}
      </div>
    </div>
  );
}
