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

export default function EditSchedulePage() {
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

  if (!data) return <div><h1>Edit Schedule</h1><p>Loading…</p></div>;

  if (data.userDivision !== "D1") {
    return (
      <div>
        <h1>Edit Schedule</h1>
        <p className="text-muted">
          Preseason multi-team events (Maui Invitational, Battle 4 Atlantis, and the rest) are a D1-only tradition —
          not available at this level.
        </p>
      </div>
    );
  }

  const current = data.tournaments.find((t: any) => t.userTeamIn);

  return (
    <div>
      <h1>Edit Schedule</h1>
      <p className="text-muted">
        Pick a preseason multi-team event for your non-conference slate. Joining swaps your entire early-season
        schedule with the invite you're replacing — same dates, same opponents-for-opponents.
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
                  {t.field.map((f: any) => f.name).join(", ")}
                </td>
                <td>
                  {data.editable && !t.userTeamIn && (
                    <button className="secondary" disabled={busy} onClick={() => join(t.tournamentId)}>
                      Join
                    </button>
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
