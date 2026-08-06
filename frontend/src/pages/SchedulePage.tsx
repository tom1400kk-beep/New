import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import TeamLink from "../components/TeamLink";
import BoxScoreModal from "../components/BoxScoreModal";

function fmtAttendance(n: number) {
  return n.toLocaleString();
}

export default function SchedulePage() {
  const { activeSaveId } = useSave();
  const [teamName, setTeamName] = useState<string | null>(null);
  const [games, setGames] = useState<any[]>([]);
  const [boxScoreGameId, setBoxScoreGameId] = useState<string | null>(null);

  useEffect(() => {
    if (activeSaveId) api.getSchedule(activeSaveId).then((data) => { setTeamName(data.teamName); setGames(data.games); });
  }, [activeSaveId]);

  return (
    <div>
      <h1>{teamName ? `${teamName} Schedule` : "Schedule"}</h1>
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
                  {g.isHome ? "vs" : "@"} <TeamLink teamId={g.opponentId} name={g.opponentName} />
                  {g.isRivalry && <span className="text-bad" title={`Rivalry intensity ${g.rivalryIntensity}/100`}> 🔥 Rivalry</span>}
                </td>
                <td>
                  {g.isPlayed ? (
                    <button className="player-name-link" onClick={() => setBoxScoreGameId(g.id)}>
                      {g.homeScore} - {g.awayScore}
                    </button>
                  ) : "—"}
                </td>
                <td className="text-muted">{g.isPlayed && g.attendance != null ? fmtAttendance(g.attendance) : "—"}</td>
                <td>{g.tournament ? g.tournament.type.replace(/_/g, " ") : g.isConference ? "Conference" : "Non-Conf"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {games.length === 0 && <p>No games loaded.</p>}
      </div>
      {boxScoreGameId && <BoxScoreModal gameId={boxScoreGameId} onClose={() => setBoxScoreGameId(null)} />}
    </div>
  );
}
