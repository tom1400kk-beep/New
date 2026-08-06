import { Router } from "express";
import { prisma } from "../db";

export const statsRouter = Router();

// Below this many games played this season, a hot-start outlier (e.g. 30pts
// in a single early game) would otherwise sit atop the leaderboard — matches
// the threshold spirit of real "qualified" statistical leader lists.
const MIN_GAMES_PLAYED = 5;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// League-wide per-game stat leaders for the save's current season, aggregated
// from every PlayerGameStat row generated so far (see playGames.ts). Returns
// one row per qualifying player with every average computed — the frontend
// sorts/slices by whichever category tab is active rather than us precomputing
// five separate top-N lists server-side.
statsRouter.get("/saves/:id/stat-leaders", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });

  const statRows = await prisma.playerGameStat.findMany({
    where: { game: { saveGameId: save.id, seasonYear: save.currentSeasonYear, isPlayed: true } },
    include: { player: { select: { firstName: true, lastName: true, position: true, classYear: true } } },
  });

  const byPlayer = new Map<string, typeof statRows>();
  for (const row of statRows) {
    if (!byPlayer.has(row.playerId)) byPlayer.set(row.playerId, []);
    byPlayer.get(row.playerId)!.push(row);
  }

  const teamIds = [...new Set(statRows.map((r) => r.teamId))];
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } });
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  const sum = (rows: typeof statRows, key: "points" | "rebounds" | "assists" | "steals" | "blocks" | "fgm" | "fga") =>
    rows.reduce((s, r) => s + r[key], 0);

  const players = [...byPlayer.entries()]
    .map(([playerId, rows]) => {
      const n = rows.length;
      const first = rows[0];
      const fgm = sum(rows, "fgm");
      const fga = sum(rows, "fga");
      return {
        playerId,
        name: `${first.player.firstName} ${first.player.lastName}`,
        position: first.player.position,
        classYear: first.player.classYear,
        teamId: first.teamId,
        teamName: teamNameById.get(first.teamId) ?? "—",
        gamesPlayed: n,
        ppg: round1(sum(rows, "points") / n),
        rpg: round1(sum(rows, "rebounds") / n),
        apg: round1(sum(rows, "assists") / n),
        spg: round1(sum(rows, "steals") / n),
        bpg: round1(sum(rows, "blocks") / n),
        fgPct: fga > 0 ? round1((fgm / fga) * 100) : 0,
      };
    })
    .filter((p) => p.gamesPlayed >= MIN_GAMES_PLAYED);

  res.json({ seasonYear: save.currentSeasonYear, minGamesPlayed: MIN_GAMES_PLAYED, players });
});
