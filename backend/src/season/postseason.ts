import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import type { Division, TournamentType } from "../types";
import { buildFirstRound, buildNextRound, type ResumeTeam, selectTournamentField, seedField } from "../engine/postseason";
import { computeStandings, confWinPct, winPct } from "./standings";

function prevPowerOfTwo(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

async function createBracketGames(
  saveGameId: string,
  seasonYear: number,
  tournamentId: string,
  round: number,
  matchups: { slot: number; teamA: string | null; teamB: string | null }[],
  date: Date,
): Promise<void> {
  const rows = matchups
    .filter((m) => m.teamA && m.teamB) // both real teams thanks to power-of-two field sizing
    .map((m) => ({
      id: randomUUID(),
      saveGameId,
      seasonYear,
      date,
      homeTeamId: m.teamA!,
      awayTeamId: m.teamB!,
      isConference: false,
      isPlayed: false,
      tournamentId,
      round,
      bracketSlot: m.slot,
    }));
  if (rows.length > 0) await prisma.game.createMany({ data: rows });
}

export async function startConferenceTournaments(
  saveGameId: string,
  seasonYear: number,
  division: Division,
  startDate: Date,
): Promise<void> {
  const conferences = await prisma.conference.findMany({ where: { saveGameId, division }, include: { teams: true } });
  const standings = await computeStandings(saveGameId, seasonYear);

  for (const conf of conferences) {
    if (conf.teams.length < 2) continue;
    const fieldSize = Math.max(2, prevPowerOfTwo(Math.min(conf.teams.length, 16)));
    const ranked = [...conf.teams].sort((a, b) => {
      const ra = standings.get(a.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      const rb = standings.get(b.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      return confWinPct(rb) - confWinPct(ra) || winPct(rb) - winPct(ra) || b.prestige - a.prestige;
    });
    const field = ranked.slice(0, fieldSize);

    const tournament = await prisma.tournament.create({
      data: { id: randomUUID(), saveGameId, seasonYear, type: "CONFERENCE_TOURNAMENT" as TournamentType, division, conferenceId: conf.id },
    });

    const seeds = field.map((t, i) => ({ teamId: t.id, seed: i + 1 }));
    const matchups = buildFirstRound(seeds);
    await createBracketGames(saveGameId, seasonYear, tournament.id, 1, matchups, startDate);
  }
}

// Advance every in-progress tournament of the given type(s) whose current round just finished.
// Returns the list of tournament ids that just crowned a champion.
export async function advanceTournamentRounds(
  saveGameId: string,
  seasonYear: number,
  types: TournamentType[],
  nextRoundDate: Date,
): Promise<{ finishedTournamentIds: string[] }> {
  const tournaments = await prisma.tournament.findMany({
    where: { saveGameId, seasonYear, type: { in: types } },
    include: { games: true },
  });

  const finished: string[] = [];

  for (const t of tournaments) {
    const rounds = new Map<number, typeof t.games>();
    for (const g of t.games) {
      const r = g.round ?? 1;
      if (!rounds.has(r)) rounds.set(r, []);
      rounds.get(r)!.push(g);
    }
    const currentRound = Math.max(...[...rounds.keys()], 0);
    if (currentRound === 0) continue;
    const currentGames = rounds.get(currentRound)!;
    const allPlayed = currentGames.every((g) => g.isPlayed);
    if (!allPlayed) continue;

    if (currentGames.length === 1) {
      // championship game just completed
      finished.push(t.id);
      continue;
    }

    const bySlot = [...currentGames].sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0));
    const winners = bySlot.map((g) => ((g.homeScore ?? 0) > (g.awayScore ?? 0) ? g.homeTeamId : g.awayTeamId));
    const nextMatchups = buildNextRound(currentRound, winners);
    await createBracketGames(saveGameId, seasonYear, t.id, currentRound + 1, nextMatchups, nextRoundDate);
  }

  return { finishedTournamentIds: finished };
}

export async function getConferenceChampions(saveGameId: string, seasonYear: number, division: Division): Promise<Map<string, string>> {
  // conferenceId -> championTeamId
  const tournaments = await prisma.tournament.findMany({
    where: { saveGameId, seasonYear, division, type: "CONFERENCE_TOURNAMENT" },
    include: { games: true },
  });
  const champs = new Map<string, string>();
  for (const t of tournaments) {
    const maxRound = Math.max(...t.games.map((g) => g.round ?? 1), 0);
    const finalGame = t.games.find((g) => (g.round ?? 1) === maxRound);
    if (finalGame && finalGame.isPlayed && finalGame.homeScore !== null && finalGame.awayScore !== null && t.conferenceId) {
      champs.set(t.conferenceId, finalGame.homeScore > finalGame.awayScore ? finalGame.homeTeamId : finalGame.awayTeamId);
    }
  }
  return champs;
}

export async function startNationalTournaments(
  saveGameId: string,
  seasonYear: number,
  division: Division,
  startDate: Date,
): Promise<void> {
  const teams = await prisma.team.findMany({ where: { saveGameId, division } });
  const standings = await computeStandings(saveGameId, seasonYear);
  const champsByConf = await getConferenceChampions(saveGameId, seasonYear, division);
  const championTeamIds = new Set(champsByConf.values());

  const resumeTeams: ResumeTeam[] = teams.map((t) => {
    const r = standings.get(t.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
    return {
      teamId: t.id,
      conferenceId: t.conferenceId,
      wins: r.wins,
      losses: r.losses,
      prestige: t.prestige,
      isConferenceChampion: championTeamIds.has(t.id),
    };
  });

  if (division === "D1") {
    // Simplified from the real 68-team field (no First Four play-in round): a clean
    // 64-team bracket of auto bids + best at-large teams by resume score.
    const { field: mainField } = selectTournamentField(resumeTeams, 64);
    const usedIds = new Set(mainField.map((t) => t.teamId));
    const remaining = resumeTeams.filter((t) => !usedIds.has(t.teamId)).sort((a, b) => {
      const ga = a.wins + a.losses || 1, gb = b.wins + b.losses || 1;
      return (b.wins / gb) * 100 + b.prestige * 0.35 - ((a.wins / ga) * 100 + a.prestige * 0.35);
    });

    const ncaaTournament = await prisma.tournament.create({
      data: { id: randomUUID(), saveGameId, seasonYear, type: "NCAA_TOURNAMENT", division },
    });

    const seeds = seedField(mainField);
    const matchups = buildFirstRound(seeds);
    await createBracketGames(saveGameId, seasonYear, ncaaTournament.id, 1, matchups, startDate);

    const nitPoolAll = remaining.slice(0, 32);
    if (nitPoolAll.length >= 4) {
      const nitTournament = await prisma.tournament.create({
        data: { id: randomUUID(), saveGameId, seasonYear, type: "NIT", division },
      });
      const size = prevPowerOfTwo(nitPoolAll.length);
      const seeds = nitPoolAll.slice(0, size).map((t, i) => ({ teamId: t.teamId, seed: i + 1 }));
      const matchups = buildFirstRound(seeds);
      await createBracketGames(saveGameId, seasonYear, nitTournament.id, 1, matchups, startDate);
    }
  } else {
    const type: TournamentType = division === "D2" ? "D2_NATIONAL" : "D3_NATIONAL";
    const { field } = selectTournamentField(resumeTeams, 64);
    const size = prevPowerOfTwo(field.length);
    const tournament = await prisma.tournament.create({
      data: { id: randomUUID(), saveGameId, seasonYear, type, division },
    });
    const seeds = field.slice(0, size).map((t, i) => ({ teamId: t.teamId, seed: i + 1 }));
    const matchups = buildFirstRound(seeds);
    await createBracketGames(saveGameId, seasonYear, tournament.id, 1, matchups, startDate);
  }
}
