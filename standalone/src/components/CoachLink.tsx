import { useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import TeamLink from "./TeamLink";

const ARCHETYPE_LABELS: Record<string, string> = {
  OFFENSIVE_INNOVATOR: "Offensive Innovator",
  DEFENSIVE_ANCHOR: "Defensive Anchor",
  RECRUITER: "The Closer",
  PLAYER_DEVELOPER: "Player Developer",
  PROGRAM_BUILDER: "Program Builder",
  DISCIPLINARIAN: "Disciplinarian",
};

const AWARD_LABELS: Record<string, string> = {
  PLAYER_OF_YEAR: "Player of the Year",
  COACH_OF_YEAR: "Coach of the Year",
  ALL_AMERICAN_FIRST: "First Team All-American",
  ALL_AMERICAN_SECOND: "Second Team All-American",
  ALL_AMERICAN_THIRD: "Third Team All-American",
  ALL_CONFERENCE_FIRST: "First Team All-Conference",
  ALL_CONFERENCE_SECOND: "Second Team All-Conference",
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

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n / 1000)}K`;
}

// Clickable coach name used everywhere a coach is displayed — fetches a full
// profile on click and shows it in a modal, following the same pattern as
// TeamLink/PlayerLink/ADLink.
export default function CoachLink({ coachId, name }: { coachId: string; name: string }) {
  const { activeSaveId } = useSave();
  const [coach, setCoach] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleClick() {
    setOpen(true);
    if (!activeSaveId) return;
    setLoading(true);
    try {
      setCoach(await api.getCoachProfile(activeSaveId, coachId));
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setCoach(null);
  }

  return (
    <>
      <button className="player-name-link" onClick={handleClick}>{name}</button>
      {open && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            {loading || !coach ? (
              <p>Loading…</p>
            ) : (
              <>
                <h2>{coach.name}</h2>
                <p className="text-muted">
                  {ARCHETYPE_LABELS[coach.archetype] ?? formatKey(coach.archetype)}
                  {coach.background ? ` · ${BACKGROUND_LABELS[coach.background] ?? formatKey(coach.background)}` : ""}
                </p>
                {playingCareerLine(coach) && <p className="text-muted" style={{ marginTop: -8 }}>{playingCareerLine(coach)}</p>}
                {coach.teamId ? (
                  <p className="text-muted" style={{ marginTop: -8 }}>
                    <TeamLink teamId={coach.teamId} name={coach.teamName} /> · {fmtMoney(coach.currentSalary)}/yr · {coach.yearsAtCurrentJob} yr{coach.yearsAtCurrentJob === 1 ? "" : "s"} there
                  </p>
                ) : (
                  <p className="text-muted" style={{ marginTop: -8 }}>Currently unemployed</p>
                )}

                <div className="player-detail-grid">
                  <div><div className="label">Career Record</div><div className="value">{coach.careerWins}-{coach.careerLosses}</div></div>
                  <div><div className="label">Reputation</div><div className="value">{coach.reputation}/100</div></div>
                  <div><div className="label">Hot Seat</div><div className="value">{coach.hotSeatLevel}/100</div></div>
                  <div><div className="label">Legality</div><div className="value">{coach.legalityReputation}/100</div></div>
                </div>

                <div className="player-detail-grid">
                  <div><div className="label">Offense</div><div className="value">{coach.offenseSkill}</div></div>
                  <div><div className="label">Defense</div><div className="value">{coach.defenseSkill}</div></div>
                  <div><div className="label">Recruiting</div><div className="value">{coach.recruitingSkill}</div></div>
                  <div><div className="label">Development</div><div className="value">{coach.developmentSkill}</div></div>
                </div>

                {coach.awards && coach.awards.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div className="label">Awards</div>
                    {coach.awards.map((a: { seasonYear: number; type: string }, i: number) => (
                      <div key={i} className="value">{a.seasonYear}–{a.seasonYear + 1}: {AWARD_LABELS[a.type] ?? a.type}</div>
                    ))}
                  </div>
                )}

                <button style={{ marginTop: 12 }} onClick={close}>Close</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
