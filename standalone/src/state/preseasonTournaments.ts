import { PRESEASON_EVENTS } from "../engine/preseasonEvents";
import { assignTeamsToPreseasonEvents, type PreseasonTeamCandidate } from "../engine/preseasonAssignment";
import {
  buildBracket8FirstRound, buildBracket8SecondRound, buildBracket8ThirdRound,
  buildBracket4FirstRound, buildBracket4SecondRound, buildPoolGames, type MTESeed,
} from "../engine/preseasonBracket";
import { newId, type WorldState, type TournamentRow, type GameRow } from "./types";
import type { PreseasonScheduleInfo } from "../engine/schedule";

// A minimal target shape (rather than the full WorldState) so this can be
// used both mid-save (mutating the live state in offseason processing) and
// at world creation (before the local arrays have been assembled into a
// WorldState object yet).
export interface PreseasonTarget {
  tournaments: TournamentRow[];
  games: GameRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

// Builds this season's slate of preseason multi-team events: assigns D1
// teams to fields, creates each event's Tournament row, and seeds its
// opening games (full pool slate for pool-play events; round 1 only for
// bracket events, since later rounds depend on who wins). Returns how many
// of those games count against each participating team's non-conference
// target, so the caller can size the rest of their non-conference slate
// around it instead of double-booking.
export function generatePreseasonTournaments(
  target: PreseasonTarget,
  seasonYear: number,
  d1Teams: PreseasonTeamCandidate[],
  nonConfWindowStart: Date,
  rng: () => number,
): PreseasonScheduleInfo {
  const gamesUsedByTeam = new Map<string, number>();
  const datesUsedByTeam = new Map<string, Date[]>();
  const trackDate = (teamId: string, date: Date) => {
    if (!datesUsedByTeam.has(teamId)) datesUsedByTeam.set(teamId, []);
    datesUsedByTeam.get(teamId)!.push(date);
  };
  const fields = assignTeamsToPreseasonEvents(rng, d1Teams);

  for (const event of PRESEASON_EVENTS) {
    const field = fields.get(event.key) ?? [];
    if (field.length < 2) continue;

    const tournamentId = newId();
    target.tournaments.push({
      id: tournamentId, seasonYear, type: "PRESEASON_INVITATIONAL",
      name: `${event.name} — ${event.location}`, format: null, division: "D1", conferenceId: null,
    });

    for (const teamId of field) {
      gamesUsedByTeam.set(teamId, (gamesUsedByTeam.get(teamId) ?? 0) + event.gamesPerTeam);
    }

    const seeds: MTESeed[] = field.map((teamId, i) => ({ teamId, seed: i + 1 }));
    const baseDate = addDays(nonConfWindowStart, event.startOffsetDays);

    if (event.format === "BRACKET8" || event.format === "BRACKET4") {
      const round1 = event.format === "BRACKET8" ? buildBracket8FirstRound(seeds) : buildBracket4FirstRound(seeds);
      for (const m of round1) {
        target.games.push({
          id: newId(), seasonYear, date: baseDate, homeTeamId: m.teamA, awayTeamId: m.teamB,
          homeScore: null, awayScore: null, attendance: null, isPlayed: false, isConference: false,
          tournamentId, round: 1, bracketSlot: m.slot,
        });
      }
      const extraDays = event.format === "BRACKET8" ? [1, 2] : [1];
      for (const teamId of field) {
        trackDate(teamId, baseDate);
        for (const offset of extraDays) trackDate(teamId, addDays(baseDate, offset));
      }
    } else {
      const poolCount = event.format === "POOL8" ? 2 : 4;
      const poolGames = buildPoolGames(seeds, poolCount);
      for (const g of poolGames) {
        const date = addDays(baseDate, g.round);
        target.games.push({
          id: newId(), seasonYear, date, homeTeamId: g.teamA, awayTeamId: g.teamB,
          homeScore: null, awayScore: null, attendance: null, isPlayed: false, isConference: false,
          tournamentId, round: g.round + 1, bracketSlot: g.poolIndex,
        });
        trackDate(g.teamA, date);
        trackDate(g.teamB, date);
      }
    }
  }

  return { gamesUsedByTeam, datesUsedByTeam };
}

// Called once per day: advances any in-progress bracket-format preseason
// event whose current round just finished (pool-play events never need
// this — their whole slate is generated up front).
export function advancePreseasonBracketRounds(state: WorldState, seasonYear: number, nextRoundDate: Date): void {
  const tournaments = state.tournaments.filter((t) => t.seasonYear === seasonYear && t.type === "PRESEASON_INVITATIONAL");

  for (const t of tournaments) {
    // D2/D3 formats that happen to share a field size with a bracket format
    // (e.g. CLASSIC4 is 4 teams, same as BRACKET4) carry an explicit `format`
    // tag precisely so this loop doesn't mistake them for an elimination
    // bracket — every game in those formats is already scheduled up front.
    if (t.format && t.format !== "BRACKET4" && t.format !== "BRACKET8") continue;

    const games = state.games.filter((g) => g.tournamentId === t.id);
    const fieldSize = new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId])).size;
    if (fieldSize !== 8 && fieldSize !== 4) continue; // pool-play events have no rounds to advance

    const rounds = new Map<number, typeof games>();
    for (const g of games) {
      const r = g.round ?? 1;
      if (!rounds.has(r)) rounds.set(r, []);
      rounds.get(r)!.push(g);
    }
    const currentRound = Math.max(...[...rounds.keys()], 0);
    const currentGames = rounds.get(currentRound) ?? [];
    if (currentGames.length === 0 || !currentGames.every((g) => g.isPlayed)) continue;

    const maxRound = fieldSize === 8 ? 3 : 2;
    if (currentRound >= maxRound) continue;

    const results = currentGames.map((g) => ({
      slot: g.bracketSlot ?? 0,
      winnerTeamId: (g.homeScore ?? 0) > (g.awayScore ?? 0) ? g.homeTeamId : g.awayTeamId,
      loserTeamId: (g.homeScore ?? 0) > (g.awayScore ?? 0) ? g.awayTeamId : g.homeTeamId,
    }));

    const nextMatchups = fieldSize === 8
      ? (currentRound === 1 ? buildBracket8SecondRound(results) : buildBracket8ThirdRound(results))
      : buildBracket4SecondRound(results);

    for (const m of nextMatchups) {
      state.games.push({
        id: newId(), seasonYear, date: nextRoundDate, homeTeamId: m.teamA, awayTeamId: m.teamB,
        homeScore: null, awayScore: null, attendance: null, isPlayed: false, isConference: false,
        tournamentId: t.id, round: currentRound + 1, bracketSlot: m.slot,
      });
    }
  }
}
