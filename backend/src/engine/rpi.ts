// Standard NCAA-style RPI: RPI = 0.25*WP + 0.50*OWP + 0.25*OOWP, computed in
// three passes (each level depends on the one before it). OWP excludes games
// against the team in question when averaging an opponent's win percentage —
// the standard refinement that keeps a team's own results from inflating its
// own strength-of-schedule number.

export interface RPIGameResult {
  teamId: string;
  opponentId: string;
  won: boolean;
}

export interface RPIRating {
  teamId: string;
  rpi: number;
  wp: number;
  owp: number;
  oowp: number;
  wins: number;
  losses: number;
}

export function computeRPI(results: RPIGameResult[]): Map<string, RPIRating> {
  const byTeam = new Map<string, RPIGameResult[]>();
  for (const r of results) {
    if (!byTeam.has(r.teamId)) byTeam.set(r.teamId, []);
    byTeam.get(r.teamId)!.push(r);
  }
  const teamIds = [...byTeam.keys()];

  const wp = new Map<string, number>();
  const winsMap = new Map<string, number>();
  const lossesMap = new Map<string, number>();
  for (const teamId of teamIds) {
    const games = byTeam.get(teamId)!;
    const wins = games.filter((g) => g.won).length;
    winsMap.set(teamId, wins);
    lossesMap.set(teamId, games.length - wins);
    wp.set(teamId, games.length > 0 ? wins / games.length : 0);
  }

  // OWP: for each of a team's games, that opponent's win pct excluding any
  // games played against the team in question.
  const owp = new Map<string, number>();
  for (const teamId of teamIds) {
    const games = byTeam.get(teamId)!;
    if (games.length === 0) { owp.set(teamId, 0); continue; }
    let sum = 0;
    for (const g of games) {
      const oppGames = byTeam.get(g.opponentId) ?? [];
      const gamesVsTeam = oppGames.filter((og) => og.opponentId === teamId);
      const winsVsTeam = gamesVsTeam.filter((og) => og.won).length;
      const adjWins = oppGames.filter((og) => og.won).length - winsVsTeam;
      const adjGames = oppGames.length - gamesVsTeam.length;
      sum += adjGames > 0 ? adjWins / adjGames : (wp.get(g.opponentId) ?? 0);
    }
    owp.set(teamId, sum / games.length);
  }

  // OOWP: average of each opponent's own OWP.
  const oowp = new Map<string, number>();
  for (const teamId of teamIds) {
    const games = byTeam.get(teamId)!;
    if (games.length === 0) { oowp.set(teamId, 0); continue; }
    const sum = games.reduce((s, g) => s + (owp.get(g.opponentId) ?? 0), 0);
    oowp.set(teamId, sum / games.length);
  }

  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  const result = new Map<string, RPIRating>();
  for (const teamId of teamIds) {
    const rpi = 0.25 * wp.get(teamId)! + 0.5 * owp.get(teamId)! + 0.25 * oowp.get(teamId)!;
    result.set(teamId, {
      teamId, rpi: round3(rpi), wp: round3(wp.get(teamId)!), owp: round3(owp.get(teamId)!), oowp: round3(oowp.get(teamId)!),
      wins: winsMap.get(teamId)!, losses: lossesMap.get(teamId)!,
    });
  }
  return result;
}
