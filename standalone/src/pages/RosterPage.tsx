import { useEffect, useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";

function overall(p: any): number {
  return Math.round((p.scoring + p.threePoint + p.finishing + p.playmaking + p.rebounding + p.defense + p.athleticism + p.basketballIq) / 8);
}

function homeLabel(p: any): string {
  if (p.origin === "INTERNATIONAL") return p.countryOfOrigin;
  if (p.countryOfOrigin) return `${p.hometownState} (${p.countryOfOrigin})`;
  return p.hometownState;
}

export default function RosterPage() {
  const { activeSaveId } = useSave();
  const [players, setPlayers] = useState<any[]>([]);
  const [walkOns, setWalkOns] = useState<{ candidates: any[]; rosterCount: number; rosterCap: number }>({ candidates: [], rosterCount: 0, rosterCap: 0 });
  const [addingId, setAddingId] = useState<string | null>(null);

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

  const openSpots = walkOns.rosterCap - walkOns.rosterCount;

  return (
    <div>
      <h1>Roster</h1>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Pos</th><th>Home</th><th>Yr</th><th>OVR</th><th>Scoring</th><th>3PT</th><th>Finish</th>
              <th>Playmaking</th><th>Rebounding</th><th>Defense</th><th>Character</th><th>Discipline</th><th>Aid</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>{p.firstName} {p.lastName}</td>
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
                  <td>{c.firstName} {c.lastName}</td>
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
    </div>
  );
}
