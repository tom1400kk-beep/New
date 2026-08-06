import { Router } from "express";
import { prisma } from "../db";
import { PRACTICE_FOCUS_OPTIONS, type PracticeFocus } from "../engine/practice";

export const practiceRouter = Router();

async function buildPayload(saveId: string) {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: saveId } });
  if (!save.coachTeamId) return null;
  const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, include: { headCoach: true } });
  const players = await prisma.player.findMany({ where: { teamId: team.id }, orderBy: { lastName: "asc" } });
  return {
    focus: team.practiceFocus,
    developmentSkill: team.headCoach?.developmentSkill ?? 50,
    roster: players.map((p) => ({
      playerId: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position, classYear: p.classYear,
      potential: p.potential, isInjured: p.isInjured,
      scoring: p.scoring, threePoint: p.threePoint, finishing: p.finishing, playmaking: p.playmaking,
      rebounding: p.rebounding, defense: p.defense, athleticism: p.athleticism, basketballIq: p.basketballIq, stamina: p.stamina,
    })),
  };
}

practiceRouter.get("/saves/:id/practice", async (req, res) => {
  const result = await buildPayload(req.params.id);
  if (!result) return res.status(400).json({ error: "No team for this save" });
  res.json(result);
});

practiceRouter.post("/saves/:id/practice", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "No team for this save" });

  const focus = req.body?.focus as PracticeFocus;
  if (!PRACTICE_FOCUS_OPTIONS.includes(focus)) return res.status(400).json({ error: "Invalid practice focus" });

  await prisma.team.update({ where: { id: save.coachTeamId }, data: { practiceFocus: focus } });

  const result = await buildPayload(req.params.id);
  res.json(result);
});
