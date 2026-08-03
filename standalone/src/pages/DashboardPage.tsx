import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useSave } from "../SaveContext";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

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
  MID_MAJOR_GRINDER: "Mid-Major Grinder",
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

export default function DashboardPage() {
  const { activeSaveId, setActiveSaveId } = useSave();
  const navigate = useNavigate();
  const [dash, setDash] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [jobOffers, setJobOffers] = useState<any[]>([]);
  const [advancing, setAdvancing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [raiseResult, setRaiseResult] = useState<any>(null);
  const [askingRaise, setAskingRaise] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);

  async function refresh() {
    if (!activeSaveId) return;
    const [d, ev] = await Promise.all([api.getDashboard(activeSaveId), api.getPendingEvents(activeSaveId)]);
    setDash(d);
    setEvents(ev);
    if (!d.team) {
      const offers = await api.getJobOffers(activeSaveId);
      setJobOffers(offers);
    } else {
      setJobOffers([]);
      setMarketOpen(false);
    }
  }

  useEffect(() => {
    if (!activeSaveId) {
      navigate("/");
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSaveId]);

  async function handleAdvance() {
    if (!activeSaveId) return;
    setAdvancing(true);
    try {
      const result = await api.advance(activeSaveId);
      setLastResult(result);
      setRaiseResult(null);
      await refresh();
    } finally {
      setAdvancing(false);
    }
  }

  async function resolveEvent(eventId: string, optionId: string) {
    if (!activeSaveId) return;
    await api.resolveEvent(activeSaveId, eventId, optionId);
    await refresh();
  }

  async function acceptJob(teamId: string) {
    if (!activeSaveId) return;
    await api.acceptJob(activeSaveId, teamId);
    await refresh();
  }

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

  function exitToSaves() {
    setActiveSaveId(null);
    navigate("/");
  }

  if (!dash) return <div className="card">Loading...</div>;

  if (!dash.team) {
    return (
      <div>
        <h1>You're Out of a Job</h1>
        <div className="card">
          <p>Your program let you go. Pick your next opportunity to keep your career going.</p>
          {jobOffers.length === 0 && (
            <p>
              No offers yet — advance to check again.
              {" "}Image-conscious programs pass on coaches with a rocky off-court reputation, so a low legality rating can mean fewer calls.
            </p>
          )}
          {jobOffers.map((o) => (
            <div key={o.teamId} className="divider-row">
              <strong>{o.teamName}</strong> ({o.division}) — prestige {o.prestige}
              {o.salary != null && <span className="text-muted"> · {fmtMoney(o.salary)}/yr</span>}
              {o.costOfLivingIndex != null && <span className="text-muted"> · {colLabel(o.costOfLivingIndex)} cost of living</span>}
              {o.athleticDirectorName && <span className="text-muted"> · AD: {o.athleticDirectorName}</span>}
              {o.adRemembersYou && <span className="text-good"> — remembers you well from a previous job together</span>}
              {" "}
              <button onClick={() => acceptJob(o.teamId)}>Accept</button>
            </div>
          ))}
          <p style={{ marginTop: 16 }}>
            <button onClick={handleAdvance} disabled={advancing}>{advancing ? "..." : "Check again"}</button>
          </p>
        </div>
        <button className="secondary" onClick={exitToSaves}>Back to Saves</button>
      </div>
    );
  }

  const { team, record, nextGame, save } = dash;

  return (
    <div>
      <h1>{team.name}</h1>
      <p className="text-muted">
        {team.conference.name} · {team.division} · {fmtDate(save.currentDate)} · {save.currentPhase.replace("_", " ")}
      </p>
      <p className="text-muted" style={{ marginTop: -8 }}>
        Coach: {ARCHETYPE_LABELS[team.headCoach.archetype] ?? formatKey(team.headCoach.archetype)}
        {team.headCoach.background ? ` · ${BACKGROUND_LABELS[team.headCoach.background] ?? formatKey(team.headCoach.background)}` : ""}
      </p>
      {playingCareerLine(team.headCoach) && (
        <p className="text-muted" style={{ marginTop: -8 }}>{playingCareerLine(team.headCoach)}</p>
      )}
      {team.athleticDirector && (
        <p className="text-muted" style={{ marginTop: -8 }}>
          Athletic Director: {team.athleticDirector.name}
          {adStyleLine(team.athleticDirector) ? ` (${adStyleLine(team.athleticDirector)})` : ""}
        </p>
      )}
      <p className="text-muted" style={{ marginTop: -8 }}>
        Arena capacity: {team.venueCapacity.toLocaleString()}
      </p>

      <div className="card stat-row">
        <div className="stat-tile">
          <div className="stat-label">Record</div>
          <div className="stat-value">{record.wins}-{record.losses}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Conference</div>
          <div className="stat-value">{record.confWins}-{record.confLosses}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Prestige</div>
          <div className="stat-value">{team.prestige}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">NIL Budget</div>
          <div className="stat-value">{fmtMoney(team.nilBudget)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Hot Seat</div>
          <div className={`stat-value ${team.headCoach.hotSeatLevel > 60 ? "text-bad" : ""}`}>
            {team.headCoach.hotSeatLevel}/100
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Legality</div>
          <div className={`stat-value ${team.headCoach.legalityReputation < 40 ? "text-bad" : team.headCoach.legalityReputation > 80 ? "text-good" : ""}`}>
            {team.headCoach.legalityReputation}/100
          </div>
        </div>
      </div>

      <div className="card">
        <h3>How You're Viewed</h3>
        <div className="stat-row">
        <div className="stat-tile">
          <div className="stat-label">Team</div>
          <div className={`stat-value ${team.headCoach.teamPerception < 40 ? "text-bad" : team.headCoach.teamPerception > 75 ? "text-good" : ""}`}>
            {team.headCoach.teamPerception}/100
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
          <div className={`stat-value ${team.headCoach.nationalPerception > 75 ? "text-good" : ""}`}>
            {team.headCoach.nationalPerception}/100
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Local</div>
          <div className={`stat-value ${team.headCoach.localPerception < 40 ? "text-bad" : team.headCoach.localPerception > 75 ? "text-good" : ""}`}>
            {team.headCoach.localPerception}/100
          </div>
        </div>
        </div>
      </div>

      <div className="card">
        <h3>Contract</h3>
        <p>
          Current salary: <strong>{fmtMoney(team.headCoach.currentSalary)}/yr</strong>
          {" "}· {team.state} — {colLabel(team.costOfLivingIndex)} cost of living
        </p>
        <button onClick={handleRequestRaise} disabled={askingRaise || team.headCoach.raiseRequestedThisSeason}>
          {team.headCoach.raiseRequestedThisSeason ? "Already asked this season" : askingRaise ? "Asking..." : "Ask for a Raise"}
        </button>
        {raiseResult && (
          <p className={raiseResult.granted ? "text-good" : "text-bad"} style={{ marginTop: 8 }}>
            {raiseResult.granted
              ? `Raise granted! New salary: ${fmtMoney(raiseResult.newSalary)}/yr`
              : "The AD turned you down. Maybe it's time to test the waters elsewhere."}
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
                <strong>{o.teamName}</strong> ({o.division}) — prestige {o.prestige}
                {o.salary != null && <span className="text-muted"> · {fmtMoney(o.salary)}/yr</span>}
                {o.costOfLivingIndex != null && <span className="text-muted"> · {colLabel(o.costOfLivingIndex)} cost of living</span>}
                {offerLine(o) && <span className="text-muted"> ({offerLine(o)})</span>}
                {o.athleticDirectorName && <span className="text-muted"> · AD: {o.athleticDirectorName}</span>}
                {o.adRemembersYou && <span className="text-good"> — remembers you well from a previous job together</span>}
                {" "}
                <button onClick={() => resignAndAccept(o.teamId)}>Leave for This Job</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {events.length > 0 && (
        <div className="card">
          <h3>Needs Your Attention</h3>
          {events.map((ev) => (
            <div key={ev.id} style={{ marginBottom: 12 }}>
              <strong>{ev.title}</strong>
              <p>{ev.description}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ev.options.map((opt: any) => (
                  <button key={opt.id} className="secondary" title={opt.description} onClick={() => resolveEvent(ev.id, opt.id)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Next Game</h3>
        {nextGame ? (
          <p>
            {fmtDate(nextGame.date)}: {nextGame.homeTeam.name} vs {nextGame.awayTeam.name}
            {nextGame.tournament ? ` (${nextGame.tournament.type.replace(/_/g, " ")})` : nextGame.isConference ? " (Conference)" : ""}
          </p>
        ) : (
          <p>No games scheduled right now.</p>
        )}
        <button onClick={handleAdvance} disabled={advancing}>
          {advancing ? "Simulating..." : "Advance"}
        </button>
        {lastResult && (
          <p className="text-muted" style={{ marginTop: 8 }}>
            {lastResult.gamesPlayedToday} game(s) played today · Phase: {lastResult.newPhase}
          </p>
        )}
      </div>

      <button className="secondary" onClick={exitToSaves}>Back to Saves</button>
    </div>
  );
}
