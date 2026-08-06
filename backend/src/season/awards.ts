import { prisma } from "../db";
import { computeStandings } from "./standings";
import { expectedWinPct } from "../engine/career";
import { computeSeasonAwards, prestigeDeltaForTeam, type AwardPlayerLine, type AwardCoachLine, type AwardResult } from "../engine/awards";
import { clamp } from "../engine/rng";

// Called once per season, right as the regular season ends (see advance.ts's
// REGULAR_SEASON -> CONFERENCE_TOURNAMENT transition) — that's the one point
// every division's regular season has just finished simultaneously, so this
// can never double-run for a season.
export async function computeAndApplySeasonAwards(saveGameId: string, seasonYear: number): Promise<AwardResult[]> {
  const teams = await prisma.team.findMany({
    where: { saveGameId },
    select: { id: true, division: true, conferenceId: true, prestige: true, headCoachId: true },
  });
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const standings = await computeStandings(saveGameId, seasonYear);

  const statRows = await prisma.playerGameStat.findMany({
    where: { game: { saveGameId, seasonYear, isPlayed: true } },
    select: { playerId: true, teamId: true, points: true, rebounds: true, assists: true, steals: true, blocks: true, fgm: true, fga: true },
  });

  const byPlayer = new Map<string, typeof statRows>();
  for (const row of statRows) {
    if (!byPlayer.has(row.playerId)) byPlayer.set(row.playerId, []);
    byPlayer.get(row.playerId)!.push(row);
  }

  const sum = (rows: typeof statRows, key: "points" | "rebounds" | "assists" | "steals" | "blocks" | "fgm" | "fga") =>
    rows.reduce((s, r) => s + r[key], 0);

  const playerLines: AwardPlayerLine[] = [];
  for (const [playerId, rows] of byPlayer) {
    const teamId = rows[0].teamId;
    const team = teamById.get(teamId);
    if (!team) continue;
    const n = rows.length;
    const fgm = sum(rows, "fgm");
    const fga = sum(rows, "fga");
    playerLines.push({
      playerId, teamId, division: team.division, conferenceId: team.conferenceId,
      ppg: sum(rows, "points") / n, rpg: sum(rows, "rebounds") / n, apg: sum(rows, "assists") / n,
      spg: sum(rows, "steals") / n, bpg: sum(rows, "blocks") / n,
      fgPct: fga > 0 ? (fgm / fga) * 100 : 0,
      gamesPlayed: n,
    });
  }

  const coachLines: AwardCoachLine[] = teams
    .filter((t): t is typeof t & { headCoachId: string } => t.headCoachId !== null)
    .map((t) => {
      const record = standings.get(t.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      return { coachId: t.headCoachId, teamId: t.id, division: t.division, prestige: t.prestige, wins: record.wins, losses: record.losses };
    });

  const results = computeSeasonAwards(playerLines, coachLines, expectedWinPct);
  if (results.length === 0) return results;

  await prisma.seasonAward.createMany({
    data: results.map((r) => ({
      saveGameId, seasonYear, type: r.type, division: r.division, conferenceId: r.conferenceId,
      playerId: r.playerId, coachId: r.coachId, teamId: r.teamId,
    })),
  });

  // Bounded, once-per-season program-reputation nudge — see prestigeDeltaForTeam.
  const affectedTeamIds = new Set(results.map((r) => r.teamId));
  for (const teamId of affectedTeamIds) {
    const delta = prestigeDeltaForTeam(results, teamId);
    const team = teamById.get(teamId);
    if (delta > 0 && team) {
      await prisma.team.update({ where: { id: teamId }, data: { prestige: clamp(team.prestige + delta, 1, 100) } });
    }
  }

  // Coach of the Year gets its own reputation bump, on top of the team-level
  // prestige nudge above — a coach's national media profile rising is
  // distinct from the program's overall standing.
  const coachAwards = results.filter((r): r is AwardResult & { coachId: string } => r.type === "COACH_OF_YEAR" && r.coachId !== null);
  for (const award of coachAwards) {
    const coach = await prisma.coach.findUnique({ where: { id: award.coachId }, select: { nationalPerception: true, localPerception: true } });
    if (!coach) continue;
    await prisma.coach.update({
      where: { id: award.coachId },
      data: {
        nationalPerception: clamp(coach.nationalPerception + 10, 0, 100),
        localPerception: clamp(coach.localPerception + 15, 0, 100),
      },
    });
  }

  return results;
}
