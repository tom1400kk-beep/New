import { Router } from "express";
import { prisma } from "../db";
import { overall, type SimPlayer } from "../engine/simulate";

export const profilesRouter = Router();

// Fetch-by-id profile endpoints powering the "click any player/coach/AD name"
// feature across the UI, mirroring the existing GET /saves/:id/teams/:teamId
// pattern (see team.ts) so every current and future screen can link to a
// person's profile with just their id + name, regardless of how little data
// the calling screen already has in hand.

profilesRouter.get("/saves/:id/players/:playerId", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const player = await prisma.player.findUniqueOrThrow({
    where: { id: req.params.playerId },
    include: { team: true },
  });
  if (player.saveGameId !== save.id) return res.status(404).json({ error: "Player not found in this save" });

  res.json({
    ...player,
    overall: Math.round(overall(player as unknown as SimPlayer)),
    teamId: player.team?.id ?? null,
    teamName: player.team?.name ?? null,
  });
});

profilesRouter.get("/saves/:id/coaches/:coachId", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const coach = await prisma.coach.findUniqueOrThrow({
    where: { id: req.params.coachId },
    include: { team: true },
  });
  if (coach.saveGameId !== save.id) return res.status(404).json({ error: "Coach not found in this save" });

  res.json({ ...coach, teamId: coach.team?.id ?? null, teamName: coach.team?.name ?? null });
});

profilesRouter.get("/saves/:id/athletic-directors/:adId", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const ad = await prisma.athleticDirector.findUniqueOrThrow({
    where: { id: req.params.adId },
    include: { team: true },
  });
  if (ad.saveGameId !== save.id) return res.status(404).json({ error: "Athletic director not found in this save" });

  res.json({ ...ad, teamId: ad.team?.id ?? null, teamName: ad.team?.name ?? null });
});
