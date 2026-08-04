import type { Division } from "../types";
import { DIVISION_RULES } from "../types";

export interface RealignmentTeam {
  id: string;
  name: string;
  conferenceId: string;
  division: Division;
  prestige: number;
}

export interface RealignmentConference {
  id: string;
  name: string;
  division: Division;
}

export interface RealignmentInvite {
  kind: "CONFERENCE_UPGRADE" | "DIVISION_PROMOTION";
  targetConferenceId: string;
  targetConferenceName: string;
  targetDivision: Division;
  replacingTeamId: string;
  replacingTeamName: string;
  reason: string;
}

function average(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((s, n) => s + n, 0) / nums.length;
}

const NEXT_DIVISION: Partial<Record<Division, Division>> = { D3: "D2", D2: "D1" };

// A great season can draw outside interest: a stronger conference in the same
// division inviting the team to jump (common enough to see a few times in a long
// career), or — in rare, special cases — an invite to reclassify up a whole
// division. Either way, the target conference has no open slot: the team joining
// replaces its current weakest member, who moves down into the vacancy being left
// behind. Mirrors real-world conference realignment, compressed to fit a season.
export function evaluateRealignmentInvite(
  team: RealignmentTeam,
  winPct: number,
  madeTournament: boolean,
  tournamentWins: number,
  allTeams: RealignmentTeam[],
  conferences: RealignmentConference[],
  rng: () => number
): RealignmentInvite | null {
  const strongSeason = winPct >= 0.7 || (madeTournament && tournamentWins >= 1);
  if (!strongSeason) return null;

  const conferenceGroups = (division: Division, excludeConferenceId?: string) => {
    const groups = new Map<string, RealignmentTeam[]>();
    for (const t of allTeams) {
      if (t.division !== division) continue;
      if (excludeConferenceId && t.conferenceId === excludeConferenceId) continue;
      if (!groups.has(t.conferenceId)) groups.set(t.conferenceId, []);
      groups.get(t.conferenceId)!.push(t);
    }
    return groups;
  };

  // Division promotion: gated hard — very high prestige, and rare even then.
  const nextDivision = NEXT_DIVISION[team.division];
  if (nextDivision && team.prestige >= 85 && rng() < 0.03) {
    const groups = conferenceGroups(nextDivision);
    const scored = [...groups.entries()]
      .map(([confId, teams]) => ({ confId, teams, avg: average(teams.map((t) => t.prestige)) }))
      .filter((g) => g.teams.length >= 4)
      .sort((a, b) => a.avg - b.avg);
    if (scored.length > 0) {
      const target = scored[0];
      const conf = conferences.find((c) => c.id === target.confId);
      const weakest = [...target.teams].sort((a, b) => a.prestige - b.prestige)[0];
      if (conf && weakest) {
        return {
          kind: "DIVISION_PROMOTION",
          targetConferenceId: conf.id,
          targetConferenceName: conf.name,
          targetDivision: nextDivision,
          replacingTeamId: weakest.id,
          replacingTeamName: weakest.name,
          reason: `A dominant, sustained run has ${nextDivision} programs taking notice — the ${conf.name} has extended a rare reclassification invite, with ${weakest.name} dropping down to make room.`,
        };
      }
    }
  }

  // Same-division conference upgrade: team is a clear prestige outlier in its
  // current conference and had a strong season, so a stronger conference comes calling.
  const currentConfMates = allTeams.filter((t) => t.conferenceId === team.conferenceId && t.id !== team.id);
  const currentConfAvg = currentConfMates.length > 0 ? average(currentConfMates.map((t) => t.prestige)) : team.prestige;
  if (team.prestige >= currentConfAvg + 15 && team.prestige >= 55 && rng() < 0.12) {
    const groups = conferenceGroups(team.division, team.conferenceId);
    const scored = [...groups.entries()]
      .map(([confId, teams]) => ({ confId, teams, avg: average(teams.map((t) => t.prestige)) }))
      .filter((g) => g.teams.length >= 4 && g.avg > currentConfAvg + 8 && g.avg <= team.prestige + 20)
      .sort((a, b) => a.avg - b.avg);
    if (scored.length > 0) {
      const target = scored[Math.floor(rng() * scored.length)];
      const conf = conferences.find((c) => c.id === target.confId);
      const weakest = [...target.teams].sort((a, b) => a.prestige - b.prestige)[0];
      if (conf && weakest) {
        return {
          kind: "CONFERENCE_UPGRADE",
          targetConferenceId: conf.id,
          targetConferenceName: conf.name,
          targetDivision: team.division,
          replacingTeamId: weakest.id,
          replacingTeamName: weakest.name,
          reason: `The program has clearly outgrown its current league — the ${conf.name} has invited a jump up, with ${weakest.name} moving down to make room.`,
        };
      }
    }
  }

  return null;
}

export interface ScholarshipPlayerInput {
  id: string;
  onScholarship: boolean;
  overallRating: number;
}

// A team dropping to a division with a lower (or zero) scholarship limit can't keep
// every scholarship it currently has out — trims down to the new cap by rating,
// same "who earns it" logic recruiting already uses. Never cuts a player outright;
// excess scholarship players just become walk-ons, same as any other roster-fit case.
export function normalizeScholarshipsForDivision(
  players: ScholarshipPlayerInput[],
  newDivision: Division
): Map<string, boolean> {
  const limit = DIVISION_RULES[newDivision].scholarshipLimit;
  const result = new Map<string, boolean>();
  const onScholarshipNow = players.filter((p) => p.onScholarship).sort((a, b) => b.overallRating - a.overallRating);
  onScholarshipNow.forEach((p, i) => result.set(p.id, i < limit));
  return result;
}
