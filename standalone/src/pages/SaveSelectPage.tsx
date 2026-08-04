import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useSave } from "../SaveContext";
import { STATES } from "../engine/regions";
import { toStateAbbr } from "../state/stateAbbr";

const SKILL_LABELS: Record<string, string> = {
  offenseSkill: "Offense", defenseSkill: "Defense", recruitingSkill: "Recruiting",
  developmentSkill: "Development", reputation: "Reputation",
};

function formatDeltas(deltas: Record<string, number>): string {
  return Object.entries(deltas)
    .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${SKILL_LABELS[k] ?? k}`)
    .join(" · ");
}

const NO_PLAYING_CAREER = {
  hometownState: null as string | null,
  playedCollege: false,
  collegeTeamName: null as string | null,
  collegeState: null as string | null,
  proPath: "NONE" as const,
  proCountry: null as string | null,
};

export default function SaveSelectPage() {
  const navigate = useNavigate();
  const { setActiveSaveId } = useSave();

  const [saves, setSaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"TEAM" | "COACH">("TEAM");

  const [division, setDivision] = useState("D1");
  const [teams, setTeams] = useState<any[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [stateFilter, setStateFilter] = useState("");
  const [name, setName] = useState("");
  const [teamSchoolName, setTeamSchoolName] = useState("");
  const [coachName, setCoachName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [archetypes, setArchetypes] = useState<any[]>([]);
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [coachArchetype, setCoachArchetype] = useState("");
  const [coachBackground, setCoachBackground] = useState("");

  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [hometownState, setHometownState] = useState("");
  const [playedCollege, setPlayedCollege] = useState(false);
  const [collegeTeamName, setCollegeTeamName] = useState("");
  const [proPath, setProPath] = useState<"NONE" | "DOMESTIC_PRO" | "OVERSEAS_PRO">("NONE");
  const [proCountry, setProCountry] = useState("");

  const [offers, setOffers] = useState<any[] | null>(null);
  const [offersReputation, setOffersReputation] = useState<number | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersFilter, setOffersFilter] = useState("");

  const DIVISION_LABELS: Record<string, string> = {
    D3: "NCAA Division III", D2: "NCAA Division II", D1: "NCAA Division I",
  };

  useEffect(() => {
    api.listSaves().then((s) => {
      setSaves(s);
      setLoading(false);
    });
    api.getCoachOptions().then((opts: any) => {
      setArchetypes(opts.archetypes);
      setBackgrounds(opts.backgrounds);
      setCountries(opts.countries ?? []);
      setCoachArchetype(opts.archetypes[0]?.key ?? "");
      setCoachBackground(opts.backgrounds[0]?.key ?? "");
      setProCountry(opts.countries?.[0] ?? "");
    });
    api.getAllTeams().then((t: any[]) => setAllTeams([...t].sort((a, b) => a.school.localeCompare(b.school))));
  }, []);

  useEffect(() => {
    setTeamsLoading(true);
    setTeamSchoolName("");
    setStateFilter("");
    api.listLeagueTeams(division).then((t) => {
      setTeams([...t].sort((a, b) => a.school.localeCompare(b.school)));
      setTeamsLoading(false);
    });
  }, [division]);

  const availableStates = [...new Set(teams.map((t) => t.state))].sort();
  const filteredTeams = stateFilter ? teams.filter((t) => t.state === stateFilter) : teams;
  const teamsByState = new Map<string, any[]>();
  for (const t of filteredTeams) {
    if (!teamsByState.has(t.state)) teamsByState.set(t.state, []);
    teamsByState.get(t.state)!.push(t);
  }
  const statesToRender = [...teamsByState.keys()].sort();

  function playingCareerChoice() {
    const hometown = hometownState || null;
    if (!playedCollege) return { ...NO_PLAYING_CAREER, hometownState: hometown };
    const college = allTeams.find((t) => t.school === collegeTeamName);
    return {
      hometownState: hometown,
      playedCollege: true,
      collegeTeamName: collegeTeamName || null,
      collegeState: college?.state ? toStateAbbr(college.state) : null,
      proPath,
      proCountry: proPath === "OVERSEAS_PRO" ? proCountry || null : null,
    };
  }

  async function handleCreateTeamMode() {
    if (!name || !teamSchoolName || !coachName) {
      setError("Fill in a save name, coach name, and pick a team.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const save = await api.createSave({ name, division, teamSchoolName, coachName, coachArchetype, coachBackground: null });
      setActiveSaveId(save.id);
      navigate("/edit-schedule");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleGetOffers() {
    if (!name || !coachName) {
      setError("Fill in a save name and your coach name first.");
      return;
    }
    if (playedCollege && !collegeTeamName) {
      setError("Pick your alma mater, or turn off \"Played college basketball.\"");
      return;
    }
    if (proPath === "OVERSEAS_PRO" && !proCountry) {
      setError("Pick which country you played professionally in.");
      return;
    }
    setError(null);
    setOffersLoading(true);
    try {
      const result = await api.generateCoachOffers({ coachArchetype, coachBackground, playingCareer: playingCareerChoice() });
      setOffers(result.offers);
      setOffersReputation(result.reputation);
      if (result.offers.length === 0) setError("No programs bit this time — try again, or adjust your profile.");
    } finally {
      setOffersLoading(false);
    }
  }

  async function acceptOffer(offer: any) {
    setError(null);
    setCreating(true);
    try {
      const save = await api.createSave({
        name, division: offer.division, teamSchoolName: offer.school, coachName,
        coachArchetype, coachBackground, playingCareer: playingCareerChoice(),
      });
      setActiveSaveId(save.id);
      navigate("/edit-schedule");
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

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className={mode === "TEAM" ? "" : "secondary"} onClick={() => setMode("TEAM")}>
            Pick Your Team
          </button>
          <button className={mode === "COACH" ? "" : "secondary"} onClick={() => setMode("COACH")}>
            Create a Coach
          </button>
        </div>
        <p className="text-muted" style={{ marginTop: -8, marginBottom: 16 }}>
          {mode === "TEAM"
            ? "Jump straight into any program you want to coach."
            : "Build a coach — your archetype, your past, and your playing career decide which jobs you're actually offered."}
        </p>

        <p>
          <label>Save name</label><br />
          <input placeholder="e.g. Gonzaga Rebuild" value={name} onChange={(e) => setName(e.target.value)} />
        </p>
        <p>
          <label>Your coach name</label><br />
          <input placeholder="Coach name" value={coachName} onChange={(e) => setCoachName(e.target.value)} />
        </p>

        {mode === "TEAM" && (
          <>
            <p>
              <label>Division</label><br />
              <select value={division} onChange={(e) => setDivision(e.target.value)}>
                <option value="D1">NCAA Division I</option>
                <option value="D2">NCAA Division II</option>
                <option value="D3">NCAA Division III</option>
              </select>
            </p>
            <p>
              <label>State ({teamsLoading ? "loading..." : `${availableStates.length} with programs`})</label><br />
              <select
                value={stateFilter}
                onChange={(e) => { setStateFilter(e.target.value); setTeamSchoolName(""); }}
                disabled={teamsLoading}
              >
                <option value="">All states</option>
                {availableStates.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </p>
            <p>
              <label>Team ({teamsLoading ? "loading..." : `${filteredTeams.length} available`})</label><br />
              <select value={teamSchoolName} onChange={(e) => setTeamSchoolName(e.target.value)} disabled={teamsLoading}>
                <option value="">Select a team...</option>
                {statesToRender.map((state) => (
                  <optgroup key={state} label={state}>
                    {teamsByState.get(state)!.map((t) => (
                      <option key={t.school} value={t.school}>
                        {t.school} ({t.conference}) — prestige {t.prestige}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </p>
          </>
        )}

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

        {mode === "COACH" && (
          <>
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

            <p style={{ marginTop: 16 }}>
              <label>Playing career</label>
            </p>
            <div className="card" style={{ background: "transparent" }}>
              <p>
                <label>Hometown state</label><br />
                <select value={hometownState} onChange={(e) => setHometownState(e.target.value)}>
                  <option value="">Not specified</option>
                  {STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </p>
              <p className="text-muted" style={{ fontSize: "0.8rem", marginTop: -8 }}>
                Seeds a recruiting pipeline in your home state that travels with you between jobs.
              </p>

              <label style={{ marginTop: 12, display: "block" }}>
                <input
                  type="checkbox"
                  checked={playedCollege}
                  onChange={(e) => { setPlayedCollege(e.target.checked); if (!e.target.checked) { setCollegeTeamName(""); setProPath("NONE"); } }}
                  style={{ marginRight: 8 }}
                />
                Played college basketball
              </label>

              {playedCollege && (
                <>
                  <p style={{ marginTop: 12 }}>
                    <label>Alma mater ({allTeams.length ? `${allTeams.length} schools` : "loading..."})</label><br />
                    <select value={collegeTeamName} onChange={(e) => setCollegeTeamName(e.target.value)}>
                      <option value="">Select a school...</option>
                      {allTeams.map((t) => (
                        <option key={`${t.division}-${t.school}`} value={t.school}>
                          {t.school} ({t.division} · {t.conference})
                        </option>
                      ))}
                    </select>
                  </p>

                  <p style={{ marginTop: 12 }}>
                    <label>Played professionally after college?</label><br />
                    <select value={proPath} onChange={(e) => setProPath(e.target.value as any)}>
                      <option value="NONE">No</option>
                      <option value="DOMESTIC_PRO">Yes, domestically (NBA/G-League/etc.)</option>
                      <option value="OVERSEAS_PRO">Yes, overseas</option>
                    </select>
                  </p>

                  {proPath === "OVERSEAS_PRO" && (
                    <p style={{ marginTop: 12 }}>
                      <label>Which country?</label><br />
                      <select value={proCountry} onChange={(e) => setProCountry(e.target.value)}>
                        {countries.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {error && <p className="text-bad" style={{ marginTop: 12 }}>{error}</p>}

        {mode === "TEAM" && (
          <button style={{ marginTop: 16 }} onClick={handleCreateTeamMode} disabled={creating}>
            {creating ? "Building league..." : "Start Career"}
          </button>
        )}

        {mode === "COACH" && (
          <>
            <button style={{ marginTop: 16 }} onClick={handleGetOffers} disabled={offersLoading || creating}>
              {offersLoading ? "Checking with programs..." : offers ? "Get New Offers" : "Get Job Offers"}
            </button>

            {offers && offers.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p className="text-muted">
                  Estimated starting reputation: {offersReputation}/100 — {offers.length} program{offers.length === 1 ? "" : "s"} calling.
                  Most first-time coaches build up from D3; a real D1 shot takes an elite profile.
                </p>
                <p>
                  <input
                    placeholder="Filter by school or conference..."
                    value={offersFilter}
                    onChange={(e) => setOffersFilter(e.target.value)}
                  />
                </p>
                <div>
                  {(["D3", "D2", "D1"] as const).map((div) => {
                    const group = offers.filter((o) =>
                      o.division === div &&
                      (!offersFilter || o.school.toLowerCase().includes(offersFilter.toLowerCase()) || o.conference.toLowerCase().includes(offersFilter.toLowerCase()))
                    );
                    if (group.length === 0) return null;
                    return (
                      <div key={div}>
                        <div className="divider-row" style={{ marginTop: 8 }}>
                          <strong>{DIVISION_LABELS[div]}</strong> <span className="text-muted">({group.length})</span>
                        </div>
                        <div className="option-grid">
                          {group.map((o) => (
                            <div key={`${o.division}-${o.school}`} className="option-card" onClick={() => !creating && acceptOffer(o)}>
                              <div className="option-title">{o.school}</div>
                              <div className="option-desc">{o.division} · {o.conference} · prestige {o.prestige}</div>
                              <div className="option-perk">{creating ? "Starting career..." : "Accept & Start Career"}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
