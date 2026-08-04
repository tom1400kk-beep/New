import { computeStandings } from "./standings";
import { costOfLivingIndex } from "../engine/costOfLiving";
import { parseAdRelationships, adRelationshipScore } from "../engine/athleticDirector";
import { sortedPair } from "../engine/rivalry";
import { DIVISION_RULES, type Division } from "../types";
import type { WorldState } from "./types";

export function getDashboard(state: WorldState) {
  const save = state.save;
  if (!save.coachTeamId) return { save, team: null };

  const team = state.teams.find((t) => t.id === save.coachTeamId)!;
  const headCoach = state.coaches.find((c) => c.id === team.headCoachId)!;
  const conference = state.conferences.find((c) => c.id === team.conferenceId)!;
  const athleticDirector = state.athleticDirectors.find((a) => a.id === team.athleticDirectorId) ?? null;

  const standings = computeStandings(state, save.currentSeasonYear);
  const record = standings.get(team.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };

  const nextGame = state.games
    .filter((g) => !g.isPlayed && (g.homeTeamId === team.id || g.awayTeamId === team.id))
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  let nextGameOut = null;
  if (nextGame) {
    const homeTeam = state.teams.find((t) => t.id === nextGame.homeTeamId)!;
    const awayTeam = state.teams.find((t) => t.id === nextGame.awayTeamId)!;
    const tournament = nextGame.tournamentId ? state.tournaments.find((t) => t.id === nextGame.tournamentId) : null;
    nextGameOut = { ...nextGame, homeTeam, awayTeam, tournament: tournament ?? null };
  }

  const pendingEvents = state.events.filter((e) => e.status === "PENDING");

  const adRelationships = parseAdRelationships(headCoach.adRelationshipsJson);
  const adPerception = athleticDirector ? adRelationshipScore(adRelationships, athleticDirector.id) : null;

  const homeGames = state.games.filter((g) => g.seasonYear === save.currentSeasonYear && g.homeTeamId === team.id && g.isPlayed && g.attendance != null);
  const avgTurnoutPct = homeGames.length >= 3
    ? Math.round((homeGames.reduce((s, g) => s + (g.attendance ?? 0), 0) / homeGames.length / team.venueCapacity) * 100)
    : null;

  return {
    save,
    team: {
      ...team, headCoach, conference, athleticDirector, costOfLivingIndex: costOfLivingIndex(team.state), adPerception,
      avgTurnoutPct, homeGamesPlayedThisSeason: homeGames.length,
    },
    record, nextGame: nextGameOut, pendingEvents,
  };
}

export function getRoster(state: WorldState) {
  if (!state.save.coachTeamId) return [];
  return state.players
    .filter((p) => p.teamId === state.save.coachTeamId)
    .sort((a, b) => a.classYear.localeCompare(b.classYear) || b.scoring - a.scoring);
}

export function getWalkOns(state: WorldState) {
  if (!state.save.coachTeamId) return { candidates: [], rosterCount: 0, rosterCap: 0 };
  const teamId = state.save.coachTeamId;
  const team = state.teams.find((t) => t.id === teamId)!;
  const rosterCount = state.players.filter((p) => p.teamId === teamId).length;
  const candidates = [...state.walkOnCandidates.filter((c) => c.teamId === teamId)].sort((a, b) => b.scoring - a.scoring);
  return { candidates, rosterCount, rosterCap: DIVISION_RULES[team.division as Division].rosterCap };
}

export function getSchedule(state: WorldState) {
  if (!state.save.coachTeamId) return [];
  const teamId = state.save.coachTeamId;
  const rivalIntensityByOpponent = new Map<string, number>();
  for (const r of state.rivalries) {
    if (!r.active) continue;
    if (r.teamAId === teamId) rivalIntensityByOpponent.set(r.teamBId, r.intensity);
    else if (r.teamBId === teamId) rivalIntensityByOpponent.set(r.teamAId, r.intensity);
  }
  return state.games
    .filter((g) => g.seasonYear === state.save.currentSeasonYear && (g.homeTeamId === teamId || g.awayTeamId === teamId))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((g) => {
      const opponentId = g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId;
      const rivalryIntensity = rivalIntensityByOpponent.get(opponentId);
      return {
        ...g,
        homeTeam: state.teams.find((t) => t.id === g.homeTeamId)!,
        awayTeam: state.teams.find((t) => t.id === g.awayTeamId)!,
        tournament: g.tournamentId ? state.tournaments.find((t) => t.id === g.tournamentId) ?? null : null,
        isRivalry: rivalryIntensity !== undefined,
        rivalryIntensity: rivalryIntensity ?? null,
      };
    });
}

export function getRivalries(state: WorldState) {
  if (!state.save.coachTeamId) return [];
  const teamId = state.save.coachTeamId;
  const rivalries = state.rivalries
    .filter((r) => r.active && (r.teamAId === teamId || r.teamBId === teamId))
    .sort((a, b) => b.intensity - a.intensity);

  return rivalries.map((r) => {
    const opponentId = r.teamAId === teamId ? r.teamBId : r.teamAId;
    const opponent = state.teams.find((t) => t.id === opponentId)!;
    const [pairA, pairB] = sortedPair(teamId, opponentId);
    const meetings = state.games.filter((g) =>
      g.isPlayed && ((g.homeTeamId === pairA && g.awayTeamId === pairB) || (g.homeTeamId === pairB && g.awayTeamId === pairA)));
    const wins = meetings.filter((g) => g.homeTeamId === teamId ? (g.homeScore ?? 0) > (g.awayScore ?? 0) : (g.awayScore ?? 0) > (g.homeScore ?? 0)).length;
    return {
      teamId: opponent.id, teamName: opponent.name, intensity: r.intensity, origin: r.origin,
      establishedYear: r.establishedYear, postseasonMeetings: r.postseasonMeetings,
      allTimeRecord: { wins, losses: meetings.length - wins },
    };
  });
}

export function getStandings(state: WorldState) {
  if (!state.save.coachTeamId) return { conferenceName: null, rows: [] };
  const team = state.teams.find((t) => t.id === state.save.coachTeamId)!;
  const confTeams = state.teams.filter((t) => t.conferenceId === team.conferenceId);
  const conference = state.conferences.find((c) => c.id === team.conferenceId);
  const standings = computeStandings(state, state.save.currentSeasonYear);

  const rows = confTeams
    .map((t) => {
      const r = standings.get(t.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      return { teamId: t.id, name: t.name, wins: r.wins, losses: r.losses, confWins: r.confWins, confLosses: r.confLosses };
    })
    .sort((a, b) => b.confWins / Math.max(1, b.confWins + b.confLosses) - a.confWins / Math.max(1, a.confWins + a.confLosses));

  return { conferenceName: conference?.name ?? null, rows };
}
