import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import TeamLink from "../components/TeamLink";

const FORMAT_LABELS: Record<string, string> = {
  BRACKET8: "8-team bracket · 3 games",
  BRACKET4: "4-team bracket · 2 games",
  POOL8: "8-team pool play · 3 games",
  POOL16: "16-team pool play · 3 games",
  CLASSIC4: "4-team classic (2 conferences) · 2 games",
  CHALLENGE2: "Conference challenge · 1 game",
  SHOWCASE6: "6-team showcase · 2 games",
  MEGA: "Mega showcase · 3 games",
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
        strongest this season and fading out over the next few. Below D1, only programs that have built real
        success can attract the booster support it takes.
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

      {!data.thisSeasonTour && !data.affordable && (
        <p className="text-muted">
          Your program isn't successful enough yet to attract the booster support a foreign tour takes — build up
          your prestige and it'll become an option.
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

  async function leave(tournamentId: string) {
    if (!activeSaveId || busy) return;
    setBusy(true);
    try {
      await api.leavePreseasonTournament(activeSaveId, tournamentId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p>Loading…</p>;

  if (!data.userDivision) {
    return <p className="text-muted">Pick a team to see this season's non-conference events.</p>;
  }

  const isD1 = data.userDivision === "D1";
  const mine = data.tournaments.filter((t: any) => t.userTeamIn);

  return (
    <div>
      <p className="text-muted">
        {isD1
          ? "Pick a preseason multi-team event for your non-conference slate. Joining swaps your entire early-season schedule with the invite you're replacing — same dates, same opponents-for-opponents. You'll only draw a bid from events your program's prestige can realistically compete in."
          : "Your team is auto-assigned to this season's in-season tip-off classics, Thanksgiving events, and holiday showcases — hosted by member schools or at neutral sites, kept regionally realistic so nobody's flying across the country for a non-conference game. If your program is offered a bonus second event, you can decline it below; your primary event is set and can't be changed."}
        {!data.editable && " The schedule locks once the season begins, so this is read-only now."}
      </p>

      {mine.map((t: any) => (
        <div className="card" key={t.tournamentId} style={{ marginBottom: 16 }}>
          <strong>{isD1 ? "Currently in:" : "Assigned to:"}</strong> {t.name}
          {data.editable && t.canDecline && (
            <button className="secondary" style={{ marginLeft: 12 }} disabled={busy} onClick={() => leave(t.tournamentId)}>
              {isD1 ? "Leave Event" : "Decline Bonus Event"}
            </button>
          )}
          {!isD1 && !t.canDecline && (
            <span className="text-muted" style={{ marginLeft: 12 }}>(primary event — auto-assigned)</span>
          )}
        </div>
      ))}

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr><th>Event</th><th>Location</th><th>Tier</th><th>Format</th><th>Field</th>{isD1 && <th></th>}</tr>
          </thead>
          <tbody>
            {data.tournaments.map((t: any) => (
              <tr key={t.tournamentId} style={t.userTeamIn ? { background: "rgba(80, 160, 80, 0.12)" } : undefined}>
                <td>{t.name}</td>
                <td className="text-muted">{t.location ?? "—"}</td>
                <td>{TIER_LABELS[t.tier] ?? t.tier ?? "—"}</td>
                <td className="text-muted">{FORMAT_LABELS[t.format] ?? t.format ?? "—"}</td>
                <td className="text-muted" style={{ maxWidth: 420 }}>
                  <strong>({t.field.length} teams)</strong>{" "}
                  {t.field.map((f: any, i: number) => (
                    <span key={f.teamId}>{i > 0 && ", "}<TeamLink teamId={f.teamId} name={f.name} /></span>
                  ))}
                </td>
                {isD1 && (
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
                )}
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
