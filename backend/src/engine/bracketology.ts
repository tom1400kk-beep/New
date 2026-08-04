// Projects the NCAA Tournament field "if the season ended today" — the same
// exercise real bracketologists run all season long, well before conference
// tournaments actually happen. Auto bids are approximated by each
// conference's current regular-season leader (the standard bracketology
// placeholder for "presumed conference tournament winner"); everyone else
// competes for at-large slots on a composite of KenPom and RPI rank, the
// same two families of metric real committees have leaned on historically.

export interface BracketTeamInput {
  teamId: string;
  name: string;
  conferenceId: string;
  wins: number;
  losses: number;
  confWins: number;
  confLosses: number;
  kenpomRank: number; // 1 = best
  rpiRank: number; // 1 = best
}

export interface BracketTeam {
  teamId: string;
  name: string;
  compositeRank: number;
  seedLine: number; // 1-16, 0 for bubble-watch entries not in the field
  region: string;
  isAutoBid: boolean;
  isFirstFour: boolean;
  wins: number;
  losses: number;
}

export interface BracketologyResult {
  field: BracketTeam[]; // up to 68 teams, sorted by seed line then region
  bubbleWatch: { firstFourOut: BracketTeam[]; nextFourOut: BracketTeam[] };
}

const REGIONS = ["East", "West", "South", "Midwest"];
const FIELD_SIZE = 68;

export function projectBracketology(teams: BracketTeamInput[]): BracketologyResult {
  if (teams.length === 0) return { field: [], bubbleWatch: { firstFourOut: [], nextFourOut: [] } };

  const compositeRankOf = new Map<string, number>();
  for (const t of teams) compositeRankOf.set(t.teamId, (t.kenpomRank + t.rpiRank) / 2);
  const rankOf = (id: string) => compositeRankOf.get(id)!;

  const sortedByComposite = [...teams].sort((a, b) => rankOf(a.teamId) - rankOf(b.teamId));

  // Projected auto bids: best conference win pct per conference, tiebroken
  // by composite rank — the placeholder for "presumed tournament champion."
  const byConference = new Map<string, BracketTeamInput[]>();
  for (const t of teams) {
    if (!byConference.has(t.conferenceId)) byConference.set(t.conferenceId, []);
    byConference.get(t.conferenceId)!.push(t);
  }
  const autoBidIds = new Set<string>();
  for (const confTeams of byConference.values()) {
    if (confTeams.length < 2) continue; // no real conference race to project
    const best = [...confTeams].sort((a, b) => {
      const aPct = a.confWins / Math.max(1, a.confWins + a.confLosses);
      const bPct = b.confWins / Math.max(1, b.confWins + b.confLosses);
      return bPct - aPct || rankOf(a.teamId) - rankOf(b.teamId);
    })[0];
    autoBidIds.add(best.teamId);
  }

  const atLargeCount = Math.max(0, FIELD_SIZE - autoBidIds.size);
  const atLargePool = sortedByComposite.filter((t) => !autoBidIds.has(t.teamId));
  const atLargeIds = new Set(atLargePool.slice(0, atLargeCount).map((t) => t.teamId));

  const fieldIds = new Set([...autoBidIds, ...atLargeIds]);
  const field = sortedByComposite.filter((t) => fieldIds.has(t.teamId));

  const bubbleRest = atLargePool.slice(atLargeCount);

  // First Four: the 4 lowest-ranked auto bids play into one 16-seed line;
  // the 4 lowest-ranked at-large teams play into one bubble seed line —
  // matches the real format's two distinct play-in pairings.
  const autoBidsSorted = field.filter((t) => autoBidIds.has(t.teamId)).sort((a, b) => rankOf(a.teamId) - rankOf(b.teamId));
  const atLargeSorted = field.filter((t) => atLargeIds.has(t.teamId)).sort((a, b) => rankOf(a.teamId) - rankOf(b.teamId));
  const firstFourIds = new Set([
    ...autoBidsSorted.slice(-4).map((t) => t.teamId),
    ...atLargeSorted.slice(-4).map((t) => t.teamId),
  ]);

  const toBracketTeam = (t: BracketTeamInput, seedLine: number, region: string): BracketTeam => ({
    teamId: t.teamId, name: t.name, compositeRank: Math.round(rankOf(t.teamId) * 10) / 10,
    seedLine, region, isAutoBid: autoBidIds.has(t.teamId), isFirstFour: firstFourIds.has(t.teamId),
    wins: t.wins, losses: t.losses,
  });

  // Seed lines: overall rank in the 68-team field maps to seed 1-16 (4 per
  // line, one per region), snake-assigned across regions each line so total
  // strength stays balanced — the same snake-draft idea used elsewhere for
  // seeding a balanced field.
  const bracketTeams: BracketTeam[] = field.map((t, i) => {
    const seedLine = Math.min(16, Math.floor(i / 4) + 1);
    const posInLine = i % 4;
    const regionIndex = seedLine % 2 === 1 ? posInLine : 3 - posInLine;
    return toBracketTeam(t, seedLine, REGIONS[regionIndex]);
  });

  const bubbleTeam = (t: BracketTeamInput) => toBracketTeam(t, 0, "");

  return {
    field: bracketTeams,
    bubbleWatch: {
      firstFourOut: bubbleRest.slice(0, 4).map(bubbleTeam),
      nextFourOut: bubbleRest.slice(4, 8).map(bubbleTeam),
    },
  };
}
