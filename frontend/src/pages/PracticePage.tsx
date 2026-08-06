import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import PlayerLink from "../components/PlayerLink";

type PracticeFocus = "BALANCED" | "SHOOTING" | "FINISHING" | "PLAYMAKING" | "REBOUNDING" | "DEFENSE" | "ATHLETICISM" | "IQ";

const FOCUS_META: { key: PracticeFocus; label: string; description: string; fields: string[] }[] = [
  { key: "BALANCED", label: "Balanced", description: "A small amount of growth spread across every skill, no tradeoff.", fields: [] },
  { key: "SHOOTING", label: "Shooting", description: "Scoring and three-point shooting grow faster — everything else grows slower.", fields: ["scoring", "threePoint"] },
  { key: "FINISHING", label: "Finishing", description: "Finishing at the rim grows faster — everything else grows slower.", fields: ["finishing"] },
  { key: "PLAYMAKING", label: "Playmaking", description: "Passing and ball-handling grow faster — everything else grows slower.", fields: ["playmaking"] },
  { key: "REBOUNDING", label: "Rebounding", description: "Rebounding grows faster — everything else grows slower.", fields: ["rebounding"] },
  { key: "DEFENSE", label: "Defense", description: "Defense grows faster — everything else grows slower.", fields: ["defense"] },
  { key: "ATHLETICISM", label: "Athleticism", description: "Athleticism and stamina grow faster — everything else grows slower.", fields: ["athleticism", "stamina"] },
  { key: "IQ", label: "Basketball IQ", description: "Basketball IQ grows faster — everything else grows slower.", fields: ["basketballIq"] },
];

interface RosterEntry {
  playerId: string;
  name: string;
  position: string;
  classYear: string;
  potential: number;
  isInjured: boolean;
  scoring: number; threePoint: number; finishing: number; playmaking: number;
  rebounding: number; defense: number; athleticism: number; basketballIq: number; stamina: number;
}

const COLUMNS: { key: keyof RosterEntry; label: string }[] = [
  { key: "scoring", label: "SCR" },
  { key: "threePoint", label: "3PT" },
  { key: "finishing", label: "FIN" },
  { key: "playmaking", label: "PLY" },
  { key: "rebounding", label: "REB" },
  { key: "defense", label: "DEF" },
  { key: "athleticism", label: "ATH" },
  { key: "basketballIq", label: "IQ" },
  { key: "stamina", label: "STA" },
];

export default function PracticePage() {
  const { activeSaveId } = useSave();
  const [focus, setFocus] = useState<PracticeFocus>("BALANCED");
  const [developmentSkill, setDevelopmentSkill] = useState<number>(50);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeSaveId) return;
    api.getPracticeFocus(activeSaveId).then((d) => {
      if (d) {
        setFocus(d.focus);
        setDevelopmentSkill(d.developmentSkill);
        setRoster(d.roster);
      }
    });
  }, [activeSaveId]);

  async function selectFocus(next: PracticeFocus) {
    if (!activeSaveId || next === focus) return;
    setSaving(true);
    try {
      const result = await api.setPracticeFocus(activeSaveId, next);
      if (result) {
        setFocus(result.focus);
        setDevelopmentSkill(result.developmentSkill);
        setRoster(result.roster);
      }
    } finally {
      setSaving(false);
    }
  }

  const activeFields = new Set(FOCUS_META.find((f) => f.key === focus)?.fields ?? []);

  return (
    <div>
      <h1>Practice &amp; Player Development</h1>
      <p className="text-muted" style={{ marginTop: -8 }}>
        Set your team's weekly practice emphasis. Every Monday during the preseason and regular season, your
        roster develops a little based on this focus — skills in your chosen emphasis grow noticeably faster,
        pulled toward each player's potential, at the cost of everything else growing slower. Your coach's
        Development rating ({developmentSkill}/100) scales how fast all of it happens.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {FOCUS_META.map((f) => (
            <button key={f.key} className={focus === f.key ? "" : "secondary"} disabled={saving} onClick={() => selectFocus(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-muted" style={{ margin: 0 }}>{FOCUS_META.find((f) => f.key === focus)?.description}</p>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Player</th><th>Pos</th><th>Yr</th>
              {COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
              <th>Potential</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => (
              <tr key={p.playerId}>
                <td>
                  <PlayerLink playerId={p.playerId} name={p.name} />
                  {p.isInjured && <span className="text-bad"> (Injured)</span>}
                </td>
                <td className="text-muted">{p.position}</td>
                <td className="text-muted">{p.classYear}</td>
                {COLUMNS.map((c) => (
                  <td key={c.key} style={activeFields.has(c.key) ? { fontWeight: 700 } : undefined}>
                    {p[c.key]}
                  </td>
                ))}
                <td className="text-muted">{p.potential}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {roster.length === 0 && <p className="text-muted">No roster loaded.</p>}
      </div>
    </div>
  );
}
