import { generateInSeasonEvents, type InSeasonCandidateTeam } from "../engine/inSeasonEvents";
import {
  buildBracket4FirstRound, buildBracket8FirstRound, buildClassic4Games, buildPartialRoundRobin, buildPoolGames, type MTESeed,
} from "../engine/preseasonBracket";
import { newId } from "./types";
import type { PreseasonTarget } from "./preseasonTournaments";
import type { PreseasonScheduleInfo } from "../engine/schedule";

const DAY_MS = 24 * 60 * 60 * 1000;
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

// D2/D3 counterpart to generatePreseasonTournaments: same non-conference-slot
// bookkeeping contract (gamesUsedByTeam / datesUsedByTeam), but the event
// fields themselves are procedurally generated per save (see engine/inSeasonEvents.ts)
// rather than drawn from a fixed real-world list, and cover six formats
// instead of D1's four.
export function generateDivisionInSeasonEvents(
  target: PreseasonTarget,
  seasonYear: number,
  division: "D2" | "D3",
  candidateTeams: InSeasonCandidateTeam[],
  nonConfWindowStart: Date,
  rng: () => number,
): PreseasonScheduleInfo {
  const gamesUsedByTeam = new Map<string, number>();
  const datesUsedByTeam = new Map<string, Date[]>();
  const trackDate = (teamId: string, date: Date) => {
    if (!datesUsedByTeam.has(teamId)) datesUsedByTeam.set(teamId, []);
    datesUsedByTeam.get(teamId)!.push(date);
  };

  const events = generateInSeasonEvents(division, candidateTeams, rng);

  for (const event of events) {
    const tournamentId = newId();
    target.tournaments.push({
      id: tournamentId, seasonYear, type: "PRESEASON_INVITATIONAL",
      name: `${event.name} — ${event.location}`, format: event.format, division, conferenceId: null,
    });

    for (const teamId of event.teamIds) {
      gamesUsedByTeam.set(teamId, (gamesUsedByTeam.get(teamId) ?? 0) + event.gamesPerTeam);
    }

    const baseDate = addDays(nonConfWindowStart, event.startOffsetDays);
    const seeds: MTESeed[] = event.teamIds.map((teamId, i) => ({ teamId, seed: i + 1 }));

    if (event.format === "BRACKET4" || event.format === "BRACKET8") {
      const round1 = event.format === "BRACKET8" ? buildBracket8FirstRound(seeds) : buildBracket4FirstRound(seeds);
      for (const m of round1) {
        target.games.push({
          id: newId(), seasonYear, date: baseDate, homeTeamId: m.teamA, awayTeamId: m.teamB,
          homeScore: null, awayScore: null, attendance: null, isPlayed: false, isConference: false,
          tournamentId, round: 1, bracketSlot: m.slot,
        });
      }
      // Later rounds aren't known yet, but the field's next 1-2 days are
      // committed regardless of outcome — reserve them the same way D1 does.
      const extraDays = event.format === "BRACKET8" ? [1, 2] : [1];
      for (const teamId of event.teamIds) {
        trackDate(teamId, baseDate);
        for (const offset of extraDays) trackDate(teamId, addDays(baseDate, offset));
      }
    } else if (event.format === "CLASSIC4") {
      const [a1, a2, b1, b2] = event.teamIds;
      const games = buildClassic4Games([a1, a2], [b1, b2]);
      games.forEach((g, i) => {
        target.games.push({
          id: newId(), seasonYear, date: addDays(baseDate, g.day), homeTeamId: g.teamA, awayTeamId: g.teamB,
          homeScore: null, awayScore: null, attendance: null, isPlayed: false, isConference: false,
          tournamentId, round: g.day + 1, bracketSlot: i,
        });
      });
      for (const g of games) {
        const date = addDays(baseDate, g.day);
        trackDate(g.teamA, date);
        trackDate(g.teamB, date);
      }
    } else if (event.format === "CHALLENGE2") {
      const [a, b] = event.teamIds;
      target.games.push({
        id: newId(), seasonYear, date: baseDate, homeTeamId: a, awayTeamId: b,
        homeScore: null, awayScore: null, attendance: null, isPlayed: false, isConference: false,
        tournamentId, round: 1, bracketSlot: 0,
      });
      trackDate(a, baseDate);
      trackDate(b, baseDate);
    } else if (event.format === "SHOWCASE6") {
      const games = buildPartialRoundRobin(event.teamIds, 2);
      for (const g of games) {
        const date = addDays(baseDate, g.round);
        target.games.push({
          id: newId(), seasonYear, date, homeTeamId: g.teamA, awayTeamId: g.teamB,
          homeScore: null, awayScore: null, attendance: null, isPlayed: false, isConference: false,
          tournamentId, round: g.round + 1, bracketSlot: 0,
        });
        trackDate(g.teamA, date);
        trackDate(g.teamB, date);
      }
    } else if (event.format === "MEGA") {
      const poolCount = Math.max(2, Math.round(event.teamIds.length / 4));
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
