import { useState } from "react";
import { api } from "../api";
import { useSave } from "../SaveContext";
import TeamLink from "./TeamLink";

function adStyleLine(ad: any): string {
  if (!ad) return "";
  const traits: (string | null)[] = [
    ad.winFocus >= 65 ? "win-focused" : ad.winFocus <= 35 ? "patient with results" : null,
    ad.patience >= 65 ? "high patience" : ad.patience <= 35 ? "quick trigger" : null,
    ad.integrityStandard >= 65 ? "strict on conduct" : null,
    ad.loyalty >= 65 ? "loyal" : null,
  ];
  return traits.filter(Boolean).join(", ");
}

// Clickable athletic director name used everywhere an AD is displayed —
// fetches a full profile on click and shows it in a modal, following the
// same pattern as TeamLink/PlayerLink/CoachLink.
export default function ADLink({ adId, name }: { adId: string; name: string }) {
  const { activeSaveId } = useSave();
  const [ad, setAd] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleClick() {
    setOpen(true);
    if (!activeSaveId) return;
    setLoading(true);
    try {
      setAd(await api.getADProfile(activeSaveId, adId));
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setAd(null);
  }

  return (
    <>
      <button className="player-name-link" onClick={handleClick}>{name}</button>
      {open && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            {loading || !ad ? (
              <p>Loading…</p>
            ) : (
              <>
                <h2>{ad.name}</h2>
                <p className="text-muted">
                  Athletic Director{ad.teamId ? <> · <TeamLink teamId={ad.teamId} name={ad.teamName} /></> : " · Unaffiliated"}
                  {" · "}{ad.yearsAtCurrentJob} year{ad.yearsAtCurrentJob === 1 ? "" : "s"} in the role
                </p>
                {adStyleLine(ad) && <p className="text-muted" style={{ marginTop: -8 }}>{adStyleLine(ad)}</p>}
                <div className="player-detail-grid">
                  <div><div className="label">Patience</div><div className="value">{ad.patience}/100</div></div>
                  <div><div className="label">Win Focus</div><div className="value">{ad.winFocus}/100</div></div>
                  <div><div className="label">Integrity Standard</div><div className="value">{ad.integrityStandard}/100</div></div>
                  <div><div className="label">Loyalty</div><div className="value">{ad.loyalty}/100</div></div>
                </div>
                <p className="text-muted" style={{ fontSize: "0.8rem", marginTop: 12 }}>
                  Patience and win focus shape how forgiving they are of a rough season before your seat gets hot. Integrity
                  standard sets how strict they are about off-court issues before they'll hire — or keep — a coach. Loyalty
                  affects how much a personal relationship with you protects your job, for better or worse.
                </p>
                <button style={{ marginTop: 12 }} onClick={close}>Close</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
