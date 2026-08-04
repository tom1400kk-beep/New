import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { playGames } from "./playGames";
import { startConferenceTournaments, advanceTournamentRounds, startNationalTournaments } from "./postseason";
import { runOffseason } from "./offseason";
import { maybeGenerateEvent, type EventContext } from "../engine/events";
import { maybeGenerateMediaInterview, type MediaContext } from "../engine/media";
import { sortedPair } from "../engine/rivalry";
import { computeTeamChemistry } from "../engine/chemistry";
import { mulberry32 } from "../engine/rng";
import type { Division, TournamentType } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

async function allConferenceTournamentsCompleteForDivision(saveGameId: string, seasonYear: number, division: Division): Promise<boolean> {
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

async function mainTournamentCompleteForDivision(saveGameId: string, seasonYear: number, division: Division): Promise<boolean> {
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

async function allConferenceTournamentsComplete(saveGameId: string, seasonYear: number, divisions: Division[]): Promise<boolean> {
  for (const d of divisions) {
    if (!(await allConferenceTournamentsCompleteForDivision(saveGameId, seasonYear, d))) return false;
  }
  return true;
}

async function mainTournamentComplete(saveGameId: string, seasonYear: number, divisions: Division[]): Promise<boolean> {
  for (const d of divisions) {
    if (!(await mainTournamentCompleteForDivision(saveGameId, seasonYear, d))) return false;
  }
  return true;
}

function nationalTournamentTypesForDivision(division: Division): TournamentType[] {
  return division === "D1" ? ["NCAA_TOURNAMENT", "NIT"] : division === "D2" ? ["D2_NATIONAL"] : ["D3_NATIONAL"];
}

export interface AdvanceResult {
  gamesPlayedToday: number;
  newPhase: string;
  event: any | null;
  offseasonResult?: { userFired: boolean; jobOffers: { teamId: string; teamName: string; prestige: number }[] };
}

export async function advanceOneDay(saveGameId: string): Promise<AdvanceResult> {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: saveGameId } });
  const divisionRows = await prisma.team.findMany({ where: { saveGameId }, select: { division: true }, distinct: ["division"] });
  const divisions: Division[] = divisionRows.length > 0 ? (divisionRows.map((d) => d.division) as Division[]) : ["D1"];
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

  // 2b. Suspension countdown ticks
  const suspended = await prisma.player.findMany({ where: { saveGameId, isSuspended: true } });
  for (const p of suspended) {
    const daysLeft = p.suspensionDaysLeft - 1;
    await prisma.player.update({
      where: { id: p.id },
      data: daysLeft <= 0 ? { isSuspended: false, suspensionDaysLeft: 0 } : { suspensionDaysLeft: daysLeft },
    });
  }

  // 3. Media interview / random event roll for the user's team (only if nothing pending)
  let generatedEvent: any = null;
  if (save.coachTeamId) {
    const pendingCount = await prisma.gameEvent.count({ where: { saveGameId, status: "PENDING" } });
    if (pendingCount === 0) {
      const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
      let ev = null;

      // Media only shows up after a game the coach's own team actually played.
      const myGameToday = await prisma.game.findFirst({
        where: { saveGameId, isPlayed: true, date: today, OR: [{ homeTeamId: save.coachTeamId }, { awayTeamId: save.coachTeamId }] },
        include: { homeTeam: true, awayTeam: true },
      });
      if (myGameToday) {
        const isHome = myGameToday.homeTeamId === save.coachTeamId;
        const myTeam = isHome ? myGameToday.homeTeam : myGameToday.awayTeam;
        const oppTeam = isHome ? myGameToday.awayTeam : myGameToday.homeTeam;
        const myScore = (isHome ? myGameToday.homeScore : myGameToday.awayScore) ?? 0;
        const oppScore = (isHome ? myGameToday.awayScore : myGameToday.homeScore) ?? 0;
        const headCoach = await prisma.coach.findUnique({ where: { id: myTeam.headCoachId! }, select: { legalityReputation: true } });
        const [pairA, pairB] = sortedPair(myTeam.id, oppTeam.id);
        const rivalry = await prisma.rivalry.findFirst({ where: { saveGameId, teamAId: pairA, teamBId: pairB, active: true } });

        const recentGames = await prisma.game.findMany({
          where: { saveGameId, isPlayed: true, OR: [{ homeTeamId: save.coachTeamId }, { awayTeamId: save.coachTeamId }] },
          orderBy: { date: "desc" },
          take: 15,
        });
        let winStreak = 0, lossStreak = 0;
        for (const g of recentGames) {
          const won = (g.homeTeamId === save.coachTeamId ? (g.homeScore ?? 0) > (g.awayScore ?? 0) : (g.awayScore ?? 0) > (g.homeScore ?? 0));
          if (winStreak === 0 && lossStreak === 0) { won ? winStreak++ : lossStreak++; }
          else if (winStreak > 0 && won) winStreak++;
          else if (lossStreak > 0 && !won) lossStreak++;
          else break;
        }

        const mediaCtx: MediaContext = {
          opponentName: oppTeam.name, teamPrestige: myTeam.prestige, division: myTeam.division as Division,
          opponentPrestige: oppTeam.prestige, result: myScore > oppScore ? "WIN" : "LOSS", margin: myScore - oppScore,
          winStreak, lossStreak, isTournament: myGameToday.tournamentId !== null,
          isRivalry: !!rivalry, rivalryIntensity: rivalry?.intensity,
          legalityReputation: headCoach?.legalityReputation ?? 75,
        };
        ev = maybeGenerateMediaInterview(rng, mediaCtx);
      }

      if (!ev) {
        const rosterPlayers = await prisma.player.findMany({
          where: { saveGameId, teamId: save.coachTeamId },
          select: { id: true, firstName: true, lastName: true, characterRating: true, disciplineRating: true, scoring: true, countryOfOrigin: true },
        });
        const chemistry = computeTeamChemistry(rosterPlayers);
        const phase: EventContext["phase"] = save.currentPhase === "OFFSEASON" ? "OFFSEASON" : "IN_SEASON";
        const coachTeam = await prisma.team.findUnique({
          where: { id: save.coachTeamId },
          select: { headCoach: { select: { archetype: true, background: true } } },
        });
        const ctx: EventContext = {
          teamId: save.coachTeamId, players: rosterPlayers, chemistry, phase, recentWinPct: 0.5,
          coachArchetype: coachTeam?.headCoach?.archetype ?? null,
          coachBackground: coachTeam?.headCoach?.background ?? null,
        };
        ev = maybeGenerateEvent(rng, ctx);
      }

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
      for (const d of divisions) await startConferenceTournaments(saveGameId, seasonYear, d, nextDate);
    }
  } else if (phase === "CONFERENCE_TOURNAMENT") {
    await advanceTournamentRounds(saveGameId, seasonYear, ["CONFERENCE_TOURNAMENT"], nextDate);
    if (await allConferenceTournamentsComplete(saveGameId, seasonYear, divisions)) {
      phase = "NCAA_TOURNAMENT";
      for (const d of divisions) await startNationalTournaments(saveGameId, seasonYear, d, addDays(nextDate, 2));
      nextDate = addDays(nextDate, 2);
    }
  } else if (phase === "NCAA_TOURNAMENT" || phase === "NIT") {
    const types = divisions.flatMap(nationalTournamentTypesForDivision);
    await advanceTournamentRounds(saveGameId, seasonYear, types, nextDate);
    if (await mainTournamentComplete(saveGameId, seasonYear, divisions)) {
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
