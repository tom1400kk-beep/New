import { Router } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { TOUR_COOLDOWN_YEARS, TOUR_COUNTRIES, isTourEligible, isTourAffordable, simulateTourGames } from "../engine/internationalTour";
import { mulberry32 } from "../engine/rng";
import type { SimTeam } from "../engine/simulate";
import type { Division } from "../types";

export const internationalTourRouter = Router();

internationalTourRouter.get("/saves/:id/international-tour", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json({ editable: false, eligible: false, affordable: false, countries: TOUR_COUNTRIES, currentCountry: null, currentTourSeasonYear: null, nextEligibleSeasonYear: null, thisSeasonTour: null });

  const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId } });
  const cooldownOk = isTourEligible(team.internationalTourSeasonYear, save.currentSeasonYear);
  const affordable = isTourAffordable(team.division as Division, team.prestige);
  const thisSeasonTour = await prisma.internationalTour.findFirst({
    where: { teamId: team.id, seasonYear: save.currentSeasonYear },
  });

  res.json({
    editable: save.currentPhase === "PRESEASON",
    eligible: cooldownOk && affordable,
    affordable,
    countries: TOUR_COUNTRIES,
    currentCountry: team.internationalTourCountry,
    currentTourSeasonYear: team.internationalTourSeasonYear,
    nextEligibleSeasonYear: !cooldownOk && team.internationalTourSeasonYear !== null ? team.internationalTourSeasonYear + TOUR_COOLDOWN_YEARS : null,
    thisSeasonTour: thisSeasonTour ? { country: thisSeasonTour.country, games: JSON.parse(thisSeasonTour.gamesJson) } : null,
  });
});

internationalTourRouter.post("/saves/:id/international-tour", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "No active team" });
  if (save.currentPhase !== "PRESEASON") return res.status(400).json({ error: "The tour can only be booked during the preseason" });

  const country = String(req.body.country ?? "");
  if (!TOUR_COUNTRIES.includes(country)) return res.status(400).json({ error: "Not a valid tour destination" });

  const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, include: { headCoach: true } });
  if (!isTourAffordable(team.division as Division, team.prestige)) {
    return res.status(400).json({ error: "Your program isn't successful enough yet to attract the booster support a foreign tour takes" });
  }
  if (!isTourEligible(team.internationalTourSeasonYear, save.currentSeasonYear)) {
    return res.status(400).json({ error: "This program toured within the last 4 years — not eligible yet" });
  }
  if (team.internationalTourSeasonYear === save.currentSeasonYear) {
    return res.status(400).json({ error: "Already toured this season" });
  }

  const players = await prisma.player.findMany({
    where: { teamId: team.id },
    select: {
      id: true, position: true, scoring: true, threePoint: true, finishing: true, playmaking: true,
      rebounding: true, defense: true, athleticism: true, basketballIq: true, characterRating: true,
      isInjured: true, isSuspended: true,
    },
  });

  const simTeam: SimTeam = {
    id: team.id,
    players,
    offenseSkill: team.headCoach?.offenseSkill ?? 50,
    defenseSkill: team.headCoach?.defenseSkill ?? 50,
  };

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
  const games = simulateTourGames(simTeam, country, rng);

  await prisma.internationalTour.create({
    data: { id: randomUUID(), saveGameId: save.id, teamId: team.id, seasonYear: save.currentSeasonYear, country, gamesJson: JSON.stringify(games) },
  });
  await prisma.team.update({
    where: { id: team.id },
    data: { internationalTourCountry: country, internationalTourSeasonYear: save.currentSeasonYear },
  });

  res.json({ ok: true, country, games });
});
