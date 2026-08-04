import { computeApPoll, type ApPollTeamInput, type ApPollGameResult, type ApPollEntry } from "../engine/apPoll";
import { newId, type WorldState, type PollSnapshotRow } from "./types";
import type { Division } from "../types";

// Shared by the Monday snapshot job and the live-preview query fallback, so
// both compute a division's poll the exact same way.
export function computeDivisionApPoll(state: WorldState, seasonYear: number, division: Division): ApPollEntry[] {
  const divTeams: ApPollTeamInput[] = state.teams.filter((t) => t.division === division).map((t) => ({ teamId: t.id, prestige: t.prestige }));
  if (divTeams.length === 0) return [];
  const divTeamIds = new Set(divTeams.map((t) => t.teamId));

  // Same convention as RPI/standings elsewhere: regular-season games only, so
  // the poll's record matches the W-L shown everywhere else in the app.
  const games = state.games.filter((g) => g.seasonYear === seasonYear && g.isPlayed && g.tournamentId === null);

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
export function updateApPollSnapshots(state: WorldState, seasonYear: number, divisions: Division[], weekDate: Date): void {
  for (const division of divisions) {
    const rankings = computeDivisionApPoll(state, seasonYear, division);
    if (rankings.length === 0) continue;
    const existing = state.pollSnapshots.find(
      (p) => p.seasonYear === seasonYear && p.division === division && p.weekDate.getTime() === weekDate.getTime(),
    );
    const row: PollSnapshotRow = existing ?? { id: newId(), seasonYear, division, weekDate, rankingsJson: "" };
    row.rankingsJson = JSON.stringify(rankings);
    if (!existing) state.pollSnapshots.push(row);
  }
}
