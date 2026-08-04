import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function CalendarPage() {
  const { activeSaveId } = useSave();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (activeSaveId) api.getSeasonCalendar(activeSaveId).then(setData);
  }, [activeSaveId]);

  if (!data) return <p>Loading…</p>;

  const today = new Date(data.currentDate).getTime();
  const milestones = data.milestones;

  // Insert a synthetic "Today" row at its chronological position among the
  // real milestones, so the whole season's arc and "where you are" read as
  // one continuous timeline rather than two separate things to cross-reference.
  const rows: { kind: "milestone" | "today"; milestone?: any }[] = [];
  let todayInserted = false;
  for (const m of milestones) {
    const mTime = new Date(m.date).getTime();
    if (!todayInserted && today < mTime) {
      rows.push({ kind: "today" });
      todayInserted = true;
    }
    rows.push({ kind: "milestone", milestone: m });
  }
  if (!todayInserted) rows.push({ kind: "today" });

  return (
    <div>
      <h1>Season Calendar</h1>
      <p className="text-muted">
        {data.division} · {data.seasonYear}–{data.seasonYear + 1} season. Dates marked "estimated" haven't happened yet —
        they're computed from your division's bracket sizes and will lock in as the real dates once each stage begins.
      </p>
      <div className="card">
        <div style={{ position: "relative", paddingLeft: 20 }}>
          <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, background: "var(--border)" }} />
          {rows.map((row) => {
            if (row.kind === "today") {
              return (
                <div key="today" style={{ position: "relative", padding: "10px 0", fontWeight: 700 }}>
                  <div style={{ position: "absolute", left: -20, top: 14, width: 12, height: 12, borderRadius: "50%", background: "var(--good)" }} />
                  <span className="text-good">● TODAY — {fmtDate(data.currentDate)}</span>
                </div>
              );
            }
            const m = row.milestone!;
            const isPast = new Date(m.date).getTime() < today;
            return (
              <div key={m.key} style={{ position: "relative", padding: "10px 0", opacity: isPast ? 0.55 : 1 }}>
                <div style={{ position: "absolute", left: -16, top: 14, width: 8, height: 8, borderRadius: "50%", background: isPast ? "var(--muted)" : "var(--accent)" }} />
                <strong>{m.label}</strong>
                <span className="text-muted"> — {fmtDate(m.date)}</span>
                {m.estimated && <span className="text-muted" style={{ fontSize: "0.75rem" }}> (estimated)</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
