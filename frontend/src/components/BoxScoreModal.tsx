import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import TeamLink from "./TeamLink";
import PlayerLink from "./PlayerLink";

function pct(made: number, att: number): string {
  return att > 0 ? `${Math.round((made / att) * 100)}%` : "—";
}

function TeamBoxTable({ team }: { team: any }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 4 }}>
        <TeamLink teamId={team.teamId} name={team.name} /> — {team.score}
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Player</th><th>Pos</th><th>Yr</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th>
              <th>STL</th><th>BLK</th><th>TO</th><th>FG</th><th>3PT</th><th>FT</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((p: any) => (
              <tr key={p.playerId}>
                <td><PlayerLink playerId={p.playerId} name={p.name} /></td>
                <td className="text-muted">{p.position}</td>
                <td className="text-muted">{p.classYear}</td>
                <td>{p.minutes}</td>
                <td>{p.points}</td>
                <td>{p.rebounds}</td>
                <td>{p.assists}</td>
                <td>{p.steals}</td>
                <td>{p.blocks}</td>
                <td>{p.turnovers}</td>
                <td className="text-muted">{p.fgm}-{p.fga}</td>
                <td className="text-muted">{p.threepm}-{p.threepa}</td>
                <td className="text-muted">{p.ftm}-{p.fta}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={3}>Team Totals</td>
              <td>—</td>
              <td>{team.totals.points}</td>
              <td>{team.totals.rebounds}</td>
              <td>{team.totals.assists}</td>
              <td>{team.totals.steals}</td>
              <td>{team.totals.blocks}</td>
              <td>{team.totals.turnovers}</td>
              <td className="text-muted">{team.totals.fgm}-{team.totals.fga} ({pct(team.totals.fgm, team.totals.fga)})</td>
              <td className="text-muted">{team.totals.threepm}-{team.totals.threepa} ({pct(team.totals.threepm, team.totals.threepa)})</td>
              <td className="text-muted">{team.totals.ftm}-{team.totals.fta} ({pct(team.totals.ftm, team.totals.fta)})</td>
            </tr>
          </tfoot>
        </table>
        {team.players.length === 0 && <p className="text-muted">No box score data for this team.</p>}
      </div>
    </div>
  );
}

export default function BoxScoreModal({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const { activeSaveId } = useSave();
  const [box, setBox] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeSaveId) return;
    setLoading(true);
    api.getGameBoxScore(activeSaveId, gameId).then(setBox).finally(() => setLoading(false));
  }, [activeSaveId, gameId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820 }}>
        {loading || !box ? (
          <p>Loading…</p>
        ) : (
          <>
            <h2>Box Score</h2>
            <p className="text-muted" style={{ marginTop: -8 }}>
              {new Date(box.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              {box.isConference ? " · Conference game" : ""}
            </p>
            <TeamBoxTable team={box.away} />
            <TeamBoxTable team={box.home} />
          </>
        )}
        <button style={{ marginTop: 4 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}