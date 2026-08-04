import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";

type Tab = "CONFERENCE" | "KENPOM" | "RPI" | "BRACKETOLOGY";
const REGIONS = ["East", "West", "South", "Midwest"];

export default function StandingsPage() {
  const { activeSaveId } = useSave();
  const [tab, setTab] = useState<Tab>("CONFERENCE");
  const [standings, setStandings] = useState<any>({ conferenceName: null, rows: [] });
  const [kenpom, setKenpom] = useState<any[]>([]);
  const [rpi, setRpi] = useState<any[]>([]);
  const [bracket, setBracket] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeSaveId) api.getStandings(activeSaveId).then(setStandings);
  }, [activeSaveId]);

  useEffect(() => {
    if (!activeSaveId) return;
    if (tab === "KENPOM" && kenpom.length === 0) {
      setLoading(true);
      api.getKenPom(activeSaveId).then(setKenpom).finally(() => setLoading(false));
    } else if (tab === "RPI" && rpi.length === 0) {
      setLoading(true);
      api.getRPI(activeSaveId).then(setRpi).finally(() => setLoading(false));
    } else if (tab === "BRACKETOLOGY" && !bracket) {
      setLoading(true);
      api.getBracketology(activeSaveId).then(setBracket).finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeSaveId]);

  return (
    <div>
      <h1>Standings</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className={tab === "CONFERENCE" ? "" : "secondary"} onClick={() => setTab("CONFERENCE")}>Conference</button>
        <button className={tab === "KENPOM" ? "" : "secondary"} onClick={() => setTab("KENPOM")}>KenPom</button>
        <button className={tab === "RPI" ? "" : "secondary"} onClick={() => setTab("RPI")}>RPI</button>
        <button className={tab === "BRACKETOLOGY" ? "" : "secondary"} onClick={() => setTab("BRACKETOLOGY")}>Bracketology</button>
      </div>

      {tab === "CONFERENCE" && (
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
      )}

      {tab === "KENPOM" && (
        <div className="card" style={{ overflowX: "auto" }}>
          <h3>KenPom-Style Efficiency Ratings</h3>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            Adjusted offensive/defensive efficiency (points per 100 possessions), adjusted for opponent strength — D1 only.
          </p>
          {loading && <p>Loading…</p>}
          <table>
            <thead>
              <tr><th>Rank</th><th>Team</th><th>GP</th><th>AdjEM</th><th>AdjO</th><th>AdjD</th><th>AdjT</th></tr>
            </thead>
            <tbody>
              {kenpom.map((r: any) => (
                <tr key={r.teamId}>
                  <td>{r.rank}</td>
                  <td>{r.name}</td>
                  <td className="text-muted">{r.gamesPlayed}</td>
                  <td className={r.adjEM >= 0 ? "text-good" : "text-bad"}>{r.adjEM > 0 ? "+" : ""}{r.adjEM}</td>
                  <td>{r.adjO}</td>
                  <td>{r.adjD}</td>
                  <td className="text-muted">{r.adjTempo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && kenpom.length === 0 && <p>No games played yet this season.</p>}
        </div>
      )}

      {tab === "RPI" && (
        <div className="card" style={{ overflowX: "auto" }}>
          <h3>RPI</h3>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            Rating Percentage Index: 25% own win pct, 50% opponents' win pct, 25% opponents' opponents' win pct — D1 only.
          </p>
          {loading && <p>Loading…</p>}
          <table>
            <thead>
              <tr><th>Rank</th><th>Team</th><th>Record</th><th>RPI</th><th>OWP</th><th>OOWP</th></tr>
            </thead>
            <tbody>
              {rpi.map((r: any) => (
                <tr key={r.teamId}>
                  <td>{r.rank}</td>
                  <td>{r.name}</td>
                  <td className="text-muted">{r.wins}-{r.losses}</td>
                  <td>{r.rpi.toFixed(3)}</td>
                  <td className="text-muted">{r.owp.toFixed(3)}</td>
                  <td className="text-muted">{r.oowp.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rpi.length === 0 && <p>No games played yet this season.</p>}
        </div>
      )}

      {tab === "BRACKETOLOGY" && (
        <div>
          <p className="text-muted">
            Projected NCAA Tournament field if the season ended today — auto bids assume the current conference leader
            wins its conference tournament. D1 only.
          </p>
          {loading && <p>Loading…</p>}
          {bracket && bracket.field.length > 0 && (
            <>
              {REGIONS.map((region) => (
                <div className="card" key={region} style={{ overflowX: "auto" }}>
                  <h3>{region} Region</h3>
                  <table>
                    <thead>
                      <tr><th>Seed</th><th>Team</th><th>Record</th><th>Bid</th></tr>
                    </thead>
                    <tbody>
                      {bracket.field
                        .filter((t: any) => t.region === region)
                        .sort((a: any, b: any) => a.seedLine - b.seedLine)
                        .map((t: any) => (
                          <tr key={t.teamId}>
                            <td>{t.seedLine}{t.isFirstFour ? "*" : ""}</td>
                            <td>{t.name}</td>
                            <td className="text-muted">{t.wins}-{t.losses}</td>
                            <td className="text-muted">{t.isAutoBid ? "Auto" : "At-Large"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <p className="text-muted" style={{ fontSize: "0.8rem" }}>* First Four play-in game</p>

              <div className="card">
                <h3>Bubble Watch</h3>
                <p><strong>First Four Out:</strong> {bracket.bubbleWatch.firstFourOut.map((t: any) => t.name).join(", ") || "—"}</p>
                <p><strong>Next Four Out:</strong> {bracket.bubbleWatch.nextFourOut.map((t: any) => t.name).join(", ") || "—"}</p>
              </div>
            </>
          )}
          {bracket && bracket.field.length === 0 && !loading && <p>Not enough games played yet to project a field.</p>}
        </div>
      )}
    </div>
  );
}
