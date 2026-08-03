import type { Division, TournamentType } from "../types";
import { buildFirstRound, buildNextRound, type ResumeTeam, selectTournamentField, seedField } from "../engine/postseason";
import { computeStandings, confWinPct, winPct } from "./standings";
import { newId, type WorldState, type GameRow } from "./types";

function prevPowerOfTwo(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

function createBracketGames(
  state: WorldState,
  seasonYear: number,
  tournamentId: string,
  round: number,
  matchups: { slot: number; teamA: string | null; teamB: string | null }[],
  date: Date,
): void {
  for (const m of matchups) {
    if (!m.teamA || !m.teamB) continue;
    state.games.push({
      id: newId(), seasonYear, date, homeTeamId: m.teamA, awayTeamId: m.teamB,
      homeScore: null, awayScore: null, attendance: null, isPlayed: false, isConference: false,
      tournamentId, round, bracketSlot: m.slot,
    });
  }
}

export function startConferenceTournaments(state: WorldState, seasonYear: number, division: Division, startDate: Date): void {
  const conferences = state.conferences.filter((c) => c.division === division);
  const standings = computeStandings(state, seasonYear);

  for (const conf of conferences) {
    const confTeams = state.teams.filter((t) => t.conferenceId === conf.id);
    if (confTeams.length < 2) continue;
    const fieldSize = Math.max(2, prevPowerOfTwo(Math.min(confTeams.length, 16)));
    const ranked = [...confTeams].sort((a, b) => {
      const ra = standings.get(a.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      const rb = standings.get(b.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      return confWinPct(rb) - confWinPct(ra) || winPct(rb) - winPct(ra) || b.prestige - a.prestige;
    });
    const field = ranked.slice(0, fieldSize);

    const tournamentId = newId();
    state.tournaments.push({ id: tournamentId, seasonYear, type: "CONFERENCE_TOURNAMENT", division, conferenceId: conf.id });

    const seeds = field.map((t, i) => ({ teamId: t.id, seed: i + 1 }));
    const matchups = buildFirstRound(seeds);
    createBracketGames(state, seasonYear, tournamentId, 1, matchups, startDate);
  }
}

export function advanceTournamentRounds(state: WorldState, seasonYear: number, types: TournamentType[], nextRoundDate: Date): void {
  const typeSet = new Set(types);
  const tournaments = state.tournaments.filter((t) => t.seasonYear === seasonYear && typeSet.has(t.type as TournamentType));

  for (const t of tournaments) {
    const games = state.games.filter((g) => g.tournamentId === t.id);
    const rounds = new Map<number, typeof games>();
    for (const g of games) {
      const r = g.round ?? 1;
      if (!rounds.has(r)) rounds.set(r, []);
      rounds.get(r)!.push(g);
    }
    const currentRound = Math.max(...[...rounds.keys()], 0);
    if (currentRound === 0) continue;
    const currentGames = rounds.get(currentRound)!;
    if (!currentGames.every((g) => g.isPlayed)) continue;
    if (currentGames.length === 1) continue; // championship already decided

    const bySlot = [...currentGames].sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0));
    const winners = bySlot.map((g) => ((g.homeScore ?? 0) > (g.awayScore ?? 0) ? g.homeTeamId : g.awayTeamId));
    const nextMatchups = buildNextRound(currentRound, winners);
    createBracketGames(state, seasonYear, t.id, currentRound + 1, nextMatchups, nextRoundDate);
  }
}

export function getConferenceChampions(state: WorldState, seasonYear: number, division: Division): Map<string, string> {
  const tournaments = state.tournaments.filter((t) => t.seasonYear === seasonYear && t.division === division && t.type === "CONFERENCE_TOURNAMENT");
  const champs = new Map<string, string>();
  for (const t of tournaments) {
    const games = state.games.filter((g) => g.tournamentId === t.id);
    const maxRound = Math.max(...games.map((g) => g.round ?? 1), 0);
    const finalGame = games.find((g) => (g.round ?? 1) === maxRound);
    if (finalGame && finalGame.isPlayed && finalGame.homeScore !== null && finalGame.awayScore !== null && t.conferenceId) {
      champs.set(t.conferenceId, finalGame.homeScore > finalGame.awayScore ? finalGame.homeTeamId : finalGame.awayTeamId);
    }
  }
  return champs;
}

export function startNationalTournaments(state: WorldState, seasonYear: number, division: Division, startDate: Date): void {
  const teams = state.teams.filter((t) => t.division === division);
  const standings = computeStandings(state, seasonYear);
  const champsByConf = getConferenceChampions(state, seasonYear, division);
  const championTeamIds = new Set(champsByConf.values());

  const resumeTeams: ResumeTeam[] = teams.map((t) => {
    const r = standings.get(t.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
    return { teamId: t.id, conferenceId: t.conferenceId, wins: r.wins, losses: r.losses, prestige: t.prestige, isConferenceChampion: championTeamIds.has(t.id) };
  });

  if (division === "D1") {
    const { field: mainField } = selectTournamentField(resumeTeams, 64);
    const usedIds = new Set(mainField.map((t) => t.teamId));
    const remaining = resumeTeams.filter((t) => !usedIds.has(t.teamId)).sort((a, b) => {
      const ga = a.wins + a.losses || 1, gb = b.wins + b.losses || 1;
      return (b.wins / gb) * 100 + b.prestige * 0.35 - ((a.wins / ga) * 100 + a.prestige * 0.35);
    });

    const ncaaId = newId();
    state.tournaments.push({ id: ncaaId, seasonYear, type: "NCAA_TOURNAMENT", division, conferenceId: null });
    const seeds = seedField(mainField);
    createBracketGames(state, seasonYear, ncaaId, 1, buildFirstRound(seeds), startDate);

    const nitPoolAll = remaining.slice(0, 32);
    if (nitPoolAll.length >= 4) {
      const nitId = newId();
      state.tournaments.push({ id: nitId, seasonYear, type: "NIT", division, conferenceId: null });
      const size = prevPowerOfTwo(nitPoolAll.length);
      const nitSeeds = nitPoolAll.slice(0, size).map((t, i) => ({ teamId: t.teamId, seed: i + 1 }));
      createBracketGames(state, seasonYear, nitId, 1, buildFirstRound(nitSeeds), startDate);
    }
  } else {
    const type: TournamentType = division === "D2" ? "D2_NATIONAL" : "D3_NATIONAL";
    const { field } = selectTournamentField(resumeTeams, 64);
    const size = prevPowerOfTwo(field.length);
    const tournamentId = newId();
    state.tournaments.push({ id: tournamentId, seasonYear, type, division, conferenceId: null });
    const seeds = field.slice(0, size).map((t, i) => ({ teamId: t.teamId, seed: i + 1 }));
    createBracketGames(state, seasonYear, tournamentId, 1, buildFirstRound(seeds), startDate);
  }
}
