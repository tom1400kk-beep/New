import { playGames } from "./playGames";
import { startConferenceTournaments, advanceTournamentRounds, startNationalTournaments } from "./postseason";
import { runOffseason, type OffseasonResult } from "./offseason";
import { maybeGenerateEvent, type EventContext } from "../engine/events";
import { computeTeamChemistry } from "../engine/chemistry";
import { mulberry32 } from "../engine/rng";
import type { Division } from "../types";
import { newId, type WorldState, type GameEventRow } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

function allConferenceTournamentsComplete(state: WorldState, seasonYear: number, division: Division): boolean {
  const tournaments = state.tournaments.filter((t) => t.seasonYear === seasonYear && t.division === division && t.type === "CONFERENCE_TOURNAMENT");
  if (tournaments.length === 0) return true;
  return tournaments.every((t) => {
    const games = state.games.filter((g) => g.tournamentId === t.id);
    const maxRound = Math.max(...games.map((g) => g.round ?? 1), 0);
    const finalRoundGames = games.filter((g) => (g.round ?? 1) === maxRound);
    return finalRoundGames.length === 1 && finalRoundGames[0].isPlayed;
  });
}

function mainTournamentComplete(state: WorldState, seasonYear: number, division: Division): boolean {
  const type = division === "D1" ? "NCAA_TOURNAMENT" : division === "D2" ? "D2_NATIONAL" : "D3_NATIONAL";
  const tournament = state.tournaments.find((t) => t.seasonYear === seasonYear && t.division === division && t.type === type);
  if (!tournament) return false;
  const games = state.games.filter((g) => g.tournamentId === tournament.id);
  const maxRound = Math.max(...games.map((g) => g.round ?? 1), 0);
  const finalRoundGames = games.filter((g) => (g.round ?? 1) === maxRound);
  return finalRoundGames.length === 1 && finalRoundGames[0].isPlayed;
}

export interface AdvanceResult {
  gamesPlayedToday: number;
  newPhase: string;
  event: GameEventRow | null;
  offseasonResult?: OffseasonResult;
}

export function advanceOneDay(state: WorldState): AdvanceResult {
  const division = (state.teams[0]?.division ?? "D1") as Division;
  const seasonYear = state.save.currentSeasonYear;
  const today = state.save.currentDate;

  const todaysGames = state.games.filter((g) => !g.isPlayed && g.date.getTime() === today.getTime());
  playGames(state, todaysGames.map((g) => g.id));

  for (const p of state.players) {
    if (!p.isInjured) continue;
    const weeksLeft = p.injuryWeeksLeft - 1;
    if (weeksLeft <= 0) { p.isInjured = false; p.injuryWeeksLeft = 0; } else { p.injuryWeeksLeft = weeksLeft; }
  }

  let generatedEvent: GameEventRow | null = null;
  if (state.save.coachTeamId) {
    const pendingCount = state.events.filter((e) => e.status === "PENDING").length;
    if (pendingCount === 0) {
      const rosterPlayers = state.players
        .filter((p) => p.teamId === state.save.coachTeamId)
        .map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, characterRating: p.characterRating, scoring: p.scoring, countryOfOrigin: p.countryOfOrigin }));
      const chemistry = computeTeamChemistry(rosterPlayers);
      const phase: EventContext["phase"] = state.save.currentPhase === "OFFSEASON" ? "OFFSEASON" : "IN_SEASON";
      const ctx: EventContext = { teamId: state.save.coachTeamId, players: rosterPlayers, chemistry, phase, recentWinPct: 0.5 };
      const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
      const ev = maybeGenerateEvent(rng, ctx);
      if (ev) {
        const row: GameEventRow = {
          id: newId(), seasonYear, date: today, type: ev.type, title: ev.title, description: ev.description,
          teamId: state.save.coachTeamId, playerId: ev.playerId, status: "PENDING",
          optionsJson: JSON.stringify(ev.options), chosenOptionId: null,
        };
        state.events.push(row);
        generatedEvent = row;
      }
    }
  }

  let phase = state.save.currentPhase;
  let nextDate = addDays(today, 1);
  let offseasonResult: OffseasonResult | undefined;

  if (phase === "PRESEASON") {
    const nonTournamentGames = state.games.filter((g) => g.seasonYear === seasonYear && g.tournamentId === null);
    const firstGame = nonTournamentGames.reduce<Date | null>((min, g) => (min === null || g.date < min ? g.date : min), null);
    if (firstGame && nextDate.getTime() >= firstGame.getTime()) phase = "REGULAR_SEASON";
  } else if (phase === "REGULAR_SEASON") {
    const remaining = state.games.filter((g) => g.seasonYear === seasonYear && g.tournamentId === null && !g.isPlayed).length;
    if (remaining === 0) {
      phase = "CONFERENCE_TOURNAMENT";
      startConferenceTournaments(state, seasonYear, division, nextDate);
    }
  } else if (phase === "CONFERENCE_TOURNAMENT") {
    advanceTournamentRounds(state, seasonYear, ["CONFERENCE_TOURNAMENT"], nextDate);
    if (allConferenceTournamentsComplete(state, seasonYear, division)) {
      phase = "NCAA_TOURNAMENT";
      startNationalTournaments(state, seasonYear, division, addDays(nextDate, 2));
      nextDate = addDays(nextDate, 2);
    }
  } else if (phase === "NCAA_TOURNAMENT" || phase === "NIT") {
    const types = division === "D1" ? (["NCAA_TOURNAMENT", "NIT"] as const) : division === "D2" ? (["D2_NATIONAL"] as const) : (["D3_NATIONAL"] as const);
    advanceTournamentRounds(state, seasonYear, [...types], nextDate);
    if (mainTournamentComplete(state, seasonYear, division)) {
      phase = "OFFSEASON";
      offseasonResult = runOffseason(state);
      return { gamesPlayedToday: todaysGames.length, newPhase: state.save.currentPhase, event: generatedEvent, offseasonResult };
    }
  } else if (phase === "OFFSEASON") {
    if (state.save.coachTeamId) phase = "PRESEASON";
    else nextDate = today;
  }

  state.save.currentDate = nextDate;
  state.save.currentPhase = phase;
  state.save.updatedAt = new Date();

  return { gamesPlayedToday: todaysGames.length, newPhase: phase, event: generatedEvent, offseasonResult };
}
