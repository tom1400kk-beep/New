import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";

function overall(p: any): number {
  return Math.round((p.scoring + p.threePoint + p.finishing + p.playmaking + p.rebounding + p.defense + p.athleticism + p.basketballIq) / 8);
}

function homeLabel(p: any): string {
  if (p.origin === "INTERNATIONAL") return p.countryOfOrigin;
  const town = p.hometownCity ? `${p.hometownCity}, ${p.hometownState}` : p.hometownState;
  if (p.countryOfOrigin) return `${town} (${p.countryOfOrigin})`;
  return town;
}

function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12);
  const remainder = inches % 12;
  return `${feet}'${remainder}"`;
}

const ORIGIN_LABELS: Record<string, string> = {
  HIGH_SCHOOL: "High School",
  JUCO: "Junior College",
  TRANSFER_PORTAL: "Transfer Portal",
  INTERNATIONAL: "International",
};

interface Column {
  key: string;
  label: string;
  getValue: (p: any) => string | number;
  numeric?: boolean;
}

const COLUMNS: Column[] = [
  { key: "name", label: "Name", getValue: (p) => `${p.lastName} ${p.firstName}` },
  { key: "position", label: "Pos", getValue: (p) => p.position },
  { key: "home", label: "Home", getValue: (p) => homeLabel(p) },
  { key: "classYear", label: "Yr", getValue: (p) => p.classYear },
  { key: "overall", label: "OVR", getValue: (p) => overall(p), numeric: true },
  { key: "scoring", label: "Scoring", getValue: (p) => p.scoring, numeric: true },
  { key: "threePoint", label: "3PT", getValue: (p) => p.threePoint, numeric: true },
  { key: "finishing", label: "Finish", getValue: (p) => p.finishing, numeric: true },
  { key: "playmaking", label: "Playmaking", getValue: (p) => p.playmaking, numeric: true },
  { key: "rebounding", label: "Rebounding", getValue: (p) => p.rebounding, numeric: true },
  { key: "defense", label: "Defense", getValue: (p) => p.defense, numeric: true },
  { key: "characterRating", label: "Character", getValue: (p) => p.characterRating, numeric: true },
  { key: "disciplineRating", label: "Discipline", getValue: (p) => p.disciplineRating, numeric: true },
  { key: "onScholarship", label: "Aid", getValue: (p) => (p.onScholarship ? "Scholarship" : "Walk-On") },
  {
    key: "status", label: "Status",
    getValue: (p) => (p.isSuspended ? `Suspended (${p.suspensionDaysLeft}d)` : p.isInjured ? `Injured (${p.injuryWeeksLeft}d)` : "Healthy"),
  },
];

export default function RosterPage() {
  const { activeSaveId } = useSave();
  const [players, setPlayers] = useState<any[]>([]);
  const [walkOns, setWalkOns] = useState<{ candidates: any[]; rosterCount: number; rosterCap: number }>({ candidates: [], rosterCount: 0, rosterCap: 0 });
  const [addingId, setAddingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState("classYear");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

  function loadRoster() {
    if (activeSaveId) api.getRoster(activeSaveId).then(setPlayers);
  }
  function loadWalkOns() {
    if (activeSaveId) api.getWalkOns(activeSaveId).then(setWalkOns);
  }

  useEffect(() => {
    loadRoster();
    loadWalkOns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSaveId]);

  async function handleAdd(candidateId: string) {
    if (!activeSaveId) return;
    setAddingId(candidateId);
    try {
      await api.addWalkOn(activeSaveId, candidateId);
      loadRoster();
      loadWalkOns();
    } catch (err: any) {
      alert(err.message ?? "Could not add walk-on");
    } finally {
      setAddingId(null);
    }
  }

  function handleSort(column: Column) {
    if (sortKey === column.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column.key);
      setSortDir(column.numeric ? "desc" : "asc");
    }
  }

  const sortedPlayers = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sortKey) ?? COLUMNS[0];
    const sorted = [...players].sort((a, b) => {
      const av = column.getValue(a);
      const bv = column.getValue(b);
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    });
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [players, sortKey, sortDir]);

  const openSpots = walkOns.rosterCap - walkOns.rosterCount;

  return (
    <div>
      <h1>Roster</h1>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`sortable${sortKey === c.key ? " active" : ""}`}
                  onClick={() => handleSort(c)}
                >
                  {c.label}{sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((p) => (
              <tr key={p.id}>
                <td>
                  <button className="player-name-link" onClick={() => setSelectedPlayer(p)}>
                    {p.firstName} {p.lastName}
                  </button>
                </td>
                <td>{p.position}</td>
                <td>{homeLabel(p)}</td>
                <td>{p.classYear}</td>
                <td>{overall(p)}</td>
                <td>{p.scoring}</td>
                <td>{p.threePoint}</td>
                <td>{p.finishing}</td>
                <td>{p.playmaking}</td>
                <td>{p.rebounding}</td>
                <td>{p.defense}</td>
                <td className={p.characterRating < 40 ? "text-bad" : p.characterRating > 75 ? "text-good" : ""}>
                  {p.characterRating}
                </td>
                <td className={p.disciplineRating < 40 ? "text-bad" : p.disciplineRating > 75 ? "text-good" : ""}>
                  {p.disciplineRating}
                </td>
                <td className="text-muted">{p.onScholarship ? "Scholarship" : "Walk-On"}</td>
                <td>
                  {p.isSuspended
                    ? `Suspended (${p.suspensionDaysLeft}d)`
                    : p.isInjured
                    ? `Injured (${p.injuryWeeksLeft}d)`
                    : "Healthy"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {players.length === 0 && <p>No roster loaded.</p>}
      </div>

      {walkOns.candidates.length > 0 && (
        <div className="card" style={{ overflowX: "auto", marginTop: "1rem" }}>
          <h2>Walk-On Tryouts</h2>
          <p className="text-muted">
            {openSpots > 0
              ? `${openSpots} open roster spot${openSpots === 1 ? "" : "s"} out of ${walkOns.rosterCap}. Local hopefuls and a few who reached out directly about walking on.`
              : `Roster is full (${walkOns.rosterCount}/${walkOns.rosterCap}).`}
          </p>
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Pos</th><th>Home</th><th>OVR</th><th>Character</th><th>Source</th><th></th>
              </tr>
            </thead>
            <tbody>
              {walkOns.candidates.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button className="player-name-link" onClick={() => setSelectedPlayer(c)}>
                      {c.firstName} {c.lastName}
                    </button>
                  </td>
                  <td>{c.position}</td>
                  <td>{homeLabel(c)}</td>
                  <td>{overall(c)}</td>
                  <td className={c.characterRating < 40 ? "text-bad" : c.characterRating > 75 ? "text-good" : ""}>
                    {c.characterRating}
                  </td>
                  <td className="text-muted">{c.source === "REACHED_OUT" ? "Reached out" : "Local"}</td>
                  <td>
                    <button
                      onClick={() => handleAdd(c.id)}
                      disabled={openSpots <= 0 || addingId === c.id}
                    >
                      {addingId === c.id ? "Adding..." : "Add to Roster"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPlayer && (
        <div className="modal-backdrop" onClick={() => setSelectedPlayer(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedPlayer.firstName} {selectedPlayer.lastName}</h2>
            <p className="text-muted">
              {selectedPlayer.position}
              {selectedPlayer.classYear ? ` · ${selectedPlayer.classYear}` : ""}
              {selectedPlayer.heightInches ? ` · ${formatHeight(selectedPlayer.heightInches)}` : ""}
              {" · "}Overall {overall(selectedPlayer)}
            </p>

            <div className="player-detail-grid">
              <div>
                <div className="label">Hometown</div>
                <div className="value">{homeLabel(selectedPlayer)}</div>
              </div>
              <div>
                <div className="label">Origin</div>
                <div className="value">{ORIGIN_LABELS[selectedPlayer.origin] ?? selectedPlayer.origin}</div>
              </div>
              {selectedPlayer.potential != null && (
                <div>
                  <div className="label">Potential</div>
                  <div className="value">{selectedPlayer.potential}</div>
                </div>
              )}
              {selectedPlayer.stamina != null && (
                <div>
                  <div className="label">Stamina</div>
                  <div className="value">{selectedPlayer.stamina}</div>
                </div>
              )}
              {selectedPlayer.eligibilityYearsLeft != null && (
                <div>
                  <div className="label">Eligibility Left</div>
                  <div className="value">{selectedPlayer.eligibilityYearsLeft} yr</div>
                </div>
              )}
              {selectedPlayer.onScholarship != null && (
                <div>
                  <div className="label">Aid</div>
                  <div className="value">{selectedPlayer.onScholarship ? "Scholarship" : "Walk-On"}</div>
                </div>
              )}
            </div>

            <div className="player-detail-grid">
              <div><div className="label">Scoring</div><div className="value">{selectedPlayer.scoring}</div></div>
              <div><div className="label">3PT</div><div className="value">{selectedPlayer.threePoint}</div></div>
              <div><div className="label">Finishing</div><div className="value">{selectedPlayer.finishing}</div></div>
              <div><div className="label">Playmaking</div><div className="value">{selectedPlayer.playmaking}</div></div>
              <div><div className="label">Rebounding</div><div className="value">{selectedPlayer.rebounding}</div></div>
              <div><div className="label">Defense</div><div className="value">{selectedPlayer.defense}</div></div>
              <div><div className="label">Athleticism</div><div className="value">{selectedPlayer.athleticism}</div></div>
              <div><div className="label">Basketball IQ</div><div className="value">{selectedPlayer.basketballIq}</div></div>
              <div><div className="label">Character</div><div className="value">{selectedPlayer.characterRating}</div></div>
              <div><div className="label">Discipline</div><div className="value">{selectedPlayer.disciplineRating}</div></div>
            </div>

            {(selectedPlayer.isInjured || selectedPlayer.isSuspended) && (
              <p className="text-bad">
                {selectedPlayer.isSuspended && `Suspended — ${selectedPlayer.suspensionDaysLeft} day(s) left. `}
                {selectedPlayer.isInjured && `Injured — ${selectedPlayer.injuryWeeksLeft} week(s) left.`}
              </p>
            )}

            <button style={{ marginTop: 12 }} onClick={() => setSelectedPlayer(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
