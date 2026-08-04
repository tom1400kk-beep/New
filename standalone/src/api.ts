import * as persistence from "./state/persistence";
import { createSaveWorld } from "./state/createSaveWorld";
import { advanceOneDay } from "./state/advance";
import { loadLeagueData, prestigeTierToScore } from "./state/leagueData";
import * as queries from "./state/queries";
import * as actions from "./state/actions";
import { COACH_ARCHETYPES, type CoachArchetype } from "./engine/coachArchetypes";
import { COACH_BACKGROUNDS, type CoachBackground } from "./engine/coachBackgrounds";
import { NO_PLAYING_CAREER, type PlayingCareerChoice } from "./engine/playingCareer";
import { generateStartingJobOffers, type CandidateJob } from "./engine/coachCreation";
import { EUROPEAN_COUNTRIES } from "./engine/countries";
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

  getCoachOptions: async () => ({ archetypes: COACH_ARCHETYPES, backgrounds: COACH_BACKGROUNDS, countries: EUROPEAN_COUNTRIES }),

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
  getSchedule: async (saveId: string) => queries.getSchedule(await ensureLoaded(saveId)),
  getStandings: async (saveId: string) => queries.getStandings(await ensureLoaded(saveId)),
  getRivalries: async (saveId: string) => queries.getRivalries(await ensureLoaded(saveId)),

  advance: async (saveId: string) => {
    const state = await ensureLoaded(saveId);
    const result = advanceOneDay(state);
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
  leavePreseasonTournament: async (saveId: string) => {
    const state = await ensureLoaded(saveId);
    const result = actions.leavePreseasonTournament(state);
    await persistence.persistSave(state);
    return result;
  },

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
};
