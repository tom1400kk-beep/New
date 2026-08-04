import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";

const FORMAT_LABELS: Record<string, string> = {
  BRACKET8: "8-team bracket · 3 games",
  BRACKET4: "4-team bracket · 2 games",
  POOL8: "8-team pool play · 3 games",
  POOL16: "16-team pool play · 3 games",
};

const TIER_LABELS: Record<string, string> = {
  MAJOR: "Marquee",
  MID: "Mid-Major",
  SMALL: "Small",
};

function InternationalTourCard() {
  const { activeSaveId } = useSave();
  const [data, setData] = useState<any | null>(null);
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (activeSaveId) setData(await api.getInternationalTour(activeSaveId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSaveId]);

  async function book() {
    if (!activeSaveId || busy || !country) return;
    setBusy(true);
    setError(null);
    try {
      await api.bookInternationalTour(activeSaveId, country);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to book tour");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>International Exhibition Tour</h3>
      <p className="text-muted" style={{ fontSize: "0.85rem" }}>
        NCAA rules let a program tour a foreign country once every 4 years, playing 3 exempt exhibition games there —
        they don't count toward your record. It also earns a recruiting boost for prospects from that country,
        strongest this season and fading out over the next few.
      </p>

      {data.thisSeasonTour && (
        <div style={{ marginBottom: 12 }}>
          <strong>This season's tour: {data.thisSeasonTour.country}</strong>
          <table>
            <thead>
              <tr><th>Opponent</th><th>Result</th></tr>
            </thead>
            <tbody>
              {data.thisSeasonTour.games.map((g: any, i: number) => (
                <tr key={i}>
                  <td>{g.opponentName}</td>
                  <td className={g.win ? "text-good" : "text-bad"}>
                    {g.win ? "W" : "L"} {g.teamScore}-{g.opponentScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!data.thisSeasonTour && data.currentCountry && (
        <p className="text-muted">
          Last toured <strong>{data.currentCountry}</strong> in {data.currentTourSeasonYear}.
          {!data.eligible && data.nextEligibleSeasonYear && ` Eligible to tour again in ${data.nextEligibleSeasonYear}.`}
        </p>
      )}

      {data.editable && !data.thisSeasonTour && data.eligible && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Select a country…</option>
            {data.countries.map((c: string) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button disabled={busy || !country} onClick={book}>Book Tour</button>
        </div>
      )}

      {error && <p className="text-bad">{error}</p>}
      {!data.editable && <p className="text-muted">The tour can only be booked during the preseason.</p>}
    </div>
  );
}

function PreseasonTournamentsSection() {
  const { activeSaveId } = useSave();
  const [data, setData] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (activeSaveId) setData(await api.getPreseasonTournaments(activeSaveId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSaveId]);

  async function join(tournamentId: string) {
    if (!activeSaveId || busy) return;
    setBusy(true);
    try {
      await api.joinPreseasonTournament(activeSaveId, tournamentId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!activeSaveId || busy) return;
    setBusy(true);
    try {
      await api.leavePreseasonTournament(activeSaveId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p>Loading…</p>;

  if (data.userDivision !== "D1") {
    return (
      <p className="text-muted">
        Preseason multi-team events (Maui Invitational, Battle 4 Atlantis, and the rest) are a D1-only tradition —
        not available at this level.
      </p>
    );
  }

  const current = data.tournaments.find((t: any) => t.userTeamIn);

  return (
    <div>
      <p className="text-muted">
        Pick a preseason multi-team event for your non-conference slate. Joining swaps your entire early-season
        schedule with the invite you're replacing — same dates, same opponents-for-opponents. You'll only draw a bid
        from events your program's prestige can realistically compete in.
        {!data.editable && " The schedule locks once the season begins, so this is read-only now."}
      </p>

      {current && (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>Currently in:</strong> {current.name}
          {data.editable && (
            <button className="secondary" style={{ marginLeft: 12 }} disabled={busy} onClick={leave}>
              Leave Event
            </button>
          )}
        </div>
      )}

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr><th>Event</th><th>Tier</th><th>Format</th><th>Field</th><th></th></tr>
          </thead>
          <tbody>
            {data.tournaments.map((t: any) => (
              <tr key={t.tournamentId} style={t.userTeamIn ? { background: "rgba(80, 160, 80, 0.12)" } : undefined}>
                <td>{t.name}</td>
                <td>{TIER_LABELS[t.tier] ?? t.tier ?? "—"}</td>
                <td className="text-muted">{FORMAT_LABELS[t.format] ?? t.format ?? "—"}</td>
                <td className="text-muted" style={{ maxWidth: 420 }}>
                  <strong>({t.field.length} teams)</strong> {t.field.map((f: any) => f.name).join(", ")}
                </td>
                <td>
                  {data.editable && !t.userTeamIn && (
                    t.eligible ? (
                      <button className="secondary" disabled={busy} onClick={() => join(t.tournamentId)}>
                        Join
                      </button>
                    ) : (
                      <span className="text-muted" title="Your program's prestige isn't high enough to draw an invite to this event">
                        Not eligible
                      </span>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.tournaments.length === 0 && <p>No preseason events generated for this season.</p>}
      </div>
    </div>
  );
}

export default function EditSchedulePage() {
  return (
    <div>
      <h1>Edit Schedule</h1>
      <InternationalTourCard />
      <PreseasonTournamentsSection />
    </div>
  );
}
