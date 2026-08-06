import { applyWeeklyPractice, type PracticeFocus } from "../engine/practice";
import { mulberry32 } from "../engine/rng";
import type { WorldState } from "./types";

// Called once a week (see advance.ts's Monday check, same boundary the AP
// Poll snapshot uses) — only the user's own team practices with a focus;
// AI teams keep developing purely through the existing once-a-year offseason
// jump (see offseason.ts), so this is a genuine strategic edge for the user,
// not a league-wide rebalance.
export function applyWeeklyPracticeForSave(state: WorldState): void {
  if (!state.save.coachTeamId) return;
  const team = state.teams.find((t) => t.id === state.save.coachTeamId);
  if (!team) return;

  const focus = team.practiceFocus as PracticeFocus;
  const coach = state.coaches.find((c) => c.id === team.headCoachId);
  const developmentSkill = coach?.developmentSkill ?? 50;
  const players = state.players.filter((p) => p.teamId === team.id && !p.isInjured);
  if (players.length === 0) return;

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));

  for (const p of players) {
    const next = applyWeeklyPractice(rng, p, focus, developmentSkill);
    p.scoring = next.scoring; p.threePoint = next.threePoint; p.finishing = next.finishing;
    p.playmaking = next.playmaking; p.rebounding = next.rebounding; p.defense = next.defense;
    p.athleticism = next.athleticism; p.basketballIq = next.basketballIq; p.stamina = next.stamina;
  }
}
