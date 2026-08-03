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
      3,
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
  getSchedule: async (saveId: string) => queries.getSchedule(await ensureLoaded(saveId)),
  getStandings: async (saveId: string) => queries.getStandings(await ensureLoaded(saveId)),

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
};
