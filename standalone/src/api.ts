import * as persistence from "./state/persistence";
import { createSaveWorld } from "./state/createSaveWorld";
import { advanceOneDay } from "./state/advance";
import { loadLeagueData, prestigeTierToScore } from "./state/leagueData";
import * as queries from "./state/queries";
import * as actions from "./state/actions";
import type { WorldState } from "./state/types";
import type { Division } from "./types";

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

  createSave: async (data: { name: string; division: string; teamSchoolName: string; coachName: string }) => {
    const state = createSaveWorld({
      saveName: data.name, division: data.division as Division, teamSchoolName: data.teamSchoolName, coachName: data.coachName,
    });
    cache = state;
    await persistence.persistSave(state);
    return state.save;
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
};
