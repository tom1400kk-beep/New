export interface RawGameStatLine {
  seasonYear: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  threepm: number;
  threepa: number;
  ftm: number;
  fta: number;
}

export interface CareerSeasonLine {
  seasonYear: number;
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  mpg: number;
  fgPct: number;
  threePct: number;
  ftPct: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Groups raw box-score rows into real per-season averages — the actual
// on-court production a transfer-portal player put up at their old school,
// not just their scouted ratings.
export function aggregateCareerStats(rows: RawGameStatLine[]): CareerSeasonLine[] {
  const bySeason = new Map<number, RawGameStatLine[]>();
  for (const r of rows) {
    if (!bySeason.has(r.seasonYear)) bySeason.set(r.seasonYear, []);
    bySeason.get(r.seasonYear)!.push(r);
  }

  const sum = (games: RawGameStatLine[], key: keyof RawGameStatLine) => games.reduce((s, g) => s + g[key], 0);

  const lines: CareerSeasonLine[] = [];
  for (const [seasonYear, games] of bySeason) {
    const n = games.length;
    if (n === 0) continue;
    const totalFgm = sum(games, "fgm"), totalFga = sum(games, "fga");
    const total3pm = sum(games, "threepm"), total3pa = sum(games, "threepa");
    const totalFtm = sum(games, "ftm"), totalFta = sum(games, "fta");
    lines.push({
      seasonYear,
      gamesPlayed: n,
      ppg: round1(sum(games, "points") / n),
      rpg: round1(sum(games, "rebounds") / n),
      apg: round1(sum(games, "assists") / n),
      spg: round1(sum(games, "steals") / n),
      bpg: round1(sum(games, "blocks") / n),
      topg: round1(sum(games, "turnovers") / n),
      mpg: round1(sum(games, "minutes") / n),
      fgPct: totalFga > 0 ? round1((totalFgm / totalFga) * 100) : 0,
      threePct: total3pa > 0 ? round1((total3pm / total3pa) * 100) : 0,
      ftPct: totalFta > 0 ? round1((totalFtm / totalFta) * 100) : 0,
    });
  }

  return lines.sort((a, b) => b.seasonYear - a.seasonYear);
}
