import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useSave } from "../SaveContext";
import TeamLink from "../components/TeamLink";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n / 1000)}K`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function fmtKenpom(k: any): string {
  if (!k) return "—";
  return `#${k.rank} (${signed(Math.round(k.adjEM * 10) / 10)})`;
}

function fmtRPI(r: any): string {
  if (!r) return "—";
  return `#${r.rank} (${r.rpi.toFixed(3)})`;
}

function fmtStat(n: number | null): string {
  return n === null ? "—" : n.toFixed(1);
}

function LineupTable({ team }: { team: any }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <strong>{team.name}</strong>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Player</th>
              <th>Yr</th>
              <th>PPG</th>
              <th>RPG</th>
              <th>APG</th>
            </tr>
          </thead>
          <tbody>
            {team.startingLineup.map((p: any) => (
              <tr key={p.playerId}>
                <td className="text-muted">{p.position}</td>
                <td>{p.name}</td>
                <td className="text-muted">{p.classYear}</td>
                <td>{fmtStat(p.ppg)}</td>
                <td>{fmtStat(p.rpg)}</td>
                <td>{fmtStat(p.apg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {team.startingLineup.length === 0 && <p className="text-muted">No available players.</p>}
      </div>
    </div>
  );
}

function InjuryReportLine({ team }: { team: any }) {
  return (
    <p style={{ marginBottom: 6 }}>
      <strong>{team.name}: </strong>
      {team.injuryReport.length === 0 ? (
        <span className="text-good">No reported injuries</span>
      ) : (
        team.injuryReport.map((r: any, i: number) => (
          <span key={r.playerId}>
            {i > 0 && ", "}
            {r.name} <span className="text-bad">({r.detail})</span>
          </span>
        ))
      )}
    </p>
  );
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

function rivalryLabel(intensity: number): string {
  if (intensity >= 80) return "Blood Feud";
  if (intensity >= 60) return "Heated";
  if (intensity >= 40) return "Rivalry";
  return "Budding Rivalry";
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
  const [rivalries, setRivalries] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [conferenceInvite, setConferenceInvite] = useState<any>(null);
  const [respondingToInvite, setRespondingToInvite] = useState(false);
  const [selectedAd, setSelectedAd] = useState<any>(null);

  async function refresh() {
    if (!activeSaveId) return;
    const [d, ev] = await Promise.all([api.getDashboard(activeSaveId), api.getPendingEvents(activeSaveId)]);
    setDash(d);
    setEvents(ev);
    if (!d.team) {
      const offers = await api.getJobOffers(activeSaveId);
      setJobOffers(offers);
      setRivalries([]);
    } else {
      setJobOffers([]);
      const rivals = await api.getRivalries(activeSaveId);
      setRivalries(rivals);
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
      if (result.offseasonResult?.conferenceInvite) setConferenceInvite(result.offseasonResult.conferenceInvite);
      await refresh();
    } finally {
      setAdvancing(false);
    }
  }

  async function respondToInvite(accept: boolean) {
    if (!activeSaveId || !conferenceInvite) return;
    setRespondingToInvite(true);
    try {
      await api.respondToConferenceInvite(
        activeSaveId, accept, conferenceInvite.targetConferenceId, conferenceInvite.targetDivision, conferenceInvite.replacingTeamId
      );
      setConferenceInvite(null);
      await refresh();
    } finally {
      setRespondingToInvite(false);
    }
  }

  async function resolveEvent(eventId: string, optionId: string) {
    if (!activeSaveId) return;
    await api.resolveEvent(activeSaveId, eventId, optionId);
    await refresh();
  }

  async function openPreview(gameId: string) {
    if (!activeSaveId) return;
    setPreviewLoading(true);
    try {
      const data = await api.getGamePreview(activeSaveId, gameId);
      setPreview(data);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function acceptJob(teamId: string) {
    if (!activeSaveId) return;
    await api.acceptJob(activeSaveId, teamId);
    await refresh();
    navigate("/edit-schedule");
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
              <strong><TeamLink teamId={o.teamId} name={o.teamName} /></strong> ({o.division}) — prestige {o.prestige}
              {o.salary != null && <span className="text-muted"> · {fmtMoney(o.salary)}/yr</span>}
              {o.costOfLivingIndex != null && <span className="text-muted"> · {colLabel(o.costOfLivingIndex)} cost of living</span>}
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
          Athletic Director:{" "}
          <button className="player-name-link" onClick={() => setSelectedAd(team.athleticDirector)}>
            {team.athleticDirector.name}
          </button>
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

      {rivalries.length > 0 && (
        <div className="card">
          <h3>Rivalries</h3>
          {rivalries.map((r) => (
            <div key={r.teamId} className="divider-row">
              <strong><TeamLink teamId={r.teamId} name={r.teamName} /></strong>
              <span className={r.intensity >= 60 ? "text-bad" : ""}> — {rivalryLabel(r.intensity)} ({r.intensity}/100)</span>
              <span className="text-muted"> · all-time {r.allTimeRecord.wins}-{r.allTimeRecord.losses}</span>
              {r.origin === "POSTSEASON" && <span className="text-muted"> · forged in the postseason</span>}
            </div>
          ))}
        </div>
      )}

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
          <button className="player-name-link" style={{ fontSize: "1rem" }} disabled={previewLoading} onClick={() => openPreview(nextGame.id)}>
            {fmtDate(nextGame.date)}: {nextGame.homeTeamId === team.id ? "vs" : "@"} {nextGame.homeTeamId === team.id ? nextGame.awayTeam.name : nextGame.homeTeam.name}
            {nextGame.tournament ? ` (${nextGame.tournament.type.replace(/_/g, " ")})` : nextGame.isConference ? " (Conference)" : ""}
          </button>
        ) : (
          <p>No games scheduled right now.</p>
        )}
        <div style={{ marginTop: nextGame ? 12 : 0 }}>
          <button onClick={handleAdvance} disabled={advancing}>
            {advancing ? "Simulating..." : "Advance"}
          </button>
        </div>
        {lastResult && (
          <p className="text-muted" style={{ marginTop: 8 }}>
            {lastResult.gamesPlayedToday} game(s) played today · Phase: {lastResult.newPhase}
          </p>
        )}
      </div>

      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <h2><TeamLink teamId={preview.awayTeam.teamId} name={preview.awayTeam.name} /> at <TeamLink teamId={preview.homeTeam.teamId} name={preview.homeTeam.name} /></h2>
            <p className="text-muted">
              {fmtDate(preview.date)}
              {preview.tournament ? ` · ${preview.tournament.name ?? preview.tournament.type.replace(/_/g, " ")}` : preview.isConference ? " · Conference game" : ""}
            </p>

            <div style={{ overflowX: "auto", marginTop: 6 }}>
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Record</th>
                    <th>KenPom</th>
                    <th>RPI</th>
                    <th>Spread</th>
                    <th>Moneyline</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><TeamLink teamId={preview.awayTeam.teamId} name={preview.awayTeam.name} /></td>
                    <td className="text-muted">{preview.awayTeam.record.wins}-{preview.awayTeam.record.losses}</td>
                    <td className="text-muted">{fmtKenpom(preview.awayTeam.kenpom)}</td>
                    <td className="text-muted">{fmtRPI(preview.awayTeam.rpi)}</td>
                    <td className={preview.odds.favorite === "away" ? "text-good" : undefined} style={{ fontWeight: preview.odds.favorite === "away" ? 700 : 400 }}>
                      {signed(preview.odds.awaySpread)}
                    </td>
                    <td className={preview.odds.favorite === "away" ? "text-good" : undefined} style={{ fontWeight: preview.odds.favorite === "away" ? 700 : 400 }}>
                      {signed(preview.odds.awayMoneyline)}
                    </td>
                  </tr>
                  <tr>
                    <td><TeamLink teamId={preview.homeTeam.teamId} name={preview.homeTeam.name} /> <span className="text-muted" style={{ fontWeight: 400, fontSize: "0.78rem" }}>(Home)</span></td>
                    <td className="text-muted">{preview.homeTeam.record.wins}-{preview.homeTeam.record.losses}</td>
                    <td className="text-muted">{fmtKenpom(preview.homeTeam.kenpom)}</td>
                    <td className="text-muted">{fmtRPI(preview.homeTeam.rpi)}</td>
                    <td className={preview.odds.favorite === "home" ? "text-good" : undefined} style={{ fontWeight: preview.odds.favorite === "home" ? 700 : 400 }}>
                      {signed(preview.odds.homeSpread)}
                    </td>
                    <td className={preview.odds.favorite === "home" ? "text-good" : undefined} style={{ fontWeight: preview.odds.favorite === "home" ? 700 : 400 }}>
                      {signed(preview.odds.homeMoneyline)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-muted" style={{ fontSize: "0.82rem", marginTop: 14 }}>
              {preview.odds.favorite === "even"
                ? "Dead-even matchup."
                : `${preview.odds.favorite === "home" ? preview.homeTeam.name : preview.awayTeam.name} are ${Math.round(
                    Math.max(preview.odds.homeWinProbability, preview.odds.awayWinProbability) * 100,
                  )}% favorites to win.`}
              {(preview.homeTeam.kenpom === null || preview.awayTeam.kenpom === null) &&
                " KenPom/RPI shown only once a team has played D1 games this season — odds lean on prestige until then."}
            </p>

            <h3 style={{ marginTop: 18 }}>Projected Starting Lineups</h3>
            <LineupTable team={preview.awayTeam} />
            <LineupTable team={preview.homeTeam} />

            <h3 style={{ marginTop: 4 }}>Injury Report</h3>
            <InjuryReportLine team={preview.awayTeam} />
            <InjuryReportLine team={preview.homeTeam} />
          </div>
        </div>
      )}

      {conferenceInvite && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 560 }}>
            <h2>{conferenceInvite.kind === "DIVISION_PROMOTION" ? "Reclassification Invite" : "Conference Upgrade Invite"}</h2>
            <p>{conferenceInvite.reason}</p>
            <div className="player-detail-grid">
              <div><div className="label">New Conference</div><div className="value">{conferenceInvite.targetConferenceName}</div></div>
              <div><div className="label">New Division</div><div className="value">{conferenceInvite.targetDivision}</div></div>
              <div><div className="label">Replaced By</div><div className="value">{conferenceInvite.replacingTeamName}</div></div>
            </div>
            <p className="text-muted" style={{ fontSize: "0.82rem", marginTop: 10 }}>
              Accepting takes effect immediately — new conference schedule, new rivals, new level of competition.
              Declining keeps things exactly as they are.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => respondToInvite(true)} disabled={respondingToInvite}>
                {respondingToInvite ? "..." : "Accept"}
              </button>
              <button className="secondary" onClick={() => respondToInvite(false)} disabled={respondingToInvite}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

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

      <button className="secondary" onClick={exitToSaves}>Back to Saves</button>
    </div>
  );
}
