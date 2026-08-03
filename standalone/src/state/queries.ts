import { computeStandings } from "./standings";
import type { WorldState } from "./types";

export function getDashboard(state: WorldState) {
  const save = state.save;
  if (!save.coachTeamId) return { save, team: null };

  const team = state.teams.find((t) => t.id === save.coachTeamId)!;
  const headCoach = state.coaches.find((c) => c.id === team.headCoachId)!;
  const conference = state.conferences.find((c) => c.id === team.conferenceId)!;

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

  return { save, team: { ...team, headCoach, conference }, record, nextGame: nextGameOut, pendingEvents };
}

export function getRoster(state: WorldState) {
  if (!state.save.coachTeamId) return [];
  return state.players
    .filter((p) => p.teamId === state.save.coachTeamId)
    .sort((a, b) => a.classYear.localeCompare(b.classYear) || b.scoring - a.scoring);
}

export function getSchedule(state: WorldState) {
  if (!state.save.coachTeamId) return [];
  const teamId = state.save.coachTeamId;
  return state.games
    .filter((g) => g.seasonYear === state.save.currentSeasonYear && (g.homeTeamId === teamId || g.awayTeamId === teamId))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((g) => ({
      ...g,
      homeTeam: state.teams.find((t) => t.id === g.homeTeamId)!,
      awayTeam: state.teams.find((t) => t.id === g.awayTeamId)!,
      tournament: g.tournamentId ? state.tournaments.find((t) => t.id === g.tournamentId) ?? null : null,
    }));
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
