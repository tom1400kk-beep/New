import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";

type PositionKey = "pg" | "sg" | "sf" | "pf" | "c";

const POSITIONS: { key: PositionKey; label: string }[] = [
  { key: "pg", label: "Point Guard" },
  { key: "sg", label: "Shooting Guard" },
  { key: "sf", label: "Small Forward" },
  { key: "pf", label: "Power Forward" },
  { key: "c", label: "Center" },
];

interface RosterEntry {
  playerId: string;
  name: string;
  position: string;
  classYear: string;
  overall: number;
  isInjured: boolean;
  isSuspended: boolean;
}

interface DepthChart {
  pg: string | null;
  sg: string | null;
  sf: string | null;
  pf: string | null;
  c: string | null;
  bench: string[];
}

const EMPTY_CHART: DepthChart = { pg: null, sg: null, sf: null, pf: null, c: null, bench: [] };

function statusSuffix(p: RosterEntry): string {
  return p.isInjured ? " (Injured)" : p.isSuspended ? " (Suspended)" : "";
}

export default function DepthChartPage() {
  const { activeSaveId } = useSave();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [chart, setChart] = useState<DepthChart>(EMPTY_CHART);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (activeSaveId) {
      api.getDepthChart(activeSaveId).then((d) => {
        if (d) {
          setChart(d.chart);
          setRoster(d.roster);
        }
      });
    }
  }, [activeSaveId]);

  function playerById(id: string): RosterEntry | undefined {
    return roster.find((p) => p.playerId === id);
  }

  const assignedIds = new Set([chart.pg, chart.sg, chart.sf, chart.pf, chart.c, ...chart.bench].filter((x): x is string => !!x));
  const unassigned = roster.filter((p) => !assignedIds.has(p.playerId));

  function setStarter(posKey: PositionKey, playerId: string) {
    setChart((c) => {
      const next: DepthChart = { ...c, bench: [...c.bench] };
      if (playerId) {
        for (const { key } of POSITIONS) {
          if (key !== posKey && next[key] === playerId) next[key] = null;
        }
        next.bench = next.bench.filter((id) => id !== playerId);
      }
      next[posKey] = playerId || null;
      return next;
    });
  }

  function addToBench(playerId: string) {
    if (!playerId) return;
    setChart((c) => ({ ...c, bench: [...c.bench, playerId] }));
  }

  function removeFromBench(playerId: string) {
    setChart((c) => ({ ...c, bench: c.bench.filter((id) => id !== playerId) }));
  }

  function moveBench(index: number, dir: -1 | 1) {
    setChart((c) => {
      const bench = [...c.bench];
      const j = index + dir;
      if (j < 0 || j >= bench.length) return c;
      [bench[index], bench[j]] = [bench[j], bench[index]];
      return { ...c, bench };
    });
  }

  async function save() {
    if (!activeSaveId) return;
    setSaving(true);
    try {
      const result = await api.setDepthChart(activeSaveId, chart);
      if (result) {
        setChart(result.chart);
        setRoster(result.roster);
      }
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  function resetToAuto() {
    setChart(EMPTY_CHART);
  }

  return (
    <div>
      <h1>Depth Chart</h1>
      <p className="text-muted" style={{ marginTop: -8 }}>
        Assign starters to each position — any player can fill any slot, so you can run small-ball lineups.
        Any slot left on Auto, and any leftover rotation spots, fill with your best available players by
        overall rating — the same way every AI team's lineup already works.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Starters</h2>
        {POSITIONS.map(({ key, label }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <label style={{ width: 140 }}>{label}</label>
            <select value={chart[key] ?? ""} onChange={(e) => setStarter(key, e.target.value)}>
              <option value="">Auto (best available)</option>
              {roster.map((p) => (
                <option key={p.playerId} value={p.playerId} disabled={p.isInjured || p.isSuspended}>
                  {p.name} — {p.position} — OVR {p.overall}
                  {statusSuffix(p)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Bench Rotation</h2>
        {chart.bench.length === 0 && (
          <p className="text-muted">No bench order set — remaining minutes go to your best available players automatically.</p>
        )}
        {chart.bench.map((id, i) => {
          const p = playerById(id);
          if (!p) return null;
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ width: 20 }}>{i + 1}.</span>
              <span style={{ flex: 1 }}>
                {p.name} — {p.position} — OVR {p.overall}
                {statusSuffix(p)}
              </span>
              <button className="secondary" onClick={() => moveBench(i, -1)} disabled={i === 0}>↑</button>
              <button className="secondary" onClick={() => moveBench(i, 1)} disabled={i === chart.bench.length - 1}>↓</button>
              <button className="secondary" onClick={() => removeFromBench(id)}>Remove</button>
            </div>
          );
        })}
        {unassigned.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <label>Add to bench: </label>
            <select value="" onChange={(e) => addToBench(e.target.value)}>
              <option value="">Select a player…</option>
              {unassigned.map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {p.name} — {p.position} — OVR {p.overall}
                  {statusSuffix(p)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Depth Chart"}</button>
        <button className="secondary" onClick={resetToAuto}>Reset to Auto</button>
        {savedAt && !saving && <span className="text-muted">Saved.</span>}
      </div>
    </div>
  );
}
