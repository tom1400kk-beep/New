import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { computeApPoll, type ApPollTeamInput, type ApPollGameResult } from "../engine/apPoll";
import type { Division } from "../types";

// Shared by the Monday snapshot job and the live-preview route fallback, so
// both compute a division's poll the exact same way.
export async function computeDivisionApPoll(saveGameId: string, seasonYear: number, division: Division): Promise<import("../engine/apPoll").ApPollEntry[]> {
  const divTeams = (await prisma.team.findMany({ where: { saveGameId, division }, select: { id: true, prestige: true } }))
    .map((t): ApPollTeamInput => ({ teamId: t.id, prestige: t.prestige }));
  if (divTeams.length === 0) return [];
  const divTeamIds = new Set(divTeams.map((t) => t.teamId));

  // Same convention as RPI/standings elsewhere: regular-season games only, so
  // the poll's record matches the W-L shown everywhere else in the app.
  const games = await prisma.game.findMany({
    where: { saveGameId, seasonYear, isPlayed: true, tournamentId: null },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });

  const results: ApPollGameResult[] = [];
  for (const g of games) {
    if (g.homeScore === null || g.awayScore === null) continue;
    if (divTeamIds.has(g.homeTeamId)) results.push({ teamId: g.homeTeamId, teamScore: g.homeScore, opponentScore: g.awayScore });
    if (divTeamIds.has(g.awayTeamId)) results.push({ teamId: g.awayTeamId, teamScore: g.awayScore, opponentScore: g.homeScore });
  }

  return computeApPoll(divTeams, results, 25);
}

// Snapshots each division's Top 25 as of `weekDate` — called only on Mondays
// from advanceOneDay, so the poll stays frozen between updates like a real
// one instead of drifting with every game the way KenPom/RPI do.
export async function updateApPollSnapshots(saveGameId: string, seasonYear: number, divisions: Division[], weekDate: Date): Promise<void> {
  for (const division of divisions) {
    const rankings = await computeDivisionApPoll(saveGameId, seasonYear, division);
    if (rankings.length === 0) continue;
    await prisma.pollSnapshot.upsert({
      where: { saveGameId_seasonYear_division_weekDate: { saveGameId, seasonYear, division, weekDate } },
      create: { id: randomUUID(), saveGameId, seasonYear, division, weekDate, rankingsJson: JSON.stringify(rankings) },
      update: { rankingsJson: JSON.stringify(rankings) },
    });
  }
}
