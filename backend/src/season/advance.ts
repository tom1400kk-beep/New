import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { playGames } from "./playGames";
import { startConferenceTournaments, advanceTournamentRounds, startNationalTournaments } from "./postseason";
import { runOffseason } from "./offseason";
import { maybeGenerateEvent, type EventContext } from "../engine/events";
import { computeTeamChemistry } from "../engine/chemistry";
import { mulberry32 } from "../engine/rng";
import type { Division } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

async function allConferenceTournamentsComplete(saveGameId: string, seasonYear: number, division: Division): Promise<boolean> {
  const tournaments = await prisma.tournament.findMany({
    where: { saveGameId, seasonYear, division, type: "CONFERENCE_TOURNAMENT" },
    include: { games: true },
  });
  if (tournaments.length === 0) return true;
  return tournaments.every((t) => {
    const maxRound = Math.max(...t.games.map((g) => g.round ?? 1), 0);
    const finalRoundGames = t.games.filter((g) => (g.round ?? 1) === maxRound);
    return finalRoundGames.length === 1 && finalRoundGames[0].isPlayed;
  });
}

async function mainTournamentComplete(saveGameId: string, seasonYear: number, division: Division): Promise<boolean> {
  const type = division === "D1" ? "NCAA_TOURNAMENT" : division === "D2" ? "D2_NATIONAL" : "D3_NATIONAL";
  const tournament = await prisma.tournament.findFirst({
    where: { saveGameId, seasonYear, division, type },
    include: { games: true },
  });
  if (!tournament) return false;
  const maxRound = Math.max(...tournament.games.map((g) => g.round ?? 1), 0);
  const finalRoundGames = tournament.games.filter((g) => (g.round ?? 1) === maxRound);
  return finalRoundGames.length === 1 && finalRoundGames[0].isPlayed;
}

export interface AdvanceResult {
  gamesPlayedToday: number;
  newPhase: string;
  event: any | null;
  offseasonResult?: { userFired: boolean; jobOffers: { teamId: string; teamName: string; prestige: number }[] };
}

export async function advanceOneDay(saveGameId: string): Promise<AdvanceResult> {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: saveGameId } });
  const teams = await prisma.team.findMany({ where: { saveGameId }, take: 1 });
  const division = (teams[0]?.division ?? "D1") as Division;
  const seasonYear = save.currentSeasonYear;
  const today = save.currentDate;

  // 1. Play any games scheduled for today
  const todaysGames = await prisma.game.findMany({
    where: { saveGameId, isPlayed: false, date: today },
    select: { id: true },
  });
  await playGames(saveGameId, todaysGames.map((g) => g.id));

  // 2. Injury recovery ticks
  const injured = await prisma.player.findMany({ where: { saveGameId, isInjured: true } });
  for (const p of injured) {
    const weeksLeft = p.injuryWeeksLeft - 1;
    await prisma.player.update({
      where: { id: p.id },
      data: weeksLeft <= 0 ? { isInjured: false, injuryWeeksLeft: 0 } : { injuryWeeksLeft: weeksLeft },
    });
  }

  // 3. Random event roll for the user's team (only if nothing pending)
  let generatedEvent: any = null;
  if (save.coachTeamId) {
    const pendingCount = await prisma.gameEvent.count({ where: { saveGameId, status: "PENDING" } });
    if (pendingCount === 0) {
      const rosterPlayers = await prisma.player.findMany({
        where: { saveGameId, teamId: save.coachTeamId },
        select: { id: true, firstName: true, lastName: true, characterRating: true, scoring: true, countryOfOrigin: true },
      });
      const chemistry = computeTeamChemistry(rosterPlayers);
      const phase: EventContext["phase"] = save.currentPhase === "OFFSEASON" ? "OFFSEASON" : "IN_SEASON";
      const ctx: EventContext = { teamId: save.coachTeamId, players: rosterPlayers, chemistry, phase, recentWinPct: 0.5 };
      const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
      const ev = maybeGenerateEvent(rng, ctx);
      if (ev) {
        const row = await prisma.gameEvent.create({
          data: {
            id: randomUUID(), saveGameId, seasonYear, date: today, type: ev.type, title: ev.title,
            description: ev.description, teamId: save.coachTeamId, playerId: ev.playerId,
            status: "PENDING", optionsJson: JSON.stringify(ev.options),
          },
        });
        generatedEvent = row;
      }
    }
  }

  let phase = save.currentPhase;
  let nextDate = addDays(today, 1);
  let offseasonResult: AdvanceResult["offseasonResult"];

  if (phase === "PRESEASON") {
    const firstGame = await prisma.game.findFirst({ where: { saveGameId, seasonYear, tournamentId: null }, orderBy: { date: "asc" } });
    if (firstGame && nextDate.getTime() >= firstGame.date.getTime()) {
      phase = "REGULAR_SEASON";
    }
  } else if (phase === "REGULAR_SEASON") {
    const remaining = await prisma.game.count({ where: { saveGameId, seasonYear, tournamentId: null, isPlayed: false } });
    if (remaining === 0) {
      phase = "CONFERENCE_TOURNAMENT";
      await startConferenceTournaments(saveGameId, seasonYear, division, nextDate);
    }
  } else if (phase === "CONFERENCE_TOURNAMENT") {
    await advanceTournamentRounds(saveGameId, seasonYear, ["CONFERENCE_TOURNAMENT"], nextDate);
    if (await allConferenceTournamentsComplete(saveGameId, seasonYear, division)) {
      phase = "NCAA_TOURNAMENT";
      await startNationalTournaments(saveGameId, seasonYear, division, addDays(nextDate, 2));
      nextDate = addDays(nextDate, 2);
    }
  } else if (phase === "NCAA_TOURNAMENT" || phase === "NIT") {
    const types = division === "D1" ? (["NCAA_TOURNAMENT", "NIT"] as const) : division === "D2" ? (["D2_NATIONAL"] as const) : (["D3_NATIONAL"] as const);
    await advanceTournamentRounds(saveGameId, seasonYear, [...types], nextDate);
    if (await mainTournamentComplete(saveGameId, seasonYear, division)) {
      phase = "OFFSEASON";
      offseasonResult = await runOffseason(saveGameId);
      const updated = await prisma.saveGame.findUniqueOrThrow({ where: { id: saveGameId } });
      return {
        gamesPlayedToday: todaysGames.length,
        newPhase: updated.currentPhase,
        event: generatedEvent,
        offseasonResult,
      };
    }
  } else if (phase === "OFFSEASON") {
    // If the user was fired, coachTeamId is cleared and stays that way until they
    // accept a new job via POST /saves/:id/accept-job — hold here until then.
    const save2 = await prisma.saveGame.findUniqueOrThrow({ where: { id: saveGameId } });
    if (save2.coachTeamId) {
      phase = "PRESEASON";
    } else {
      nextDate = today; // don't burn calendar days while the user is unemployed
    }
  }

  await prisma.saveGame.update({ where: { id: saveGameId }, data: { currentDate: nextDate, currentPhase: phase } });

  return { gamesPlayedToday: todaysGames.length, newPhase: phase, event: generatedEvent, offseasonResult };
}
