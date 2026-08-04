import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import TeamLink from "../components/TeamLink";

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n / 1000)}K`;
}

function formatKey(k?: string | null): string {
  if (!k) return "";
  return k.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

const ARCHETYPE_LABELS: Record<string, string> = {
  OFFENSIVE_INNOVATOR: "Offensive Innovator",
  DEFENSIVE_ANCHOR: "Defensive Anchor",
  RECRUITER: "The Closer",
  PLAYER_DEVELOPER: "Player Developer",
  PROGRAM_BUILDER: "Program Builder",
  DISCIPLINARIAN: "Disciplinarian",
};

const BACKGROUND_LABELS: Record<string, string> = {
  HIGH_SCHOOL_COACH: "Former High School Coach",
  BLUE_BLOOD_ASSISTANT: "Longtime Blue-Blood Assistant",
  FORMER_PRO_PLAYER: "Former Pro Player",
  JUCO_COACH: "Former JuCo Coach",
  ANALYTICS_COORDINATOR: "Analytics & Video Coordinator",
  INTERNATIONAL_SCOUT: "International Scouting Background",
};

function adStyleLine(ad: any): string {
  if (!ad) return "";
  const traits: (string | null)[] = [
    ad.winFocus >= 65 ? "win-focused" : ad.winFocus <= 35 ? "patient with results" : null,
    ad.patience >= 65 ? "high patience" : ad.patience <= 35 ? "quick trigger" : null,
    ad.integrityStandard >= 65 ? "strict on conduct" : null,
    ad.loyalty >= 65 ? "loyal" : null,
  ];
  return traits.filter(Boolean).join(", ");
}

function colLabel(index: number): string {
  if (index >= 130) return "Much pricier";
  if (index >= 112) return "Pricier";
  if (index >= 95) return "About average";
  if (index >= 85) return "Cheaper";
  return "Much cheaper";
}

function atmosphereLabel(atmosphere: number): string {
  if (atmosphere >= 90) return "Legendary";
  if (atmosphere >= 75) return "Electric";
  if (atmosphere >= 60) return "Buzzing";
  if (atmosphere >= 40) return "Building";
  if (atmosphere >= 25) return "Quiet";
  return "Dead";
}

function offerLine(o: any): string {
  const parts: string[] = [];
  if (o.salaryDeltaPct !== null && o.salaryDeltaPct !== undefined) {
    parts.push(o.salaryDeltaPct >= 0 ? `pays ${o.salaryDeltaPct}% more` : `pays ${Math.abs(o.salaryDeltaPct)}% less`);
  }
  if (o.colDeltaPct !== null && o.colDeltaPct !== undefined) {
    parts.push(o.colDeltaPct >= 0 ? `cost of living ${o.colDeltaPct}% higher` : `cost of living ${Math.abs(o.colDeltaPct)}% lower`);
  }
  return parts.join(", ");
}

function playingCareerLine(coach: any): string | null {
  const parts: string[] = [];
  if (coach.hometownState) parts.push(`From ${coach.hometownState}`);
  if (coach.playedCollege) {
    let line = `Played at ${coach.collegeTeamName ?? "college"}`;
    if (coach.proPath === "DOMESTIC_PRO") line += " · played pro";
    else if (coach.proPath === "OVERSEAS_PRO") line += ` · played pro in ${coach.proCountry ?? "overseas"}`;
    parts.push(line);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function skillLabel(v: number): string {
  if (v >= 85) return "Elite";
  if (v >= 70) return "Strong";
  if (v >= 50) return "Average";
  if (v >= 35) return "Below Average";
  return "Weak";
}

export default function ContractPage() {
  const { activeSaveId } = useSave();
  const [dash, setDash] = useState<any>(null);
  const [jobOffers, setJobOffers] = useState<any[]>([]);
  const [raiseResult, setRaiseResult] = useState<any>(null);
  const [askingRaise, setAskingRaise] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [arenaResult, setArenaResult] = useState<any>(null);
  const [upgradingArena, setUpgradingArena] = useState(false);
  const [coachStats, setCoachStats] = useState<any>(null);
  const [selectedAd, setSelectedAd] = useState<any>(null);

  async function refresh() {
    if (!activeSaveId) return;
    const d = await api.getDashboard(activeSaveId);
    setDash(d);
    setMarketOpen(false);
    setCoachStats(await api.getCoachStats(activeSaveId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSaveId]);

  async function handleRequestRaise() {
    if (!activeSaveId) return;
    setAskingRaise(true);
    try {
      const result = await api.requestRaise(activeSaveId);
      setRaiseResult(result);
      await refresh();
    } finally {
      setAskingRaise(false);
    }
  }

  async function handleUpgradeArena() {
    if (!activeSaveId) return;
    setUpgradingArena(true);
    try {
      const result = await api.upgradeArena(activeSaveId);
      setArenaResult(result);
      await refresh();
    } catch (err: any) {
      setArenaResult({ granted: false, error: err.message });
    } finally {
      setUpgradingArena(false);
    }
  }

  async function testWaters() {
    if (!activeSaveId) return;
    if (marketOpen) {
      setMarketOpen(false);
      return;
    }
    setMarketLoading(true);
    try {
      const offers = await api.getJobOffers(activeSaveId);
      setJobOffers(offers);
      setMarketOpen(true);
    } finally {
      setMarketLoading(false);
    }
  }

  async function resignAndAccept(teamId: string) {
    if (!activeSaveId) return;
    await api.resignAndAccept(activeSaveId, teamId);
    setMarketOpen(false);
    await refresh();
  }

  if (!dash) return <div className="card">Loading...</div>;
  if (!dash.team) return <div className="card">You're currently unemployed — head to the Dashboard to check for job offers.</div>;

  const { team } = dash;
  const coach = team.headCoach;

  return (
    <div>
      <h1>Contract</h1>

      <div className="card">
        <h3>{coach.name}</h3>
        <p className="text-muted">
          {ARCHETYPE_LABELS[coach.archetype] ?? formatKey(coach.archetype)}
          {coach.background ? ` · ${BACKGROUND_LABELS[coach.background] ?? formatKey(coach.background)}` : ""}
        </p>
        {playingCareerLine(coach) && <p className="text-muted" style={{ marginTop: -8 }}>{playingCareerLine(coach)}</p>}
        <div className="stat-row" style={{ marginTop: 12 }}>
          <div className="stat-tile">
            <div className="stat-label">Career Record</div>
            <div className="stat-value">{coach.careerWins}-{coach.careerLosses}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Reputation</div>
            <div className="stat-value">{coach.reputation}/100</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Years Here</div>
            <div className="stat-value">{coach.yearsAtCurrentJob}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Hot Seat</div>
            <div className={`stat-value ${coach.hotSeatLevel > 60 ? "text-bad" : ""}`}>{coach.hotSeatLevel}/100</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Legality</div>
            <div className={`stat-value ${coach.legalityReputation < 40 ? "text-bad" : coach.legalityReputation > 80 ? "text-good" : ""}`}>
              {coach.legalityReputation}/100
            </div>
          </div>
        </div>
        <h4 style={{ marginTop: 16, marginBottom: 4 }}>Coaching Skills</h4>
        <div className="stat-row">
          <div className="stat-tile">
            <div className="stat-label">Offense</div>
            <div className="stat-value">{coach.offenseSkill}</div>
            <div className="text-muted">{skillLabel(coach.offenseSkill)}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Defense</div>
            <div className="stat-value">{coach.defenseSkill}</div>
            <div className="text-muted">{skillLabel(coach.defenseSkill)}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Recruiting</div>
            <div className="stat-value">{coach.recruitingSkill}</div>
            <div className="text-muted">{skillLabel(coach.recruitingSkill)}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Development</div>
            <div className="stat-value">{coach.developmentSkill}</div>
            <div className="text-muted">{skillLabel(coach.developmentSkill)}</div>
          </div>
        </div>
      </div>

      {coachStats && (
        <div className="card" style={{ overflowX: "auto" }}>
          <h3>Coaching History</h3>
          <div className="stat-row">
            <div className="stat-tile">
              <div className="stat-label">Career Total</div>
              <div className="stat-value">{coachStats.total.wins}-{coachStats.total.losses}</div>
            </div>
          </div>

          {coachStats.byTeam.length > 0 && (
            <>
              <h4 style={{ marginTop: 16, marginBottom: 4 }}>By Team</h4>
              <table>
                <thead>
                  <tr><th>Team</th><th>Seasons</th><th>Record</th></tr>
                </thead>
                <tbody>
                  {coachStats.byTeam.map((t: any) => (
                    <tr key={t.teamId}>
                      <td><TeamLink teamId={t.teamId} name={t.teamName} /></td>
                      <td className="text-muted">{t.seasons}</td>
                      <td className="text-muted">{t.wins}-{t.losses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {coachStats.bySeason.length > 0 && (
            <>
              <h4 style={{ marginTop: 16, marginBottom: 4 }}>By Season</h4>
              <table>
                <thead>
                  <tr><th>Season</th><th>Team</th><th>Record</th><th>Conference</th><th>Postseason</th></tr>
                </thead>
                <tbody>
                  {[...coachStats.bySeason].reverse().map((s: any) => (
                    <tr key={`${s.teamId}-${s.seasonYear}`}>
                      <td>{s.seasonYear}</td>
                      <td><TeamLink teamId={s.teamId} name={s.teamName} /></td>
                      <td className="text-muted">{s.wins}-{s.losses}</td>
                      <td className="text-muted">{s.confWins}-{s.confLosses}</td>
                      <td className="text-muted">{s.madePostseason ? `Made it, ${s.postseasonWins} win${s.postseasonWins === 1 ? "" : "s"}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {coachStats.bySeason.length === 0 && (
            <p className="text-muted" style={{ marginTop: 12 }}>No completed seasons on record yet — this fills in after your first offseason.</p>
          )}
        </div>
      )}

      <div className="card">
        <h3>How You're Viewed</h3>
        <div className="stat-row">
          <div className="stat-tile">
            <div className="stat-label">Team</div>
            <div className={`stat-value ${coach.teamPerception < 40 ? "text-bad" : coach.teamPerception > 75 ? "text-good" : ""}`}>
              {coach.teamPerception}/100
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Athletic Director</div>
            <div className={`stat-value ${team.adPerception != null && team.adPerception < 40 ? "text-bad" : team.adPerception != null && team.adPerception > 75 ? "text-good" : ""}`}>
              {team.adPerception != null ? `${team.adPerception}/100` : "—"}
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">National</div>
            <div className={`stat-value ${coach.nationalPerception > 75 ? "text-good" : ""}`}>{coach.nationalPerception}/100</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Local</div>
            <div className={`stat-value ${coach.localPerception < 40 ? "text-bad" : coach.localPerception > 75 ? "text-good" : ""}`}>
              {coach.localPerception}/100
            </div>
          </div>
        </div>
        {team.athleticDirector && (
          <p className="text-muted" style={{ marginTop: 12 }}>
            Athletic Director:{" "}
            <button className="player-name-link" onClick={() => setSelectedAd(team.athleticDirector)}>
              {team.athleticDirector.name}
            </button>
            {adStyleLine(team.athleticDirector) ? ` (${adStyleLine(team.athleticDirector)})` : ""}
          </p>
        )}
      </div>

      <div className="card">
        <h3>Salary & Arena</h3>
        <p>
          Current salary: <strong>{fmtMoney(coach.currentSalary)}/yr</strong>
          {" "}· {team.state} — {colLabel(team.costOfLivingIndex)} cost of living
        </p>
        <button onClick={handleRequestRaise} disabled={askingRaise || coach.raiseRequestedThisSeason}>
          {coach.raiseRequestedThisSeason ? "Already asked this season" : askingRaise ? "Asking..." : "Ask for a Raise"}
        </button>
        {raiseResult && (
          <p className={raiseResult.granted ? "text-good" : "text-bad"} style={{ marginTop: 8 }}>
            {raiseResult.granted
              ? `Raise granted! New salary: ${fmtMoney(raiseResult.newSalary)}/yr`
              : "The AD turned you down. Maybe it's time to test the waters elsewhere."}
          </p>
        )}

        <p style={{ marginTop: 16 }}>
          Arena capacity: <strong>{team.venueCapacity.toLocaleString()}</strong>
          {team.avgTurnoutPct != null
            ? <span className="text-muted"> · averaging {team.avgTurnoutPct}% full this season ({team.homeGamesPlayedThisSeason} home games)</span>
            : <span className="text-muted"> · not enough home games played yet this season to gauge demand</span>}
        </p>
        <p className="text-muted" style={{ marginTop: -8 }}>
          Campus atmosphere: <strong className={coach.campusAtmosphere >= 60 ? "text-good" : coach.campusAtmosphere < 25 ? "text-bad" : ""}>
            {atmosphereLabel(coach.campusAtmosphere)}
          </strong> ({coach.campusAtmosphere}/100) — built through sustained success and tenure, especially at this level
        </p>
        <button onClick={handleUpgradeArena} disabled={upgradingArena || team.arenaUpgradeRequestedThisSeason}>
          {team.arenaUpgradeRequestedThisSeason ? "Already asked this season" : upgradingArena ? "Asking..." : "Ask AD to Expand Arena"}
        </button>
        {arenaResult && (
          <p className={arenaResult.granted ? "text-good" : "text-bad"} style={{ marginTop: 8 }}>
            {arenaResult.error
              ? arenaResult.error
              : arenaResult.granted
                ? `Approved! New capacity: ${arenaResult.newCapacity.toLocaleString()} (up from ${arenaResult.oldCapacity.toLocaleString()})`
                : "The AD isn't convinced it pays for itself right now — build a stronger case with wins and attendance."}
          </p>
        )}
      </div>

      <div className="card">
        <h3>Job Market</h3>
        <button onClick={testWaters} disabled={marketLoading}>
          {marketLoading ? "..." : marketOpen ? "Hide Market" : "Test the Waters"}
        </button>
        {marketOpen && (
          <div style={{ marginTop: 12 }}>
            {jobOffers.length === 0 && <p className="text-muted">No other programs are open to talking right now.</p>}
            {jobOffers.map((o) => (
              <div key={o.teamId} className="divider-row">
                <strong><TeamLink teamId={o.teamId} name={o.teamName} /></strong> ({o.division}) — prestige {o.prestige}
                {o.salary != null && <span className="text-muted"> · {fmtMoney(o.salary)}/yr</span>}
                {o.costOfLivingIndex != null && <span className="text-muted"> · {colLabel(o.costOfLivingIndex)} cost of living</span>}
                {offerLine(o) && <span className="text-muted"> ({offerLine(o)})</span>}
                {o.athleticDirector && (
                  <span className="text-muted">
                    {" "}· AD:{" "}
                    <button className="player-name-link" onClick={() => setSelectedAd(o.athleticDirector)}>
                      {o.athleticDirector.name}
                    </button>
                  </span>
                )}
                {o.adRemembersYou && <span className="text-good"> — remembers you well from a previous job together</span>}
                {o.targetedHire && <span className="text-good"> — they want you specifically for this job</span>}
                {o.localTies === "hometown" && <span className="text-muted"> — your hometown</span>}
                {o.localTies === "college" && <span className="text-muted"> — where you played college ball</span>}
                {" "}
                <button onClick={() => resignAndAccept(o.teamId)}>Leave for This Job</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedAd && (
        <div className="modal-backdrop" onClick={() => setSelectedAd(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedAd.name}</h2>
            <p className="text-muted">
              Athletic Director · {selectedAd.yearsAtCurrentJob} year{selectedAd.yearsAtCurrentJob === 1 ? "" : "s"} in the role
            </p>
            {adStyleLine(selectedAd) && <p className="text-muted" style={{ marginTop: -8 }}>{adStyleLine(selectedAd)}</p>}
            <div className="player-detail-grid">
              <div><div className="label">Patience</div><div className="value">{selectedAd.patience}/100</div></div>
              <div><div className="label">Win Focus</div><div className="value">{selectedAd.winFocus}/100</div></div>
              <div><div className="label">Integrity Standard</div><div className="value">{selectedAd.integrityStandard}/100</div></div>
              <div><div className="label">Loyalty</div><div className="value">{selectedAd.loyalty}/100</div></div>
            </div>
            <p className="text-muted" style={{ fontSize: "0.8rem", marginTop: 12 }}>
              Patience and win focus shape how forgiving they are of a rough season before your seat gets hot. Integrity
              standard sets how strict they are about off-court issues before they'll hire — or keep — a coach. Loyalty
              affects how much a personal relationship with you protects your job, for better or worse.
            </p>
            <button style={{ marginTop: 12 }} onClick={() => setSelectedAd(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
