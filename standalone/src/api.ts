import * as persistence from "./state/persistence";
import { createSaveWorld } from "./state/createSaveWorld";
import { advanceOneDay, advanceMultipleDays } from "./state/advance";
import { loadLeagueData, prestigeTierToScore } from "./state/leagueData";
import * as queries from "./state/queries";
import * as actions from "./state/actions";
import { COACH_ARCHETYPES, type CoachArchetype } from "./engine/coachArchetypes";
import { COACH_BACKGROUNDS, type CoachBackground } from "./engine/coachBackgrounds";
import { NO_PLAYING_CAREER, type PlayingCareerChoice } from "./engine/playingCareer";
import { generateStartingJobOffers, type CandidateJob } from "./engine/coachCreation";
import { INTERNATIONAL_COUNTRIES } from "./engine/countries";
import { mulberry32 } from "./engine/rng";
import type { WorldState } from "./state/types";
import type { Division } from "./types";

const ALL_DIVISIONS: Division[] = ["D1", "D2", "D3"];

function allNationalTeams(): CandidateJob[] {
  const teams: CandidateJob[] = [];
  for (const division of ALL_DIVISIONS) {
    const league = loadLeagueData(division);
    for (const c of league.conferences) {
      for (const m of c.members) {
        teams.push({ school: m.school, conference: c.name, division, state: m.state, prestige: prestigeTierToScore(m.prestigeTier) });
      }
    }
  }
  return teams;
}

let cache: WorldState | null = null;

async function ensureLoaded(saveId: string): Promise<WorldState> {
  if (cache && cache.save.id === saveId) return cache;
  const loaded = await persistence.loadSave(saveId);
  if (!loaded) throw new Error("Save not found");
  // Saves persisted before the rivalries feature won't have this array yet.
  if (!loaded.rivalries) loaded.rivalries = [];
  // Saves persisted before the walk-on tryouts feature won't have this array
  // or the onScholarship field on existing players yet.
  if (!loaded.walkOnCandidates) loaded.walkOnCandidates = [];
  // Saves persisted before the transfer portal feature won't have this array,
  // the previousSchool/prioritiesJson fields on existing players, or the
  // transferPipelineJson field on existing coaches yet.
  if (!loaded.transferInterests) loaded.transferInterests = [];
  for (const p of loaded.players) {
    if (p.onScholarship === undefined) p.onScholarship = true;
    if (p.previousSchool === undefined) p.previousSchool = null;
    if (p.prioritiesJson === undefined) p.prioritiesJson = "{}";
    if (p.hometownCity === undefined) p.hometownCity = "";
  }
  for (const c of loaded.coaches) {
    if (c.transferPipelineJson === undefined) c.transferPipelineJson = "{}";
  }
  // Saves persisted before the hometown-city feature won't have this field on
  // existing prospects/walk-on candidates either.
  for (const p of loaded.prospects) {
    if (p.hometownCity === undefined) p.hometownCity = "";
  }
  for (const c of loaded.walkOnCandidates) {
    if (c.hometownCity === undefined) c.hometownCity = "";
  }
  // Saves persisted before the preseason multi-team events feature won't
  // have this field on existing tournament rows.
  for (const t of loaded.tournaments) {
    if (t.name === undefined) t.name = null;
  }
  // Saves persisted before the KenPom/RPI/bracketology feature won't have
  // teamId on existing stat rows — best-effort backfill from the player's
  // current team (wrong only for the rare case of a stat line predating a
  // since-completed transfer).
  if (loaded.stats.some((s: any) => s.teamId === undefined)) {
    const teamByPlayer = new Map(loaded.players.map((p) => [p.id, p.teamId]));
    for (const s of loaded.stats) {
      if ((s as any).teamId === undefined) s.teamId = teamByPlayer.get(s.playerId) ?? "";
    }
  }
  // Saves persisted before the international tour feature won't have these
  // fields on existing teams, or the tours array at all.
  if (!loaded.internationalTours) loaded.internationalTours = [];
  for (const t of loaded.teams) {
    if (t.internationalTourCountry === undefined) t.internationalTourCountry = null;
    if (t.internationalTourSeasonYear === undefined) t.internationalTourSeasonYear = null;
  }
  // Saves persisted before the realistic in-game injury feature won't have
  // this field on existing players.
  for (const p of loaded.players) {
    if (p.injuryType === undefined) p.injuryType = null;
  }
  cache = loaded;
  return loaded;
}

export const api = {
  listSaves: () => persistence.listSaves(),

  createSave: async (data: {
    name: string; division: string; teamSchoolName: string; coachName: string;
    coachArchetype?: string; coachBackground?: string | null; playingCareer?: PlayingCareerChoice;
  }) => {
    const state = createSaveWorld({
      saveName: data.name, division: data.division as Division, teamSchoolName: data.teamSchoolName, coachName: data.coachName,
      coachArchetype: data.coachArchetype as CoachArchetype | undefined,
      coachBackground: (data.coachBackground ?? null) as CoachBackground | null,
      playingCareer: data.playingCareer ?? NO_PLAYING_CAREER,
    });
    cache = state;
    await persistence.persistSave(state);
    return state.save;
  },

  getCoachOptions: async () => ({ archetypes: COACH_ARCHETYPES, backgrounds: COACH_BACKGROUNDS, countries: INTERNATIONAL_COUNTRIES }),

  getAllTeams: async () => allNationalTeams(),

  generateCoachOffers: async (data: { coachArchetype: string; coachBackground: string | null; playingCareer: PlayingCareerChoice }) => {
    const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
    return generateStartingJobOffers(
      { archetype: data.coachArchetype as CoachArchetype, background: data.coachBackground as CoachBackground | null, playingCareer: data.playingCareer },
      allNationalTeams(),
      rng,
    );
  },

  deleteSave: async (id: string) => {
    if (cache?.save.id === id) cache = null;
    await persistence.deleteSave(id);
  },

  listLeagueTeams: async (division: string) => {
    const league = loadLeagueData(division as Division);
    return league.conferences.flatMap((c) =>
      c.members.map((m) => ({ school: m.school, conference: c.name, division, state: m.state, prestige: prestigeTierToScore(m.prestigeTier) })),
    );
  },

  getDashboard: async (saveId: string) => queries.getDashboard(await ensureLoaded(saveId)),
  getRoster: async (saveId: string) => queries.getRoster(await ensureLoaded(saveId)),
  getWalkOns: async (saveId: string) => queries.getWalkOns(await ensureLoaded(saveId)),
  addWalkOn: async (saveId: string, candidateId: string) => {
    const state = await ensureLoaded(saveId);
    const result = actions.addWalkOn(state, candidateId);
    await persistence.persistSave(state);
    return result;
  },
  getDisciplineDrops: async (saveId: string) => queries.getDisciplineDrops(await ensureLoaded(saveId)),
  signDisciplineDrop: async (saveId: string, playerId: string) => {
    const state = await ensureLoaded(saveId);
    const result = actions.signDisciplineDrop(state, playerId);
    await persistence.persistSave(state);
    return result;
  },
  getSchedule: async (saveId: string) => queries.getSchedule(await ensureLoaded(saveId)),
  getGameBoxScore: async (saveId: string, gameId: string) => queries.getGameBoxScore(await ensureLoaded(saveId), gameId),
  getTeamProfile: async (saveId: string, teamId: string) => queries.getTeamProfile(await ensureLoaded(saveId), teamId),
  getStandings: async (saveId: string, conferenceId?: string) => queries.getStandings(await ensureLoaded(saveId), conferenceId),
  getConferences: async (saveId: string, division: string) => queries.getConferences(await ensureLoaded(saveId), division),
  getKenPom: async (saveId: string, division?: string) => queries.getKenPom(await ensureLoaded(saveId), division),
  getRPI: async (saveId: string, division?: string) => queries.getRPI(await ensureLoaded(saveId), division),
  getBracketology: async (saveId: string) => queries.getBracketology(await ensureLoaded(saveId)),
  getApPoll: async (saveId: string, division?: string) => queries.getApPoll(await ensureLoaded(saveId), division),
  getCoachStats: async (saveId: string) => queries.getCoachStats(await ensureLoaded(saveId)),
  getRivalries: async (saveId: string) => queries.getRivalries(await ensureLoaded(saveId)),
  getSeasonCalendar: async (saveId: string) => queries.getSeasonCalendar(await ensureLoaded(saveId)),
  getHotSeatBoard: async (saveId: string) => queries.getHotSeatBoard(await ensureLoaded(saveId)),
  getPlayerProfile: async (saveId: string, playerId: string) => queries.getPlayerProfile(await ensureLoaded(saveId), playerId),
  getCoachProfile: async (saveId: string, coachId: string) => queries.getCoachProfile(await ensureLoaded(saveId), coachId),
  getADProfile: async (saveId: string, adId: string) => queries.getADProfile(await ensureLoaded(saveId), adId),

  advance: async (saveId: string) => {
    const state = await ensureLoaded(saveId);
    const result = advanceOneDay(state);
    await persistence.persistSave(state);
    return result;
  },
  autoAdvance: async (saveId: string, maxDays: number) => {
    const state = await ensureLoaded(saveId);
    const result = advanceMultipleDays(state, maxDays);
    await persistence.persistSave(state);
    return result;
  },

  getRecruitingBoard: async (saveId: string) => actions.getRecruitingBoard(await ensureLoaded(saveId)),
  pursueRecruit: async (saveId: string, prospectId: string, points: number) => {
    const state = await ensureLoaded(saveId);
    const result = actions.pursueRecruit(state, prospectId, points);
    await persistence.persistSave(state);
    return result;
  },

  getTransferBoard: async (saveId: string) => actions.getTransferBoard(await ensureLoaded(saveId)),
  pursueTransfer: async (saveId: string, playerId: string, points: number) => {
    const state = await ensureLoaded(saveId);
    const result = actions.pursueTransfer(state, playerId, points);
    await persistence.persistSave(state);
    return result;
  },

  getPreseasonTournaments: async (saveId: string) => actions.getPreseasonTournaments(await ensureLoaded(saveId)),
  joinPreseasonTournament: async (saveId: string, tournamentId: string) => {
    const state = await ensureLoaded(saveId);
    const result = actions.joinPreseasonTournament(state, tournamentId);
    await persistence.persistSave(state);
    return result;
  },
  leavePreseasonTournament: async (saveId: string, tournamentId: string) => {
    const state = await ensureLoaded(saveId);
    const result = actions.leavePreseasonTournament(state, tournamentId);
    await persistence.persistSave(state);
    return result;
  },

  getInternationalTour: async (saveId: string) => actions.getInternationalTour(await ensureLoaded(saveId)),
  bookInternationalTour: async (saveId: string, country: string) => {
    const state = await ensureLoaded(saveId);
    const result = actions.bookInternationalTour(state, country);
    await persistence.persistSave(state);
    return result;
  },

  getGamePreview: async (saveId: string, gameId: string) => queries.getGamePreview(await ensureLoaded(saveId), gameId),

  getPendingEvents: async (saveId: string) => actions.getPendingEvents(await ensureLoaded(saveId)),
  resolveEvent: async (saveId: string, eventId: string, optionId: string) => {
    const state = await ensureLoaded(saveId);
    const result = actions.resolveEvent(state, eventId, optionId);
    await persistence.persistSave(state);
    return result;
  },

  getJobOffers: async (saveId: string) => actions.getJobOffers(await ensureLoaded(saveId)),
  acceptJob: async (saveId: string, teamId: string) => {
    const state = await ensureLoaded(saveId);
    const result = actions.acceptJob(state, teamId);
    await persistence.persistSave(state);
    return result;
  },
  requestRaise: async (saveId: string) => {
    const state = await ensureLoaded(saveId);
    const result = actions.requestRaise(state);
    await persistence.persistSave(state);
    return result;
  },
  resignAndAccept: async (saveId: string, teamId: string) => {
    const state = await ensureLoaded(saveId);
    const result = actions.resignAndAccept(state, teamId);
    await persistence.persistSave(state);
    return result;
  },
  upgradeArena: async (saveId: string) => {
    const state = await ensureLoaded(saveId);
    const result = actions.upgradeArena(state);
    await persistence.persistSave(state);
    return result;
  },
  respondToConferenceInvite: async (
    saveId: string,
    accept: boolean,
    targetConferenceId: string,
    targetDivision: string,
    replacingTeamId: string
  ) => {
    const state = await ensureLoaded(saveId);
    const result = actions.respondToConferenceInvite(state, accept, targetConferenceId, targetDivision as any, replacingTeamId);
    await persistence.persistSave(state);
    return result;
  },
};
