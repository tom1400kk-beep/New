import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import PlayerLink from "../components/PlayerLink";
import TeamLink from "../components/TeamLink";

type CategoryKey = "PPG" | "RPG" | "APG" | "SPG" | "BPG" | "FG_PCT";
type StatField = "ppg" | "rpg" | "apg" | "spg" | "bpg" | "fgPct";

const CATEGORIES: { key: CategoryKey; label: string; field: StatField }[] = [
  { key: "PPG", label: "Points", field: "ppg" },
  { key: "RPG", label: "Rebounds", field: "rpg" },
  { key: "APG", label: "Assists", field: "apg" },
  { key: "SPG", label: "Steals", field: "spg" },
  { key: "BPG", label: "Blocks", field: "bpg" },
  { key: "FG_PCT", label: "FG%", field: "fgPct" },
];

interface StatLeader {
  playerId: string;
  name: string;
  position: string;
  classYear: string;
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
}

interface StatLeadersResponse {
  seasonYear: number;
  minGamesPlayed: number;
  players: StatLeader[];
}

export default function StatsPage() {
  const { activeSaveId } = useSave();
  const [data, setData] = useState<StatLeadersResponse | null>(null);
  const [category, setCategory] = useState<CategoryKey>("PPG");
  const [topN, setTopN] = useState<number>(10);

  useEffect(() => {
    if (activeSaveId) api.getStatLeaders(activeSaveId).then(setData);
  }, [activeSaveId]);

  const activeCategory = CATEGORIES.find((c) => c.key === category)!;

  const leaders = useMemo(() => {
    if (!data) return [];
    return [...data.players].sort((a, b) => b[activeCategory.field] - a[activeCategory.field]).slice(0, topN);
  }, [data, activeCategory, topN]);

  return (
    <div>
      <h1>Stat Leaders</h1>
      {data && (
        <p className="text-muted" style={{ marginTop: -8 }}>
          {data.seasonYear}–{data.seasonYear + 1} season · minimum {data.minGamesPlayed} games played
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => (
          <button key={c.key} className={category === c.key ? "" : "secondary"} onClick={() => setCategory(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label>Show: </label>
        <select value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
          <option value={10}>Top 10</option>
          <option value={20}>Top 20</option>
        </select>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Player</th><th>Team</th><th>Pos</th><th>Yr</th><th>GP</th>
              <th>PPG</th><th>RPG</th><th>APG</th><th>SPG</th><th>BPG</th><th>FG%</th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((p, i) => (
              <tr key={p.playerId}>
                <td>{i + 1}</td>
                <td><PlayerLink playerId={p.playerId} name={p.name} /></td>
                <td><TeamLink teamId={p.teamId} name={p.teamName} /></td>
                <td className="text-muted">{p.position}</td>
                <td className="text-muted">{p.classYear}</td>
                <td className="text-muted">{p.gamesPlayed}</td>
                <td style={category === "PPG" ? { fontWeight: 700 } : undefined}>{p.ppg}</td>
                <td style={category === "RPG" ? { fontWeight: 700 } : undefined}>{p.rpg}</td>
                <td style={category === "APG" ? { fontWeight: 700 } : undefined}>{p.apg}</td>
                <td style={category === "SPG" ? { fontWeight: 700 } : undefined}>{p.spg}</td>
                <td style={category === "BPG" ? { fontWeight: 700 } : undefined}>{p.bpg}</td>
                <td style={category === "FG_PCT" ? { fontWeight: 700 } : undefined}>{p.fgPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {leaders.length === 0 && <p className="text-muted">Not enough games played yet this season.</p>}
      </div>
    </div>
  );
}