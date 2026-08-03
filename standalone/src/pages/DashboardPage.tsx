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

export default function DashboardPage() {
  const { activeSaveId, setActiveSaveId } = useSave();
  const navigate = useNavigate();
  const [dash, setDash] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [jobOffers, setJobOffers] = useState<any[]>([]);
  const [advancing, setAdvancing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

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
          {jobOffers.length === 0 && <p>No offers yet — advance to check again.</p>}
          {jobOffers.map((o) => (
            <div key={o.teamId} className="divider-row">
              <strong>{o.teamName}</strong> ({o.division}) — prestige {o.prestige}{" "}
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
