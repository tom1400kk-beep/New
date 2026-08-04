import { clamp } from "./rng";

export interface ApPollTeamInput {
  teamId: string;
  prestige: number;
}

export interface ApPollGameResult {
  teamId: string;
  teamScore: number;
  opponentScore: number;
}

export interface ApPollEntry {
  rank: number;
  teamId: string;
  wins: number;
  losses: number;
  score: number;
}

// Before any games are played, a poll reflects preseason expectations (prestige)
// rather than results — same as the real AP preseason poll. Once a team has
// games on the board, record + scoring margin take over, with a small
// prestige nudge left in as a tiebreaker (name recognition still matters a
// little to real voters even mid-season).
export function computeApPoll(teams: ApPollTeamInput[], games: ApPollGameResult[], limit = 25): ApPollEntry[] {
  const recordByTeam = new Map<string, { wins: number; losses: number; marginSum: number; gp: number }>();
  for (const t of teams) recordByTeam.set(t.teamId, { wins: 0, losses: 0, marginSum: 0, gp: 0 });
  for (const g of games) {
    const rec = recordByTeam.get(g.teamId);
    if (!rec) continue;
    if (g.teamScore > g.opponentScore) rec.wins++; else rec.losses++;
    rec.marginSum += g.teamScore - g.opponentScore;
    rec.gp++;
  }

  const scored = teams.map((t) => {
    const rec = recordByTeam.get(t.teamId)!;
    const score = rec.gp === 0
      ? t.prestige
      : (rec.wins / rec.gp) * 100 + clamp(rec.marginSum / rec.gp, -20, 20) + t.prestige * 0.05;
    return { teamId: t.teamId, wins: rec.wins, losses: rec.losses, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s, i) => ({ rank: i + 1, ...s }));
}
