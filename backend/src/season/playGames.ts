import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { simulateGame, type SimTeam, type SimPlayer } from "../engine/simulate";

export async function playGames(saveGameId: string, gameIds: string[]): Promise<void> {
  if (gameIds.length === 0) return;

  const games = await prisma.game.findMany({
    where: { id: { in: gameIds } },
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });

  const teamIds = [...new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];

  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    include: { headCoach: true },
  });
  const players = await prisma.player.findMany({
    where: { teamId: { in: teamIds } },
    select: {
      id: true, teamId: true, position: true, scoring: true, threePoint: true, finishing: true,
      playmaking: true, rebounding: true, defense: true, athleticism: true, basketballIq: true,
      characterRating: true, isInjured: true, isSuspended: true,
    },
  });

  const playersByTeam = new Map<string, SimPlayer[]>();
  for (const p of players) {
    if (!p.teamId) continue;
    if (!playersByTeam.has(p.teamId)) playersByTeam.set(p.teamId, []);
    playersByTeam.get(p.teamId)!.push({
      id: p.id, position: p.position, scoring: p.scoring, threePoint: p.threePoint, finishing: p.finishing,
      playmaking: p.playmaking, rebounding: p.rebounding, defense: p.defense, athleticism: p.athleticism,
      basketballIq: p.basketballIq, characterRating: p.characterRating, isInjured: p.isInjured,
      isSuspended: p.isSuspended,
    });
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));

  // A hidden, small edge for the Analytics & Video Coordinator background —
  // superior preparation shows up in the game sim itself, not in a visible stat.
  function filmStudyBonus(coach: { background: string | null } | null | undefined): number {
    return coach?.background === "ANALYTICS_COORDINATOR" ? 3 : 0;
  }

  const statRows: any[] = [];
  const gameUpdates: { id: string; homeScore: number; awayScore: number }[] = [];

  for (const g of games) {
    const homeTeam = teamById.get(g.homeTeamId);
    const awayTeam = teamById.get(g.awayTeamId);
    if (!homeTeam || !awayTeam) continue;

    const home: SimTeam = {
      id: homeTeam.id,
      players: playersByTeam.get(homeTeam.id) ?? [],
      offenseSkill: (homeTeam.headCoach?.offenseSkill ?? 50) + filmStudyBonus(homeTeam.headCoach),
      defenseSkill: (homeTeam.headCoach?.defenseSkill ?? 50) + filmStudyBonus(homeTeam.headCoach),
    };
    const away: SimTeam = {
      id: awayTeam.id,
      players: playersByTeam.get(awayTeam.id) ?? [],
      offenseSkill: (awayTeam.headCoach?.offenseSkill ?? 50) + filmStudyBonus(awayTeam.headCoach),
      defenseSkill: (awayTeam.headCoach?.defenseSkill ?? 50) + filmStudyBonus(awayTeam.headCoach),
    };

    const result = simulateGame(home, away);
    gameUpdates.push({ id: g.id, homeScore: result.homeScore, awayScore: result.awayScore });

    for (const b of result.homeBox) statRows.push({ id: randomUUID(), gameId: g.id, ...b });
    for (const b of result.awayBox) statRows.push({ id: randomUUID(), gameId: g.id, ...b });
  }

  await prisma.$transaction(
    gameUpdates.map((u) =>
      prisma.game.update({ where: { id: u.id }, data: { homeScore: u.homeScore, awayScore: u.awayScore, isPlayed: true } }),
    ),
  );

  const chunkSize = 400;
  for (let i = 0; i < statRows.length; i += chunkSize) {
    await prisma.playerGameStat.createMany({ data: statRows.slice(i, i + chunkSize) });
  }
}
