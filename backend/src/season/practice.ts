import { prisma } from "../db";
import { applyWeeklyPractice, type PracticeFocus } from "../engine/practice";
import { mulberry32 } from "../engine/rng";

// Called once a week (see advance.ts's Monday check, same boundary the AP
// Poll snapshot uses) — only the user's own team practices with a focus;
// AI teams keep developing purely through the existing once-a-year offseason
// jump (see offseason.ts), so this is a genuine strategic edge for the user,
// not a league-wide rebalance.
export async function applyWeeklyPracticeForSave(saveGameId: string): Promise<void> {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: saveGameId } });
  if (!save.coachTeamId) return;

  const team = await prisma.team.findUnique({ where: { id: save.coachTeamId }, include: { headCoach: true } });
  if (!team) return;

  const focus = team.practiceFocus as PracticeFocus;
  const developmentSkill = team.headCoach?.developmentSkill ?? 50;
  const players = await prisma.player.findMany({ where: { teamId: team.id, isInjured: false } });
  if (players.length === 0) return;

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));

  for (const p of players) {
    const next = applyWeeklyPractice(rng, p, focus, developmentSkill);
    await prisma.player.update({
      where: { id: p.id },
      data: {
        scoring: next.scoring, threePoint: next.threePoint, finishing: next.finishing, playmaking: next.playmaking,
        rebounding: next.rebounding, defense: next.defense, athleticism: next.athleticism,
        basketballIq: next.basketballIq, stamina: next.stamina,
      },
    });
  }
}
