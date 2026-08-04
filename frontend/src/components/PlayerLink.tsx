import { useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import TeamLink from "./TeamLink";

const ORIGIN_LABELS: Record<string, string> = {
  HIGH_SCHOOL: "High School",
  JUCO: "Junior College",
  TRANSFER_PORTAL: "Transfer Portal",
  INTERNATIONAL: "International",
};

function homeLabel(p: any): string {
  if (p.origin === "INTERNATIONAL") return p.hometownCity ? `${p.hometownCity}, ${p.countryOfOrigin}` : p.countryOfOrigin;
  const town = p.hometownCity ? `${p.hometownCity}, ${p.hometownState}` : p.hometownState;
  if (p.countryOfOrigin) return `${town} (${p.countryOfOrigin})`;
  return town;
}

function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12);
  const remainder = inches % 12;
  return `${feet}'${remainder}"`;
}

// Clickable player name used everywhere a player is displayed without
// already-fetched detail data in hand (e.g. a game preview's starting
// lineup/injury report) — fetches a full profile on click and shows it in a
// modal, following the same pattern as TeamLink/CoachLink/ADLink.
export default function PlayerLink({ playerId, name }: { playerId: string; name: string }) {
  const { activeSaveId } = useSave();
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleClick() {
    setOpen(true);
    if (!activeSaveId) return;
    setLoading(true);
    try {
      setPlayer(await api.getPlayerProfile(activeSaveId, playerId));
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setPlayer(null);
  }

  return (
    <>
      <button className="player-name-link" onClick={handleClick}>{name}</button>
      {open && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            {loading || !player ? (
              <p>Loading…</p>
            ) : (
              <>
                <h2>{player.firstName} {player.lastName}</h2>
                <p className="text-muted">
                  {player.position}
                  {player.classYear ? ` · ${player.classYear}` : ""}
                  {player.heightInches ? ` · ${formatHeight(player.heightInches)}` : ""}
                  {" · "}Overall {player.overall}
                </p>
                {player.teamId && (
                  <p className="text-muted" style={{ marginTop: -8 }}>
                    <TeamLink teamId={player.teamId} name={player.teamName} />
                  </p>
                )}

                <div className="player-detail-grid">
                  <div><div className="label">Hometown</div><div className="value">{homeLabel(player)}</div></div>
                  <div><div className="label">Origin</div><div className="value">{ORIGIN_LABELS[player.origin] ?? player.origin}</div></div>
                  {player.origin === "HIGH_SCHOOL" && player.highSchool && (
                    <div><div className="label">High School</div><div className="value">{player.highSchool}</div></div>
                  )}
                  <div><div className="label">Aid</div><div className="value">{player.onScholarship ? "Scholarship" : "Walk-On"}</div></div>
                </div>

                <div className="player-detail-grid">
                  <div><div className="label">Scoring</div><div className="value">{player.scoring}</div></div>
                  <div><div className="label">3PT</div><div className="value">{player.threePoint}</div></div>
                  <div><div className="label">Finishing</div><div className="value">{player.finishing}</div></div>
                  <div><div className="label">Playmaking</div><div className="value">{player.playmaking}</div></div>
                  <div><div className="label">Rebounding</div><div className="value">{player.rebounding}</div></div>
                  <div><div className="label">Defense</div><div className="value">{player.defense}</div></div>
                  <div><div className="label">Athleticism</div><div className="value">{player.athleticism}</div></div>
                  <div><div className="label">Basketball IQ</div><div className="value">{player.basketballIq}</div></div>
                  <div><div className="label">Character</div><div className="value">{player.characterRating}</div></div>
                  <div><div className="label">Discipline</div><div className="value">{player.disciplineRating}</div></div>
                </div>

                {(player.isInjured || player.isSuspended) && (
                  <p className="text-bad">
                    {player.isSuspended && `Suspended — ${player.suspensionDaysLeft} day(s) left. `}
                    {player.isInjured && `${player.injuryType ?? "Injured"} — ${player.injuryWeeksLeft} day(s) left.`}
                  </p>
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
