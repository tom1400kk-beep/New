import { useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import CoachLink from "./CoachLink";
import ADLink from "./ADLink";
import PlayerLink from "./PlayerLink";

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

function formatKey(k?: string | null): string {
  if (!k) return "";
  return k.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function overall(p: any): number {
  return Math.round((p.scoring + p.threePoint + p.finishing + p.playmaking + p.rebounding + p.defense + p.athleticism + p.basketballIq) / 8);
}

// Clickable team name used everywhere a team (other than possibly the user's
// own) is displayed — fetches a full profile on click and shows it in a
// modal, following the same player-name-link/modal-panel pattern already
// used for players, recruits, and athletic directors.
export default function TeamLink({ teamId, name }: { teamId: string; name: string }) {
  const { activeSaveId } = useSave();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleClick() {
    setOpen(true);
    if (!activeSaveId) return;
    setLoading(true);
    try {
      setProfile(await api.getTeamProfile(activeSaveId, teamId));
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setProfile(null);
  }

  return (
    <>
      <button className="player-name-link" onClick={handleClick}>{name}</button>
      {open && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal-panel" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            {loading || !profile ? (
              <p>Loading…</p>
            ) : (
              <>
                <h2>{profile.name}</h2>
                <p className="text-muted">
                  {profile.conferenceName ?? "Independent"} · {profile.division} · {profile.city ? `${profile.city}, ${profile.state}` : profile.state}
                </p>

                <div className="player-detail-grid">
                  <div>
                    <div className="label">Record</div>
                    <div className="value">{profile.record.wins}-{profile.record.losses} ({profile.record.confWins}-{profile.record.confLosses} conf)</div>
                  </div>
                  <div><div className="label">Prestige</div><div className="value">{profile.prestige}/100</div></div>
                  {profile.kenpom && (
                    <div><div className="label">KenPom</div><div className="value">#{profile.kenpom.rank} ({profile.kenpom.adjEM >= 0 ? "+" : ""}{profile.kenpom.adjEM.toFixed(1)})</div></div>
                  )}
                  {profile.rpi && <div><div className="label">RPI</div><div className="value">#{profile.rpi.rank}</div></div>}
                  <div><div className="label">Arena</div><div className="value">{profile.venueCapacity.toLocaleString()}</div></div>
                  <div><div className="label">Facilities</div><div className="value">{profile.facilitiesRating}/100</div></div>
                  <div><div className="label">Academics</div><div className="value">{profile.academicReputation}/100</div></div>
                  <div><div className="label">NIL Budget</div><div className="value">${Math.round(profile.nilBudget / 1000)}k</div></div>
                </div>

                {profile.headCoach && (
                  <p className="text-muted" style={{ marginTop: -8 }}>
                    Coach: <CoachLink coachId={profile.headCoach.id} name={profile.headCoach.name} /> — {ARCHETYPE_LABELS[profile.headCoach.archetype] ?? formatKey(profile.headCoach.archetype)}
                    {profile.headCoach.background ? ` · ${BACKGROUND_LABELS[profile.headCoach.background] ?? formatKey(profile.headCoach.background)}` : ""}
                  </p>
                )}
                {profile.athleticDirector && (
                  <p className="text-muted" style={{ marginTop: -8 }}>
                    Athletic Director: <ADLink adId={profile.athleticDirector.id} name={profile.athleticDirector.name} />
                  </p>
                )}

                <h3 style={{ marginTop: 16 }}>Roster</h3>
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead><tr><th>Name</th><th>Pos</th><th>Class</th><th>OVR</th></tr></thead>
                    <tbody>
                      {profile.roster.map((p: any) => (
                        <tr key={p.id}>
                          <td><PlayerLink playerId={p.id} name={`${p.firstName} ${p.lastName}`} /></td>
                          <td>{p.position}</td>
                          <td>{p.classYear}</td>
                          <td>{overall(p)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {profile.roster.length === 0 && <p className="text-muted">No roster data.</p>}
                </div>

                <button style={{ marginTop: 12 }} onClick={close}>Close</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
