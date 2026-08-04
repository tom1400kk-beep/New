import { computeStandings } from "./standings";
import { expectedWinPct } from "../engine/career";
import { costOfLivingIndex } from "../engine/costOfLiving";
import { parseAdRelationships, adRelationshipScore } from "../engine/athleticDirector";
import { meetsLegalityBar } from "../engine/career";
import { sortedPair } from "../engine/rivalry";
import { DIVISION_RULES, type Division } from "../types";
import { computeKenPomRatings, type TeamGameBoxScore } from "../engine/kenpom";
import { computeRPI, type RPIGameResult } from "../engine/rpi";
import { projectBracketology, type BracketTeamInput } from "../engine/bracketology";
import { computeGameOdds, type OddsTeamInput } from "../engine/gameOdds";
import { computeDivisionApPoll } from "./apPoll";
import { overall, type SimPlayer } from "../engine/simulate";
import { aggregateCareerStats, type RawGameStatLine } from "../engine/careerStats";
import { buildSeasonCalendar } from "../engine/seasonCalendar";
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

export function getDisciplineDrops(state: WorldState) {
  const players = [...state.players.filter((p) => p.droppedForDiscipline && !p.teamId)]
    .sort((a, b) => a.disciplineRating - b.disciplineRating);
  let rosterCount = 0;
  let rosterCap = 0;
  let adWouldAllowById = new Map<string, boolean>();
  if (state.save.coachTeamId) {
    const team = state.teams.find((t) => t.id === state.save.coachTeamId)!;
    rosterCount = state.players.filter((p) => p.teamId === team.id).length;
    rosterCap = DIVISION_RULES[team.division as Division].rosterCap;
    const ad = state.athleticDirectors.find((a) => a.id === team.athleticDirectorId);
    adWouldAllowById = new Map(players.map((p) => [p.id, meetsLegalityBar(p.disciplineRating, team.academicReputation, ad?.integrityStandard)]));
  }
  return {
    players: players.map((p) => ({ ...p, adWouldAllow: adWouldAllowById.get(p.id) ?? null })),
    rosterCount, rosterCap,
  };
}

export function getSchedule(state: WorldState) {
  if (!state.save.coachTeamId) return { teamName: null, games: [] };
  const teamId = state.save.coachTeamId;
  const teamName = state.teams.find((t) => t.id === teamId)?.name ?? null;
  const rivalIntensityByOpponent = new Map<string, number>();
  for (const r of state.rivalries) {
    if (!r.active) continue;
    if (r.teamAId === teamId) rivalIntensityByOpponent.set(r.teamBId, r.intensity);
    else if (r.teamBId === teamId) rivalIntensityByOpponent.set(r.teamAId, r.intensity);
  }
  const games = state.games
    .filter((g) => g.seasonYear === state.save.currentSeasonYear && (g.homeTeamId === teamId || g.awayTeamId === teamId))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((g) => {
      const isHome = g.homeTeamId === teamId;
      const opponentId = isHome ? g.awayTeamId : g.homeTeamId;
      const rivalryIntensity = rivalIntensityByOpponent.get(opponentId);
      return {
        ...g,
        homeTeam: state.teams.find((t) => t.id === g.homeTeamId)!,
        awayTeam: state.teams.find((t) => t.id === g.awayTeamId)!,
        tournament: g.tournamentId ? state.tournaments.find((t) => t.id === g.tournamentId) ?? null : null,
        isHome,
        opponentId,
        opponentName: state.teams.find((t) => t.id === opponentId)?.name ?? "",
        isRivalry: rivalryIntensity !== undefined,
        rivalryIntensity: rivalryIntensity ?? null,
      };
    });
  return { teamName, games };
}

// Full profile for an arbitrary team (not just the user's own) — powers the
// "click any team name" feature across the UI. KenPom/RPI are D1-only,
// mirroring the rest of the app's ranking pages.
export function getTeamProfile(state: WorldState, teamId: string) {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return null;
  const headCoach = state.coaches.find((c) => c.id === team.headCoachId) ?? null;
  const athleticDirector = state.athleticDirectors.find((a) => a.id === team.athleticDirectorId) ?? null;
  const conference = state.conferences.find((c) => c.id === team.conferenceId) ?? null;

  const standings = computeStandings(state, state.save.currentSeasonYear);
  const record = standings.get(team.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };

  const roster = state.players
    .filter((p) => p.teamId === team.id)
    .sort((a, b) => a.classYear.localeCompare(b.classYear) || b.scoring - a.scoring);

  let kenpom: { rank: number; adjEM: number } | null = null;
  let rpi: { rank: number; rpi: number } | null = null;
  if (team.division === "D1") {
    const teams = d1Teams(state);
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const seasonYear = state.save.currentSeasonYear;
    const kenpomSorted = [...computeKenPomRatings(buildKenPomBoxScores(state, seasonYear).filter((b) => teamById.has(b.teamId))).values()]
      .filter((r) => teamById.has(r.teamId)).sort((a, b) => b.adjEM - a.adjEM);
    const rpiSorted = [...computeRPI(buildRPIResults(state, seasonYear).filter((r) => teamById.has(r.teamId))).values()]
      .filter((r) => teamById.has(r.teamId)).sort((a, b) => b.rpi - a.rpi);
    const kenpomIdx = kenpomSorted.findIndex((r) => r.teamId === team.id);
    const rpiIdx = rpiSorted.findIndex((r) => r.teamId === team.id);
    if (kenpomIdx >= 0) kenpom = { rank: kenpomIdx + 1, adjEM: kenpomSorted[kenpomIdx].adjEM };
    if (rpiIdx >= 0) rpi = { rank: rpiIdx + 1, rpi: rpiSorted[rpiIdx].rpi };
  }

  return {
    id: team.id, name: team.name, state: team.state, division: team.division,
    conferenceName: conference?.name ?? null, conferenceAbbreviation: conference?.abbreviation ?? null,
    prestige: team.prestige, nilBudget: team.nilBudget, facilitiesRating: team.facilitiesRating,
    academicReputation: team.academicReputation, venueCapacity: team.venueCapacity,
    isPlayerControlled: team.isPlayerControlled,
    costOfLivingIndex: costOfLivingIndex(team.state),
    headCoach: headCoach ? {
      id: headCoach.id, name: headCoach.name, archetype: headCoach.archetype, background: headCoach.background,
      hotSeatLevel: headCoach.hotSeatLevel, reputation: headCoach.reputation,
    } : null,
    athleticDirector: athleticDirector ? {
      id: athleticDirector.id, name: athleticDirector.name, patience: athleticDirector.patience, winFocus: athleticDirector.winFocus,
      integrityStandard: athleticDirector.integrityStandard, loyalty: athleticDirector.loyalty,
      yearsAtCurrentJob: athleticDirector.yearsAtCurrentJob,
    } : null,
    record, kenpom, rpi, roster,
  };
}

// Fetch-by-id profile lookups powering the "click any player/coach/AD name"
// feature across the UI, mirroring getTeamProfile's shape so every current
// and future screen can link to a person's profile with just id + name.
export function getPlayerProfile(state: WorldState, playerId: string) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const team = player.teamId ? state.teams.find((t) => t.id === player.teamId) : null;
  return { ...player, overall: Math.round(overall(player as unknown as SimPlayer)), teamId: team?.id ?? null, teamName: team?.name ?? null };
}

export function getCoachProfile(state: WorldState, coachId: string) {
  const coach = state.coaches.find((c) => c.id === coachId);
  if (!coach) return null;
  const team = state.teams.find((t) => t.headCoachId === coach.id) ?? null;
  return { ...coach, teamId: team?.id ?? null, teamName: team?.name ?? null };
}

export function getADProfile(state: WorldState, adId: string) {
  const ad = state.athleticDirectors.find((a) => a.id === adId);
  if (!ad) return null;
  const team = state.teams.find((t) => t.athleticDirectorId === ad.id) ?? null;
  return { ...ad, teamId: team?.id ?? null, teamName: team?.name ?? null };
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

function d1Teams(state: WorldState) {
  return state.teams.filter((t) => t.division === "D1");
}

// KenPom-style ratings weigh every game played, including conference and
// NCAA tournament games, the same way the real system updates all season —
// unlike the W-L record shown elsewhere, which is regular-season only.
function buildKenPomBoxScores(state: WorldState, seasonYear: number): TeamGameBoxScore[] {
  const games = state.games.filter((g) => g.seasonYear === seasonYear && g.isPlayed);
  const statsByGameTeam = new Map<string, { fga: number; fta: number; turnovers: number; rebounds: number }>();
  for (const s of state.stats) {
    const key = `${s.gameId}|${s.teamId}`;
    if (!statsByGameTeam.has(key)) statsByGameTeam.set(key, { fga: 0, fta: 0, turnovers: 0, rebounds: 0 });
    const agg = statsByGameTeam.get(key)!;
    agg.fga += s.fga;
    agg.fta += s.fta;
    agg.turnovers += s.turnovers;
    agg.rebounds += s.rebounds;
  }

  const boxScores: TeamGameBoxScore[] = [];
  for (const g of games) {
    if (g.homeScore === null || g.awayScore === null) continue;
    const homeStats = statsByGameTeam.get(`${g.id}|${g.homeTeamId}`);
    const awayStats = statsByGameTeam.get(`${g.id}|${g.awayTeamId}`);
    if (!homeStats || !awayStats) continue;
    boxScores.push({ gameId: g.id, teamId: g.homeTeamId, points: g.homeScore, opponentPoints: g.awayScore, ...homeStats });
    boxScores.push({ gameId: g.id, teamId: g.awayTeamId, points: g.awayScore, opponentPoints: g.homeScore, ...awayStats });
  }
  return boxScores;
}

// RPI sticks to the regular-season game set (matches the W-L record shown
// everywhere else in the app), the traditional convention for the metric.
function buildRPIResults(state: WorldState, seasonYear: number): RPIGameResult[] {
  const games = state.games.filter((g) => g.seasonYear === seasonYear && g.isPlayed && g.tournamentId === null);
  const results: RPIGameResult[] = [];
  for (const g of games) {
    if (g.homeScore === null || g.awayScore === null) continue;
    const homeWon = g.homeScore > g.awayScore;
    results.push({ teamId: g.homeTeamId, opponentId: g.awayTeamId, won: homeWon });
    results.push({ teamId: g.awayTeamId, opponentId: g.homeTeamId, won: !homeWon });
  }
  return results;
}

export function getKenPom(state: WorldState) {
  const teams = d1Teams(state);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const boxScores = buildKenPomBoxScores(state, state.save.currentSeasonYear).filter((b) => teamById.has(b.teamId));
  const ratings = computeKenPomRatings(boxScores);
  return [...ratings.values()]
    .filter((r) => teamById.has(r.teamId))
    .sort((a, b) => b.adjEM - a.adjEM)
    .map((r, i) => ({ rank: i + 1, name: teamById.get(r.teamId)!.name, ...r }));
}

export function getRPI(state: WorldState) {
  const teams = d1Teams(state);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const results = buildRPIResults(state, state.save.currentSeasonYear).filter((r) => teamById.has(r.teamId));
  const ratings = computeRPI(results);
  return [...ratings.values()]
    .filter((r) => teamById.has(r.teamId))
    .sort((a, b) => b.rpi - a.rpi)
    .map((r, i) => ({ rank: i + 1, name: teamById.get(r.teamId)!.name, ...r }));
}

export function getBracketology(state: WorldState) {
  const teams = d1Teams(state);
  const seasonYear = state.save.currentSeasonYear;
  const boxScores = buildKenPomBoxScores(state, seasonYear);
  const rpiResults = buildRPIResults(state, seasonYear);
  const standings = computeStandings(state, seasonYear);

  const kenpom = computeKenPomRatings(boxScores);
  const rpi = computeRPI(rpiResults);

  const kenpomRankOf = new Map([...kenpom.values()].sort((a, b) => b.adjEM - a.adjEM).map((r, i) => [r.teamId, i + 1]));
  const rpiRankOf = new Map([...rpi.values()].sort((a, b) => b.rpi - a.rpi).map((r, i) => [r.teamId, i + 1]));

  const inputs: BracketTeamInput[] = teams
    .filter((t) => kenpomRankOf.has(t.id) && rpiRankOf.has(t.id))
    .map((t) => {
      const record = standings.get(t.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      return {
        teamId: t.id, name: t.name, conferenceId: t.conferenceId,
        wins: record.wins, losses: record.losses, confWins: record.confWins, confLosses: record.confLosses,
        kenpomRank: kenpomRankOf.get(t.id)!, rpiRank: rpiRankOf.get(t.id)!,
      };
    });

  return projectBracketology(inputs);
}

// Top 25 for the user's own division — snapshotted every Monday (see
// state/apPoll.ts). Falls back to a live, unpersisted preview if the save
// hasn't hit its first Monday yet this season, so the page is never empty.
export function getApPoll(state: WorldState) {
  const userTeam = state.save.coachTeamId ? state.teams.find((t) => t.id === state.save.coachTeamId) : undefined;
  const division = (userTeam?.division as Division | undefined) ?? "D1";
  const seasonYear = state.save.currentSeasonYear;

  const teams = state.teams.filter((t) => t.division === division);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const snapshots = state.pollSnapshots.filter((p) => p.seasonYear === seasonYear && p.division === division);
  const latest = snapshots.length > 0 ? snapshots.reduce((a, b) => (b.weekDate > a.weekDate ? b : a)) : undefined;

  const rankings = latest ? JSON.parse(latest.rankingsJson) : computeDivisionApPoll(state, seasonYear, division);

  return {
    division,
    weekOf: latest?.weekDate ?? null,
    isPreview: !latest,
    rankings: rankings.map((r: { rank: number; teamId: string; wins: number; losses: number; score: number }) => ({
      ...r, name: teamById.get(r.teamId)?.name ?? "—",
    })),
  };
}

export function getCoachStats(state: WorldState) {
  if (!state.save.coachTeamId) return null;
  const team = state.teams.find((t) => t.id === state.save.coachTeamId);
  if (!team) return null;
  const coach = state.coaches.find((c) => c.id === team.headCoachId);
  if (!coach) return null;

  const seasonRecords = state.coachSeasonRecords
    .filter((r) => r.coachId === coach.id)
    .sort((a, b) => a.seasonYear - b.seasonYear);
  const teamNameById = new Map(state.teams.map((t) => [t.id, t.name]));

  const bySeason = seasonRecords.map((r) => ({
    seasonYear: r.seasonYear,
    teamId: r.teamId,
    teamName: teamNameById.get(r.teamId) ?? "—",
    wins: r.wins,
    losses: r.losses,
    confWins: r.confWins,
    confLosses: r.confLosses,
    madePostseason: r.madePostseason,
    postseasonWins: r.postseasonWins,
  }));

  const byTeamMap = new Map<string, { teamId: string; teamName: string; seasons: number; wins: number; losses: number }>();
  for (const r of seasonRecords) {
    const existing = byTeamMap.get(r.teamId) ?? { teamId: r.teamId, teamName: teamNameById.get(r.teamId) ?? "—", seasons: 0, wins: 0, losses: 0 };
    existing.seasons += 1;
    existing.wins += r.wins;
    existing.losses += r.losses;
    byTeamMap.set(r.teamId, existing);
  }
  const byTeam = [...byTeamMap.values()].sort((a, b) => b.seasons - a.seasons);

  return {
    coachName: coach.name,
    total: { wins: coach.careerWins, losses: coach.careerLosses },
    bySeason,
    byTeam,
  };
}

export function getGamePreview(state: WorldState, gameId: string) {
  const game = state.games.find((g) => g.id === gameId)!;
  const homeTeam = state.teams.find((t) => t.id === game.homeTeamId)!;
  const awayTeam = state.teams.find((t) => t.id === game.awayTeamId)!;
  const tournament = game.tournamentId ? state.tournaments.find((t) => t.id === game.tournamentId) ?? null : null;

  const standings = computeStandings(state, state.save.currentSeasonYear);
  const homeRecord = standings.get(homeTeam.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
  const awayRecord = standings.get(awayTeam.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };

  const kenpomByTeam = new Map<string, { rank: number; adjEM: number; adjO: number; adjD: number; adjTempo: number }>();
  const rpiByTeam = new Map<string, { rank: number; rpi: number }>();
  if (homeTeam.division === "D1" && awayTeam.division === "D1") {
    const teams = d1Teams(state);
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const seasonYear = state.save.currentSeasonYear;
    const kenpom = computeKenPomRatings(buildKenPomBoxScores(state, seasonYear).filter((b) => teamById.has(b.teamId)));
    const rpi = computeRPI(buildRPIResults(state, seasonYear).filter((r) => teamById.has(r.teamId)));

    [...kenpom.values()].sort((a, b) => b.adjEM - a.adjEM).forEach((r, i) => {
      kenpomByTeam.set(r.teamId, { rank: i + 1, adjEM: r.adjEM, adjO: r.adjO, adjD: r.adjD, adjTempo: r.adjTempo });
    });
    [...rpi.values()].sort((a, b) => b.rpi - a.rpi).forEach((r, i) => {
      rpiByTeam.set(r.teamId, { rank: i + 1, rpi: r.rpi });
    });
  }

  // Rosters for the starting lineup + injury report — same "healthy top 5 by
  // overall" the game sim itself will actually field (see buildRotation).
  const roster = state.players.filter((p) => p.teamId === homeTeam.id || p.teamId === awayTeam.id);
  const statsByPlayer = new Map<string, RawGameStatLine[]>();
  const rosterIds = new Set(roster.map((p) => p.id));
  for (const s of state.stats) {
    if (!rosterIds.has(s.playerId)) continue;
    const g = state.games.find((gg) => gg.id === s.gameId);
    if (!g) continue;
    if (!statsByPlayer.has(s.playerId)) statsByPlayer.set(s.playerId, []);
    statsByPlayer.get(s.playerId)!.push({ seasonYear: g.seasonYear, ...s });
  }

  function seasonLineFor(playerId: string) {
    const lines = aggregateCareerStats(statsByPlayer.get(playerId) ?? []);
    return lines.find((l) => l.seasonYear === state.save.currentSeasonYear) ?? null;
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

  function teamPayload(team: typeof homeTeam, record: { wins: number; losses: number; confWins: number; confLosses: number }) {
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

  const homePayload = teamPayload(homeTeam, homeRecord);
  const awayPayload = teamPayload(awayTeam, awayRecord);

  const homeOddsInput: OddsTeamInput = { prestige: homeTeam.prestige, kenpomAdjEM: homePayload.kenpom?.adjEM ?? null, gamesPlayed: homePayload.gamesPlayed };
  const awayOddsInput: OddsTeamInput = { prestige: awayTeam.prestige, kenpomAdjEM: awayPayload.kenpom?.adjEM ?? null, gamesPlayed: awayPayload.gamesPlayed };
  const odds = computeGameOdds(homeOddsInput, awayOddsInput);

  return {
    gameId: game.id, date: game.date, isConference: game.isConference,
    tournament: tournament ? { type: tournament.type, name: tournament.name } : null,
    homeTeam: homePayload, awayTeam: awayPayload, odds,
  };
}

function nationalTournamentType(division: Division): string {
  return division === "D1" ? "NCAA_TOURNAMENT" : division === "D2" ? "D2_NATIONAL" : "D3_NATIONAL";
}

function dateRangeOf(dates: Date[]): { start: Date; end: Date } | null {
  if (dates.length === 0) return null;
  let start = dates[0];
  let end = dates[0];
  for (const d of dates) {
    if (d.getTime() < start.getTime()) start = d;
    if (d.getTime() > end.getTime()) end = d;
  }
  return { start, end };
}

export function getSeasonCalendar(state: WorldState) {
  let division: Division = "D1";
  if (state.save.coachTeamId) {
    const team = state.teams.find((t) => t.id === state.save.coachTeamId);
    if (team) division = team.division as Division;
  }
  const seasonYear = state.save.currentSeasonYear;
  const teamDivisionById = new Map(state.teams.map((t) => [t.id, t.division]));
  const tournamentById = new Map(state.tournaments.map((t) => [t.id, t]));

  const regularSeasonDates = state.games
    .filter((g) => g.seasonYear === seasonYear && g.tournamentId === null && teamDivisionById.get(g.homeTeamId) === division)
    .map((g) => g.date);

  const gamesByTournamentType = (type: string) => state.games
    .filter((g) => {
      if (g.seasonYear !== seasonYear || !g.tournamentId) return false;
      const t = tournamentById.get(g.tournamentId);
      return !!t && t.type === type && t.division === division;
    })
    .map((g) => g.date);

  const preseasonDates = gamesByTournamentType("PRESEASON_INVITATIONAL");
  const confTourneyDates = gamesByTournamentType("CONFERENCE_TOURNAMENT");
  const nationalDates = gamesByTournamentType(nationalTournamentType(division));

  const confs = state.conferences.filter((c) => c.division === division);
  const conferenceTeamCounts = confs.map((c) => state.teams.filter((t) => t.conferenceId === c.id).length);
  const divisionTeamCount = state.teams.filter((t) => t.division === division).length;

  const milestones = buildSeasonCalendar({
    seasonYear,
    division,
    regularSeasonRange: dateRangeOf(regularSeasonDates),
    preseasonEventsStart: preseasonDates.length > 0 ? dateRangeOf(preseasonDates)!.start : null,
    conferenceTeamCounts,
    divisionTeamCount,
    confTourneyRange: dateRangeOf(confTourneyDates),
    nationalRange: dateRangeOf(nationalDates),
  });

  return {
    seasonYear, division,
    currentDate: state.save.currentDate, currentPhase: state.save.currentPhase,
    milestones,
  };
}

// A league-wide "who's in danger" board — anyone hot enough to matter (or
// riskier), plus the user's own team regardless, so they can always see
// where they stand relative to everyone else actually on the hot seat.
const HOT_SEAT_THRESHOLD = 25;
const MAX_HOT_SEAT_ROWS = 50;

export function getHotSeatBoard(state: WorldState) {
  const standings = computeStandings(state, state.save.currentSeasonYear);

  const rows = state.teams
    .map((t) => {
      const coach = state.coaches.find((c) => c.id === t.headCoachId);
      if (!coach) return null;
      const record = standings.get(t.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      return {
        teamId: t.id, teamName: t.name, division: t.division, state: t.state, prestige: t.prestige,
        isUserTeam: t.id === state.save.coachTeamId,
        coach: {
          id: coach.id, name: coach.name, archetype: coach.archetype, background: coach.background,
          hotSeatLevel: coach.hotSeatLevel, yearsAtCurrentJob: coach.yearsAtCurrentJob,
        },
        record,
        expectedWinPct: expectedWinPct(t.prestige),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const eligible = rows.filter((r) => r.coach.hotSeatLevel >= HOT_SEAT_THRESHOLD || r.isUserTeam);
  let board = eligible.sort((a, b) => b.coach.hotSeatLevel - a.coach.hotSeatLevel).slice(0, MAX_HOT_SEAT_ROWS);

  const userRow = rows.find((r) => r.isUserTeam);
  if (userRow && !board.some((r) => r.isUserTeam)) {
    board = [...board, userRow].sort((a, b) => b.coach.hotSeatLevel - a.coach.hotSeatLevel);
  }

  return board;
}
