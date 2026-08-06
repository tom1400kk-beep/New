// End-of-regular-season honors: Player of the Year, Coach of the Year, and
// All-American teams per division (D1/D2/D3 each get their own, mirroring
// how real NCAA D2/D3 have their own major awards), plus All-Conference
// First/Second Team per conference. Pure computation over already-aggregated
// season data — no DB access here, see season/awards.ts for the orchestration
// that gathers the inputs and persists/applies the results.

export type AwardType =
  | "PLAYER_OF_YEAR"
  | "COACH_OF_YEAR"
  | "ALL_AMERICAN_FIRST"
  | "ALL_AMERICAN_SECOND"
  | "ALL_AMERICAN_THIRD"
  | "ALL_CONFERENCE_FIRST"
  | "ALL_CONFERENCE_SECOND";

export interface AwardPlayerLine {
  playerId: string;
  teamId: string;
  division: string;
  conferenceId: string;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
  gamesPlayed: number;
}

export interface AwardCoachLine {
  coachId: string;
  teamId: string;
  division: string;
  prestige: number;
  wins: number;
  losses: number;
}

export interface AwardResult {
  type: AwardType;
  division: string | null;
  conferenceId: string | null;
  playerId: string | null;
  coachId: string | null;
  teamId: string;
}

// Below this many games played, a hot-start outlier would otherwise sit
// atop the leaderboard — matches the qualifying bar real end-of-season
// awards use, and the spirit of the same threshold on the Stat Leaders page.
const MIN_GAMES_FOR_AWARDS = 10;
const DIVISIONS = ["D1", "D2", "D3"] as const;

function playerAwardScore(p: AwardPlayerLine): number {
  return p.ppg + p.rpg * 0.8 + p.apg * 0.9 + p.spg * 1.5 + p.bpg * 1.5 + (p.fgPct - 45) * 0.1;
}

export function computeSeasonAwards(
  players: AwardPlayerLine[],
  coaches: AwardCoachLine[],
  expectedWinPct: (prestige: number) => number,
): AwardResult[] {
  const results: AwardResult[] = [];
  const qualifiedPlayers = players.filter((p) => p.gamesPlayed >= MIN_GAMES_FOR_AWARDS);

  for (const division of DIVISIONS) {
    const divPlayers = qualifiedPlayers.filter((p) => p.division === division).sort((a, b) => playerAwardScore(b) - playerAwardScore(a));

    if (divPlayers.length > 0) {
      const poy = divPlayers[0];
      results.push({ type: "PLAYER_OF_YEAR", division, conferenceId: null, playerId: poy.playerId, coachId: null, teamId: poy.teamId });
    }

    const allAmericanTiers: { type: AwardType; start: number; end: number }[] = [
      { type: "ALL_AMERICAN_FIRST", start: 0, end: 5 },
      { type: "ALL_AMERICAN_SECOND", start: 5, end: 10 },
      { type: "ALL_AMERICAN_THIRD", start: 10, end: 15 },
    ];
    for (const tier of allAmericanTiers) {
      for (const p of divPlayers.slice(tier.start, tier.end)) {
        results.push({ type: tier.type, division, conferenceId: null, playerId: p.playerId, coachId: null, teamId: p.teamId });
      }
    }

    const divCoaches = coaches.filter((c) => c.division === division && c.wins + c.losses >= MIN_GAMES_FOR_AWARDS);
    if (divCoaches.length > 0) {
      // Rewards outperforming a team's prestige-based expectation, not just
      // the best record — otherwise this would always go to the blue-blood
      // with the best roster, matching how the real award actually works.
      const scored = divCoaches
        .map((c) => ({ c, diff: c.wins / Math.max(1, c.wins + c.losses) - expectedWinPct(c.prestige) }))
        .sort((a, b) => b.diff - a.diff);
      const coy = scored[0].c;
      results.push({ type: "COACH_OF_YEAR", division, conferenceId: null, playerId: null, coachId: coy.coachId, teamId: coy.teamId });
    }
  }

  const conferenceIds = [...new Set(qualifiedPlayers.map((p) => p.conferenceId))];
  for (const conferenceId of conferenceIds) {
    const confPlayers = qualifiedPlayers.filter((p) => p.conferenceId === conferenceId).sort((a, b) => playerAwardScore(b) - playerAwardScore(a));
    for (const p of confPlayers.slice(0, 5)) {
      results.push({ type: "ALL_CONFERENCE_FIRST", division: null, conferenceId, playerId: p.playerId, coachId: null, teamId: p.teamId });
    }
    for (const p of confPlayers.slice(5, 10)) {
      results.push({ type: "ALL_CONFERENCE_SECOND", division: null, conferenceId, playerId: p.playerId, coachId: null, teamId: p.teamId });
    }
  }

  return results;
}

// Bounded, once-per-season program-reputation nudge from the marquee awards
// (POY/All-American/COY) — All-Conference stays cosmetic-only since real
// All-Conference honors are common and don't singularly redefine a program's
// national reputation the way these do. Coaches get a separate perception
// bump (see season/awards.ts) on top of this team-level prestige effect.
export function prestigeDeltaForTeam(results: AwardResult[], teamId: string): number {
  let delta = 0;
  let allAmericanCount = 0;
  for (const r of results) {
    if (r.teamId !== teamId) continue;
    if (r.type === "PLAYER_OF_YEAR") delta += 3;
    else if (r.type === "COACH_OF_YEAR") delta += 2;
    else if (r.type === "ALL_AMERICAN_FIRST" || r.type === "ALL_AMERICAN_SECOND" || r.type === "ALL_AMERICAN_THIRD") allAmericanCount++;
  }
  delta += Math.min(4, allAmericanCount);
  return delta;
}
