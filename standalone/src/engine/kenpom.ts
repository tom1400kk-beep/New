// KenPom-style adjusted efficiency ratings: possessions are estimated from
// the box score, then an iterative opponent-strength adjustment (the same
// idea real tempo-free rating systems use) converges each team's offensive
// and defensive efficiency to a number that accounts for who they actually
// played, not just raw scoring average.

export interface TeamGameBoxScore {
  gameId: string;
  teamId: string;
  points: number;
  opponentPoints: number;
  fga: number;
  fta: number;
  turnovers: number;
  rebounds: number;
}

export interface KenPomRating {
  teamId: string;
  adjO: number;
  adjD: number;
  adjEM: number;
  adjTempo: number;
  gamesPlayed: number;
}

// Real Division I offensive rebound rate on missed shots runs ~28-32% of a
// team's total boards; used to back out an offensive-rebound estimate since
// we only track total rebounds, not the off/def split.
const OREB_SHARE_OF_TOTAL_REBOUNDS = 0.3;
const ITERATIONS = 12;

// This engine's simulated box scores run lighter on volume (shot attempts,
// trips to the line, turnovers) than a real box score at the same pace, so
// the raw formula alone underestimates possessions — which would drag
// tempo, and by extension AdjO/AdjD, well outside real D1's numeric range
// (tempo ~66-70 per game, AdjO/AdjD ~95-120). This constant rescales the
// estimate to land in that real-world range without touching the sim itself.
const POSSESSION_CALIBRATION = 1.17;

function estimatePossessions(fga: number, fta: number, turnovers: number, rebounds: number): number {
  const estOreb = rebounds * OREB_SHARE_OF_TOTAL_REBOUNDS;
  return Math.max(1, (fga - estOreb + turnovers + 0.475 * fta) * POSSESSION_CALIBRATION);
}

interface GameRow {
  opponentId: string;
  poss: number;
  rawO: number;
  rawD: number;
}

export function computeKenPomRatings(boxScores: TeamGameBoxScore[]): Map<string, KenPomRating> {
  const byGame = new Map<string, TeamGameBoxScore[]>();
  for (const b of boxScores) {
    if (!byGame.has(b.gameId)) byGame.set(b.gameId, []);
    byGame.get(b.gameId)!.push(b);
  }

  const byTeam = new Map<string, GameRow[]>();
  for (const sides of byGame.values()) {
    if (sides.length !== 2) continue;
    const [a, b] = sides;
    const possA = estimatePossessions(a.fga, a.fta, a.turnovers, a.rebounds);
    const possB = estimatePossessions(b.fga, b.fta, b.turnovers, b.rebounds);
    const poss = (possA + possB) / 2;
    if (poss <= 0) continue;

    const rawOA = (a.points / poss) * 100;
    const rawDA = (a.opponentPoints / poss) * 100;
    const rawOB = (b.points / poss) * 100;
    const rawDB = (b.opponentPoints / poss) * 100;

    if (!byTeam.has(a.teamId)) byTeam.set(a.teamId, []);
    byTeam.get(a.teamId)!.push({ opponentId: b.teamId, poss, rawO: rawOA, rawD: rawDA });
    if (!byTeam.has(b.teamId)) byTeam.set(b.teamId, []);
    byTeam.get(b.teamId)!.push({ opponentId: a.teamId, poss, rawO: rawOB, rawD: rawDB });
  }

  const teamIds = [...byTeam.keys()];
  if (teamIds.length === 0) return new Map();

  const adjO = new Map<string, number>();
  const adjD = new Map<string, number>();
  const tempo = new Map<string, number>();

  let leagueAvgO = 0;
  let totalGames = 0;
  for (const [teamId, rows] of byTeam) {
    const avgO = rows.reduce((s, r) => s + r.rawO, 0) / rows.length;
    const avgD = rows.reduce((s, r) => s + r.rawD, 0) / rows.length;
    const avgT = rows.reduce((s, r) => s + r.poss, 0) / rows.length;
    adjO.set(teamId, avgO);
    adjD.set(teamId, avgD);
    tempo.set(teamId, avgT);
    leagueAvgO += avgO * rows.length;
    totalGames += rows.length;
  }
  leagueAvgO = totalGames > 0 ? leagueAvgO / totalGames : 100;
  let leagueAvgD = leagueAvgO; // league-wide, points scored == points allowed

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const newAdjO = new Map<string, number>();
    const newAdjD = new Map<string, number>();
    for (const [teamId, rows] of byTeam) {
      let sumO = 0;
      let sumD = 0;
      for (const r of rows) {
        const oppD = adjD.get(r.opponentId) ?? leagueAvgD;
        const oppO = adjO.get(r.opponentId) ?? leagueAvgO;
        sumO += r.rawO * (leagueAvgD / Math.max(1, oppD));
        sumD += r.rawD * (leagueAvgO / Math.max(1, oppO));
      }
      newAdjO.set(teamId, sumO / rows.length);
      newAdjD.set(teamId, sumD / rows.length);
    }
    for (const teamId of teamIds) {
      adjO.set(teamId, newAdjO.get(teamId)!);
      adjD.set(teamId, newAdjD.get(teamId)!);
    }
    leagueAvgO = teamIds.reduce((s, id) => s + adjO.get(id)!, 0) / teamIds.length;
    leagueAvgD = teamIds.reduce((s, id) => s + adjD.get(id)!, 0) / teamIds.length;
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const result = new Map<string, KenPomRating>();
  for (const teamId of teamIds) {
    const o = adjO.get(teamId)!;
    const d = adjD.get(teamId)!;
    result.set(teamId, {
      teamId,
      adjO: round1(o),
      adjD: round1(d),
      adjEM: round1(o - d),
      adjTempo: round1(tempo.get(teamId) ?? 68),
      gamesPlayed: byTeam.get(teamId)!.length,
    });
  }
  return result;
}
