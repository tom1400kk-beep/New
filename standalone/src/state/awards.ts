import { computeStandings } from "./standings";
import { expectedWinPct } from "../engine/career";
import { computeSeasonAwards, prestigeDeltaForTeam, type AwardPlayerLine, type AwardCoachLine, type AwardResult } from "../engine/awards";
import { clamp } from "../engine/rng";
import { newId, type WorldState } from "./types";

// Called once per season, right as the regular season ends (see advance.ts's
// REGULAR_SEASON -> CONFERENCE_TOURNAMENT transition) — that's the one point
// every division's regular season has just finished simultaneously, so this
// can never double-run for a season.
export function computeAndApplySeasonAwards(state: WorldState, seasonYear: number): AwardResult[] {
  const teamById = new Map(state.teams.map((t) => [t.id, t]));
  const standings = computeStandings(state, seasonYear);

  const gameIdsThisSeason = new Set(state.games.filter((g) => g.seasonYear === seasonYear && g.isPlayed).map((g) => g.id));
  const statRows = state.stats.filter((s) => gameIdsThisSeason.has(s.gameId));

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

  const coachLines: AwardCoachLine[] = state.teams.map((t) => {
    const record = standings.get(t.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
    return { coachId: t.headCoachId, teamId: t.id, division: t.division, prestige: t.prestige, wins: record.wins, losses: record.losses };
  });

  const results = computeSeasonAwards(playerLines, coachLines, expectedWinPct);
  if (results.length === 0) return results;

  for (const r of results) {
    state.seasonAwards.push({
      id: newId(), seasonYear, type: r.type, division: r.division, conferenceId: r.conferenceId,
      playerId: r.playerId, coachId: r.coachId, teamId: r.teamId, createdAt: new Date(),
    });
  }

  // Bounded, once-per-season program-reputation nudge — see prestigeDeltaForTeam.
  const affectedTeamIds = new Set(results.map((r) => r.teamId));
  for (const teamId of affectedTeamIds) {
    const team = teamById.get(teamId);
    if (!team) continue;
    const delta = prestigeDeltaForTeam(results, teamId);
    if (delta > 0) team.prestige = clamp(team.prestige + delta, 1, 100);
  }

  // Coach of the Year gets its own reputation bump, on top of the team-level
  // prestige nudge above — a coach's national media profile rising is
  // distinct from the program's overall standing.
  const coachAwards = results.filter((r): r is AwardResult & { coachId: string } => r.type === "COACH_OF_YEAR" && r.coachId !== null);
  for (const award of coachAwards) {
    const coach = state.coaches.find((c) => c.id === award.coachId);
    if (!coach) continue;
    coach.nationalPerception = clamp(coach.nationalPerception + 10, 0, 100);
    coach.localPerception = clamp(coach.localPerception + 15, 0, 100);
  }

  return results;
}
