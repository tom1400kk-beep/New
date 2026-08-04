import { Router } from "express";
import { prisma } from "../db";
import { computeStandings } from "../season/standings";
import { computeKenPomRatings } from "../engine/kenpom";
import { computeRPI } from "../engine/rpi";
import { computeGameOdds, type OddsTeamInput } from "../engine/gameOdds";
import { overall, type SimPlayer } from "../engine/simulate";
import { aggregateCareerStats, type RawGameStatLine } from "../engine/careerStats";
import { d1Teams, buildKenPomBoxScores, buildRPIResults } from "./rankings";

export const gamePreviewRouter = Router();

gamePreviewRouter.get("/saves/:id/games/:gameId/preview", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: req.params.gameId },
    include: { homeTeam: true, awayTeam: true, tournament: true },
  });
  if (game.saveGameId !== save.id) return res.status(400).json({ error: "Game not in this save" });

  const standings = await computeStandings(save.id, save.currentSeasonYear);
  const homeRecord = standings.get(game.homeTeamId) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
  const awayRecord = standings.get(game.awayTeamId) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };

  // KenPom/RPI are D1-only, computed league-wide (like the Standings page)
  // so a given team's number here always matches what's shown there.
  const kenpomByTeam = new Map<string, { rank: number; adjEM: number; adjO: number; adjD: number; adjTempo: number }>();
  const rpiByTeam = new Map<string, { rank: number; rpi: number }>();
  if (game.homeTeam.division === "D1" && game.awayTeam.division === "D1") {
    const teams = await d1Teams(save.id);
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const [boxScores, rpiResults] = await Promise.all([
      buildKenPomBoxScores(save.id, save.currentSeasonYear),
      buildRPIResults(save.id, save.currentSeasonYear),
    ]);
    const kenpom = computeKenPomRatings(boxScores.filter((b) => teamById.has(b.teamId)));
    const rpi = computeRPI(rpiResults.filter((r) => teamById.has(r.teamId)));

    [...kenpom.values()].sort((a, b) => b.adjEM - a.adjEM).forEach((r, i) => {
      kenpomByTeam.set(r.teamId, { rank: i + 1, adjEM: r.adjEM, adjO: r.adjO, adjD: r.adjD, adjTempo: r.adjTempo });
    });
    [...rpi.values()].sort((a, b) => b.rpi - a.rpi).forEach((r, i) => {
      rpiByTeam.set(r.teamId, { rank: i + 1, rpi: r.rpi });
    });
  }

  // Rosters for the starting lineup + injury report — same "healthy top 5 by
  // overall" the game sim itself will actually field (see buildRotation).
  const roster = await prisma.player.findMany({
    where: { teamId: { in: [game.homeTeamId, game.awayTeamId] } },
    select: {
      id: true, teamId: true, firstName: true, lastName: true, position: true, classYear: true,
      scoring: true, threePoint: true, finishing: true, playmaking: true, rebounding: true, defense: true,
      athleticism: true, basketballIq: true, characterRating: true,
      isInjured: true, injuryWeeksLeft: true, injuryType: true, isSuspended: true, suspensionDaysLeft: true,
    },
  });

  const statRows = await prisma.playerGameStat.findMany({
    where: { playerId: { in: roster.map((p) => p.id) } },
    include: { game: { select: { seasonYear: true } } },
  });
  const statsByPlayer = new Map<string, RawGameStatLine[]>();
  for (const row of statRows) {
    if (!statsByPlayer.has(row.playerId)) statsByPlayer.set(row.playerId, []);
    statsByPlayer.get(row.playerId)!.push({ seasonYear: row.game.seasonYear, ...row });
  }

  function seasonLineFor(playerId: string) {
    const lines = aggregateCareerStats(statsByPlayer.get(playerId) ?? []);
    return lines.find((l) => l.seasonYear === save.currentSeasonYear) ?? null;
  }

  function rosterPayload(teamId: string) {
    const teamRoster = roster.filter((p) => p.teamId === teamId);
    const eligible = teamRoster.filter((p) => !p.isInjured && !p.isSuspended);
    const starters = [...eligible]
      .sort((a, b) => overall(b as unknown as SimPlayer) - overall(a as unknown as SimPlayer))
      .slice(0, 5)
      .map((p) => {
        const line = seasonLineFor(p.id);
        return {
          playerId: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position, classYear: p.classYear,
          overall: overall(p as unknown as SimPlayer),
          ppg: line?.ppg ?? null, rpg: line?.rpg ?? null, apg: line?.apg ?? null,
        };
      });
    const injuryReport = teamRoster
      .filter((p) => p.isInjured || p.isSuspended)
      .map((p) => ({
        playerId: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position,
        status: p.isSuspended ? "Suspended" : "Injured",
        detail: p.isSuspended ? `${p.suspensionDaysLeft}d left` : `${p.injuryType ?? "Injury"} · ${p.injuryWeeksLeft}d left`,
      }));
    return { starters, injuryReport };
  }

  function teamPayload(team: typeof game.homeTeam, record: { wins: number; losses: number; confWins: number; confLosses: number }) {
    const { starters, injuryReport } = rosterPayload(team.id);
    return {
      teamId: team.id, name: team.name, division: team.division, prestige: team.prestige,
      record, gamesPlayed: record.wins + record.losses,
      kenpom: kenpomByTeam.get(team.id) ?? null,
      rpi: rpiByTeam.get(team.id) ?? null,
      startingLineup: starters,
      injuryReport,
    };
  }

  const homePayload = teamPayload(game.homeTeam, homeRecord);
  const awayPayload = teamPayload(game.awayTeam, awayRecord);

  const homeOddsInput: OddsTeamInput = { prestige: game.homeTeam.prestige, kenpomAdjEM: homePayload.kenpom?.adjEM ?? null, gamesPlayed: homePayload.gamesPlayed };
  const awayOddsInput: OddsTeamInput = { prestige: game.awayTeam.prestige, kenpomAdjEM: awayPayload.kenpom?.adjEM ?? null, gamesPlayed: awayPayload.gamesPlayed };
  const odds = computeGameOdds(homeOddsInput, awayOddsInput);

  res.json({
    gameId: game.id, date: game.date, isConference: game.isConference,
    tournament: game.tournament ? { type: game.tournament.type, name: game.tournament.name } : null,
    homeTeam: homePayload, awayTeam: awayPayload, odds,
  });
});
