import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import PlayerLink from "../components/PlayerLink";
import CoachLink from "../components/CoachLink";
import TeamLink from "../components/TeamLink";

const DIVISIONS = ["D1", "D2", "D3"];
const DIVISION_LABELS: Record<string, string> = { D1: "NCAA Division I", D2: "NCAA Division II", D3: "NCAA Division III" };

interface AwardEntry {
  type: string;
  playerId: string | null;
  playerName: string | null;
  coachId: string | null;
  coachName: string | null;
  teamId: string | null;
  teamName: string | null;
}

interface AwardsResponse {
  seasonYear: number | null;
  division: string;
  availableSeasons: number[];
  playerOfYear: AwardEntry | null;
  coachOfYear: AwardEntry | null;
  allAmerican: { first: AwardEntry[]; second: AwardEntry[]; third: AwardEntry[] };
  allConference: { conferenceId: string; conferenceName: string; first: AwardEntry[]; second: AwardEntry[] }[];
}

function EntryRow({ e }: { e: AwardEntry }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
      <span>{e.playerId && e.playerName ? <PlayerLink playerId={e.playerId} name={e.playerName} /> : "—"}</span>
      <span className="text-muted">{e.teamId && e.teamName ? <TeamLink teamId={e.teamId} name={e.teamName} /> : ""}</span>
    </div>
  );
}

export default function AwardsPage() {
  const { activeSaveId } = useSave();
  const [division, setDivision] = useState("D1");
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [data, setData] = useState<AwardsResponse | null>(null);

  useEffect(() => {
    if (!activeSaveId) return;
    api.getAwards(activeSaveId, seasonYear ?? undefined, division).then((d) => {
      setData(d);
      if (seasonYear === null && d.seasonYear !== null) setSeasonYear(d.seasonYear);
    });
  }, [activeSaveId, division, seasonYear]);

  return (
    <div>
      <h1>Awards</h1>

      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div>
          <label>Division: </label>
          <select value={division} onChange={(e) => setDivision(e.target.value)}>
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>{DIVISION_LABELS[d]}</option>
            ))}
          </select>
        </div>
        {data && data.availableSeasons.length > 0 && (
          <div>
            <label>Season: </label>
            <select value={seasonYear ?? ""} onChange={(e) => setSeasonYear(Number(e.target.value))}>
              {data.availableSeasons.map((y) => (
                <option key={y} value={y}>{y}–{y + 1}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!data || data.seasonYear === null ? (
        <p className="text-muted">No awards recorded yet — these are handed out once a regular season finishes.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div className="card" style={{ flex: 1, minWidth: 260 }}>
              <h2 style={{ marginTop: 0 }}>Player of the Year</h2>
              {data.playerOfYear ? <EntryRow e={data.playerOfYear} /> : <p className="text-muted">Not enough games played this season.</p>}
            </div>
            <div className="card" style={{ flex: 1, minWidth: 260 }}>
              <h2 style={{ marginTop: 0 }}>Coach of the Year</h2>
              {data.coachOfYear ? (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span>{data.coachOfYear.coachId && data.coachOfYear.coachName ? <CoachLink coachId={data.coachOfYear.coachId} name={data.coachOfYear.coachName} /> : "—"}</span>
                  <span className="text-muted">{data.coachOfYear.teamId && data.coachOfYear.teamName ? <TeamLink teamId={data.coachOfYear.teamId} name={data.coachOfYear.teamName} /> : ""}</span>
                </div>
              ) : (
                <p className="text-muted">Not enough games played this season.</p>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>All-{DIVISION_LABELS[division].replace("NCAA ", "")} American Teams</h2>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {(["first", "second", "third"] as const).map((tier) => (
                <div key={tier} style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ textTransform: "capitalize" }}>{tier} Team</h3>
                  {data.allAmerican[tier].length === 0 ? (
                    <p className="text-muted">—</p>
                  ) : (
                    data.allAmerican[tier].map((e, i) => <EntryRow key={i} e={e} />)
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>All-Conference Teams</h2>
            {data.allConference.length === 0 && <p className="text-muted">No conference honors recorded.</p>}
            {data.allConference.map((c) => (
              <div key={c.conferenceId} style={{ marginBottom: 16 }}>
                <h3>{c.conferenceName}</h3>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="label">First Team</div>
                    {c.first.map((e, i) => <EntryRow key={i} e={e} />)}
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="label">Second Team</div>
                    {c.second.map((e, i) => <EntryRow key={i} e={e} />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
