import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import TeamLink from "../components/TeamLink";

type Tab = "CONFERENCE" | "AP_POLL" | "KENPOM" | "RPI" | "BRACKETOLOGY";
const REGIONS = ["East", "West", "South", "Midwest"];
const DIVISIONS = ["D1", "D2", "D3"];
const DIVISION_LABELS: Record<string, string> = { D1: "NCAA Division I", D2: "NCAA Division II", D3: "NCAA Division III" };

export default function StandingsPage() {
  const { activeSaveId } = useSave();
  const [tab, setTab] = useState<Tab>("CONFERENCE");
  const [division, setDivision] = useState<string>("D1");
  const [myDivision, setMyDivision] = useState<string | null>(null);
  const [myConferenceId, setMyConferenceId] = useState<string | null>(null);
  const [conferences, setConferences] = useState<any[]>([]);
  const [conferenceId, setConferenceId] = useState<string>("");
  const [standings, setStandings] = useState<any>({ conferenceName: null, rows: [] });
  const [apPoll, setApPoll] = useState<any>(null);
  const [kenpom, setKenpom] = useState<any[]>([]);
  const [rpi, setRpi] = useState<any[]>([]);
  const [bracket, setBracket] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Figure out the user's own division/conference once, to pick a sensible
  // default before the user ever touches the division switcher.
  useEffect(() => {
    if (!activeSaveId) return;
    api.getDashboard(activeSaveId).then((d) => {
      if (d.team) {
        setMyDivision(d.team.division);
        setMyConferenceId(d.team.conference?.id ?? null);
        setDivision(d.team.division);
      }
    });
  }, [activeSaveId]);

  // Reload the conference list whenever the division changes, and pick a
  // default conference — the user's own if it's in this division, else the
  // first one alphabetically.
  useEffect(() => {
    if (!activeSaveId) return;
    api.getConferences(activeSaveId, division).then((confs) => {
      setConferences(confs);
      const fallback = division === myDivision && myConferenceId ? myConferenceId : confs[0]?.id ?? "";
      setConferenceId(fallback);
    });
    setApPoll(null);
    setKenpom([]);
    setRpi([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSaveId, division]);

  useEffect(() => {
    if (activeSaveId && conferenceId) api.getStandings(activeSaveId, conferenceId).then(setStandings);
  }, [activeSaveId, conferenceId]);

  useEffect(() => {
    if (!activeSaveId) return;
    if (tab === "AP_POLL") {
      setLoading(true);
      api.getApPoll(activeSaveId, division).then(setApPoll).finally(() => setLoading(false));
    } else if (tab === "KENPOM") {
      setLoading(true);
      api.getKenPom(activeSaveId, division).then((d) => setKenpom(d.rows)).finally(() => setLoading(false));
    } else if (tab === "RPI") {
      setLoading(true);
      api.getRPI(activeSaveId, division).then((d) => setRpi(d.rows)).finally(() => setLoading(false));
    } else if (tab === "BRACKETOLOGY" && division === "D1" && !bracket) {
      setLoading(true);
      api.getBracketology(activeSaveId).then(setBracket).finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeSaveId, division]);

  return (
    <div>
      <h1>Standings</h1>
      <div className="card">
        <label>Division: </label>
        <select value={division} onChange={(e) => setDivision(e.target.value)}>
          {DIVISIONS.map((d) => (
            <option key={d} value={d}>{DIVISION_LABELS[d]}{d === myDivision ? " (yours)" : ""}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button className={tab === "CONFERENCE" ? "" : "secondary"} onClick={() => setTab("CONFERENCE")}>Conference</button>
        <button className={tab === "AP_POLL" ? "" : "secondary"} onClick={() => setTab("AP_POLL")}>AP Poll</button>
        <button className={tab === "KENPOM" ? "" : "secondary"} onClick={() => setTab("KENPOM")}>KenPom</button>
        <button className={tab === "RPI" ? "" : "secondary"} onClick={() => setTab("RPI")}>RPI</button>
        <button className={tab === "BRACKETOLOGY" ? "" : "secondary"} onClick={() => setTab("BRACKETOLOGY")}>Bracketology</button>
      </div>

      {tab === "CONFERENCE" && (
        <div className="card" style={{ overflowX: "auto" }}>
          <label>Conference: </label>
          <select value={conferenceId} onChange={(e) => setConferenceId(e.target.value)}>
            {conferences.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <h3 style={{ marginTop: 12 }}>{standings.conferenceName ?? "Conference"}</h3>
          <table>
            <thead>
              <tr><th>Team</th><th>Overall</th><th>Conference</th></tr>
            </thead>
            <tbody>
              {standings.rows.map((r: any) => (
                <tr key={r.teamId}>
                  <td><TeamLink teamId={r.teamId} name={r.name} /></td>
                  <td>{r.wins}-{r.losses}</td>
                  <td>{r.confWins}-{r.confLosses}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {standings.rows.length === 0 && <p>No standings yet.</p>}
        </div>
      )}

      {tab === "AP_POLL" && (
        <div className="card" style={{ overflowX: "auto" }}>
          <h3>AP Top 25{apPoll ? ` — ${apPoll.division}` : ""}</h3>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            {apPoll?.isPreview
              ? "Preseason preview — the first official poll drops the first Monday of the season, and updates every Monday after that."
              : apPoll?.weekOf
                ? `Week of ${new Date(apPoll.weekOf).toLocaleDateString()} — updates every Monday.`
                : "Updates every Monday."}
          </p>
          {loading && <p>Loading…</p>}
          <table>
            <thead>
              <tr><th>Rank</th><th>Team</th><th>Record</th></tr>
            </thead>
            <tbody>
              {apPoll?.rankings.map((r: any) => (
                <tr key={r.teamId}>
                  <td>{r.rank}</td>
                  <td><TeamLink teamId={r.teamId} name={r.name} /></td>
                  <td className="text-muted">{r.wins}-{r.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && apPoll && apPoll.rankings.length === 0 && <p>No poll available yet.</p>}
        </div>
      )}

      {tab === "KENPOM" && (
        <div className="card" style={{ overflowX: "auto" }}>
          <h3>KenPom-Style Efficiency Ratings — {DIVISION_LABELS[division]}</h3>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            Adjusted offensive/defensive efficiency (points per 100 possessions), adjusted for opponent strength.
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
                  <td><TeamLink teamId={r.teamId} name={r.name} /></td>
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
          <h3>RPI — {DIVISION_LABELS[division]}</h3>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            Rating Percentage Index: 25% own win pct, 50% opponents' win pct, 25% opponents' opponents' win pct.
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
                  <td><TeamLink teamId={r.teamId} name={r.name} /></td>
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

      {tab === "BRACKETOLOGY" && division !== "D1" && (
        <div className="card">
          <p className="text-muted">
            The NCAA Tournament is a Division I-only event — switch the division above to D1 to see a projected field.
            {DIVISION_LABELS[division]} doesn't have an equivalent modeled here.
          </p>
        </div>
      )}

      {tab === "BRACKETOLOGY" && division === "D1" && (
        <div>
          <p className="text-muted">
            Projected NCAA Tournament field if the season ended today — auto bids assume the current conference leader
            wins its conference tournament.
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
                            <td><TeamLink teamId={t.teamId} name={t.name} /></td>
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
                <p>
                  <strong>First Four Out:</strong>{" "}
                  {bracket.bubbleWatch.firstFourOut.length === 0 ? "—" : bracket.bubbleWatch.firstFourOut.map((t: any, i: number) => (
                    <span key={t.teamId}>{i > 0 && ", "}<TeamLink teamId={t.teamId} name={t.name} /></span>
                  ))}
                </p>
                <p>
                  <strong>Next Four Out:</strong>{" "}
                  {bracket.bubbleWatch.nextFourOut.length === 0 ? "—" : bracket.bubbleWatch.nextFourOut.map((t: any, i: number) => (
                    <span key={t.teamId}>{i > 0 && ", "}<TeamLink teamId={t.teamId} name={t.name} /></span>
                  ))}
                </p>
              </div>
            </>
          )}
          {bracket && bracket.field.length === 0 && !loading && <p>Not enough games played yet to project a field.</p>}
        </div>
      )}
    </div>
  );
}
