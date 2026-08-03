import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useSave } from "../SaveContext";

const SKILL_LABELS: Record<string, string> = {
  offenseSkill: "Offense", defenseSkill: "Defense", recruitingSkill: "Recruiting",
  developmentSkill: "Development", reputation: "Reputation",
};

function formatDeltas(deltas: Record<string, number>): string {
  return Object.entries(deltas)
    .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${SKILL_LABELS[k] ?? k}`)
    .join(" · ");
}

export default function SaveSelectPage() {
  const navigate = useNavigate();
  const { setActiveSaveId } = useSave();

  const [saves, setSaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [division, setDivision] = useState("D1");
  const [teams, setTeams] = useState<any[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [name, setName] = useState("");
  const [teamSchoolName, setTeamSchoolName] = useState("");
  const [coachName, setCoachName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [archetypes, setArchetypes] = useState<any[]>([]);
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [coachArchetype, setCoachArchetype] = useState("");
  const [coachBackground, setCoachBackground] = useState("");

  useEffect(() => {
    api.listSaves().then((s) => {
      setSaves(s);
      setLoading(false);
    });
    api.getCoachOptions().then((opts: any) => {
      setArchetypes(opts.archetypes);
      setBackgrounds(opts.backgrounds);
      setCoachArchetype(opts.archetypes[0]?.key ?? "");
      setCoachBackground(opts.backgrounds[0]?.key ?? "");
    });
  }, []);

  useEffect(() => {
    setTeamsLoading(true);
    setTeamSchoolName("");
    api.listLeagueTeams(division).then((t) => {
      setTeams([...t].sort((a, b) => a.school.localeCompare(b.school)));
      setTeamsLoading(false);
    });
  }, [division]);

  async function handleCreate() {
    if (!name || !teamSchoolName || !coachName) {
      setError("Fill in a save name, coach name, and pick a team.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const save = await api.createSave({ name, division, teamSchoolName, coachName, coachArchetype, coachBackground });
      setActiveSaveId(save.id);
      navigate("/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  function openSave(id: string) {
    setActiveSaveId(id);
    navigate("/dashboard");
  }

  async function removeSave(id: string) {
    await api.deleteSave(id);
    setSaves((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      <h1>Save Games</h1>

      <div className="card">
        <h3>Continue a Career</h3>
        {loading && <p>Loading...</p>}
        {!loading && saves.length === 0 && <p>No saves yet. Start a new career below.</p>}
        {saves.map((s) => (
          <div key={s.id} className="divider-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{s.name}</strong> — Season {s.currentSeasonYear} · {s.currentPhase}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => openSave(s.id)}>Continue</button>
              <button className="secondary" onClick={() => removeSave(s.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Start a New Career</h3>
        <p>
          <label>Save name</label><br />
          <input placeholder="e.g. Gonzaga Rebuild" value={name} onChange={(e) => setName(e.target.value)} />
        </p>
        <p>
          <label>Your coach name</label><br />
          <input placeholder="Coach name" value={coachName} onChange={(e) => setCoachName(e.target.value)} />
        </p>
        <p>
          <label>Division</label><br />
          <select value={division} onChange={(e) => setDivision(e.target.value)}>
            <option value="D1">NCAA Division I</option>
            <option value="D2">NCAA Division II</option>
            <option value="D3">NCAA Division III</option>
          </select>
        </p>
        <p>
          <label>Team ({teamsLoading ? "loading..." : `${teams.length} available`})</label><br />
          <select value={teamSchoolName} onChange={(e) => setTeamSchoolName(e.target.value)} disabled={teamsLoading}>
            <option value="">Select a team...</option>
            {teams.map((t) => (
              <option key={t.school} value={t.school}>
                {t.school} ({t.conference}) — prestige {t.prestige}
              </option>
            ))}
          </select>
        </p>
        <p>
          <label>Coaching philosophy</label>
        </p>
        <div className="option-grid">
          {archetypes.map((a) => (
            <div
              key={a.key}
              className={`option-card${coachArchetype === a.key ? " selected" : ""}`}
              onClick={() => setCoachArchetype(a.key)}
            >
              <div className="option-title">{a.label}</div>
              <div className="option-desc">{a.description}</div>
              <div className="option-deltas">{formatDeltas(a.deltas)}</div>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 16 }}>
          <label>Your past</label>
        </p>
        <div className="option-grid">
          {backgrounds.map((b) => (
            <div
              key={b.key}
              className={`option-card${coachBackground === b.key ? " selected" : ""}`}
              onClick={() => setCoachBackground(b.key)}
            >
              <div className="option-title">{b.label}</div>
              <div className="option-desc">{b.description}</div>
              <div className="option-deltas">{formatDeltas(b.deltas)}</div>
              <div className="option-perk">{b.perkLabel}: {b.perkDescription}</div>
            </div>
          ))}
        </div>

        {error && <p className="text-bad" style={{ marginTop: 12 }}>{error}</p>}
        <button style={{ marginTop: 16 }} onClick={handleCreate} disabled={creating}>
          {creating ? "Building league..." : "Start Career"}
        </button>
      </div>
    </div>
  );
}
