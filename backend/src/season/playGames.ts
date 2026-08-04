import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { simulateGame, type SimTeam, type SimPlayer } from "../engine/simulate";
import { computeAttendance } from "../engine/attendance";
import { homeCourtBonus } from "../engine/atmosphere";
import { sortedPair } from "../engine/rivalry";
import { mulberry32 } from "../engine/rng";
import type { Division } from "../types";

export async function playGames(saveGameId: string, gameIds: string[]): Promise<void> {
  if (gameIds.length === 0) return;

  const games = await prisma.game.findMany({
    where: { id: { in: gameIds } },
    select: { id: true, homeTeamId: true, awayTeamId: true, isConference: true, tournamentId: true },
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

  const activeRivalries = await prisma.rivalry.findMany({
    where: { saveGameId, active: true, teamAId: { in: teamIds }, teamBId: { in: teamIds } },
  });
  const rivalryByPair = new Map(activeRivalries.map((r) => [`${r.teamAId}|${r.teamBId}`, r]));

  // A hidden, small edge for the Analytics & Video Coordinator background —
  // superior preparation shows up in the game sim itself, not in a visible stat.
  function filmStudyBonus(coach: { background: string | null } | null | undefined): number {
    return coach?.background === "ANALYTICS_COORDINATOR" ? 3 : 0;
  }

  const statRows: any[] = [];
  const gameUpdates: { id: string; homeScore: number; awayScore: number; attendance: number }[] = [];
  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));

  for (const g of games) {
    const homeTeam = teamById.get(g.homeTeamId);
    const awayTeam = teamById.get(g.awayTeamId);
    if (!homeTeam || !awayTeam) continue;

    // A rocking home crowd is a genuine edge — the more atmosphere a program
    // has built, the tougher its building is to play in.
    const crowdBonus = homeCourtBonus(homeTeam.headCoach?.campusAtmosphere ?? 40);
    const home: SimTeam = {
      id: homeTeam.id,
      players: playersByTeam.get(homeTeam.id) ?? [],
      offenseSkill: (homeTeam.headCoach?.offenseSkill ?? 50) + filmStudyBonus(homeTeam.headCoach) + crowdBonus,
      defenseSkill: (homeTeam.headCoach?.defenseSkill ?? 50) + filmStudyBonus(homeTeam.headCoach) + crowdBonus,
    };
    const away: SimTeam = {
      id: awayTeam.id,
      players: playersByTeam.get(awayTeam.id) ?? [],
      offenseSkill: (awayTeam.headCoach?.offenseSkill ?? 50) + filmStudyBonus(awayTeam.headCoach),
      defenseSkill: (awayTeam.headCoach?.defenseSkill ?? 50) + filmStudyBonus(awayTeam.headCoach),
    };

    const [pairA, pairB] = sortedPair(homeTeam.id, awayTeam.id);
    const rivalry = rivalryByPair.get(`${pairA}|${pairB}`);

    const result = simulateGame(home, away);
    const attendance = computeAttendance(rng, {
      capacity: homeTeam.venueCapacity,
      division: homeTeam.division as Division,
      homePrestige: homeTeam.prestige,
      awayPrestige: awayTeam.prestige,
      localPerception: homeTeam.headCoach?.localPerception ?? 50,
      nationalPerception: homeTeam.headCoach?.nationalPerception ?? 20,
      isConference: g.isConference,
      isTournament: g.tournamentId !== null,
      isRivalry: !!rivalry,
      rivalryIntensity: rivalry?.intensity,
    });
    gameUpdates.push({ id: g.id, homeScore: result.homeScore, awayScore: result.awayScore, attendance });

    for (const b of result.homeBox) statRows.push({ id: randomUUID(), gameId: g.id, teamId: homeTeam.id, ...b });
    for (const b of result.awayBox) statRows.push({ id: randomUUID(), gameId: g.id, teamId: awayTeam.id, ...b });
  }

  await prisma.$transaction(
    gameUpdates.map((u) =>
      prisma.game.update({ where: { id: u.id }, data: { homeScore: u.homeScore, awayScore: u.awayScore, attendance: u.attendance, isPlayed: true } }),
    ),
  );

  const chunkSize = 400;
  for (let i = 0; i < statRows.length; i += chunkSize) {
    await prisma.playerGameStat.createMany({ data: statRows.slice(i, i + chunkSize) });
  }
}
