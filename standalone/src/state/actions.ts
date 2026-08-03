import { computeInterestGain, weeklyRecruitingPoints, type RecruitingProspectInput, type RecruitingTeamInput } from "../engine/recruiting";
import { PRIORITY_KEYS, topPriorities, type PriorityKey, type PriorityProfile } from "../engine/priorities";
import { clamp, randInt, mulberry32 } from "../engine/rng";
import type { EventEffects, EventOption } from "../engine/events";
import { computeStandings, winPct } from "./standings";
import { newId, type WorldState } from "./types";

function noisy(rng: () => number, value: number, noise: number): number {
  return Math.round(clamp(value + randInt(rng, -noise, noise), 1, 99));
}

function playerOverall(p: { scoring: number; threePoint: number; finishing: number; playmaking: number; rebounding: number; defense: number; athleticism: number; basketballIq: number }): number {
  return Math.round((p.scoring + p.threePoint + p.finishing + p.playmaking + p.rebounding + p.defense + p.athleticism + p.basketballIq) / 8);
}

function parsePriorities(json: string): PriorityProfile {
  try {
    const parsed = JSON.parse(json);
    const profile = {} as PriorityProfile;
    for (const key of PRIORITY_KEYS) profile[key] = parsed[key] ?? 0;
    return profile;
  } catch {
    const even = 100 / PRIORITY_KEYS.length;
    return PRIORITY_KEYS.reduce((acc, k) => ({ ...acc, [k]: even }), {} as PriorityProfile);
  }
}

export interface RecruitingBoardEntry {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  hometownState: string;
  countryOfOrigin: string | null;
  source: string;
  starRating: number;
  graduationYear: number;
  topPriorities: PriorityKey[];
  scouted: {
    scoring: number; threePoint: number; finishing: number; playmaking: number;
    rebounding: number; defense: number; athleticism: number; characterRating: number; disciplineRating: number;
  };
  interestLevel: number;
  pointsInvested: number;
  offered: boolean;
}

export function getRecruitingBoard(state: WorldState): RecruitingBoardEntry[] {
  if (!state.save.coachTeamId) return [];
  const teamId = state.save.coachTeamId;
  const rng = mulberry32(42);

  return state.prospects
    .filter((p) => !p.signed && p.graduationYear >= state.save.currentSeasonYear + 1)
    .sort((a, b) => b.starRating - a.starRating)
    .slice(0, 200)
    .map((p) => {
      const interest = state.interests.find((i) => i.prospectId === p.id && i.teamId === teamId);
      return {
        id: p.id, firstName: p.firstName, lastName: p.lastName, position: p.position,
        hometownState: p.hometownState, countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating, graduationYear: p.graduationYear,
        topPriorities: topPriorities(parsePriorities(p.prioritiesJson), 3),
        scouted: {
          scoring: noisy(rng, p.scoring, p.scoutingNoise), threePoint: noisy(rng, p.threePoint, p.scoutingNoise),
          finishing: noisy(rng, p.finishing, p.scoutingNoise), playmaking: noisy(rng, p.playmaking, p.scoutingNoise),
          rebounding: noisy(rng, p.rebounding, p.scoutingNoise), defense: noisy(rng, p.defense, p.scoutingNoise),
          athleticism: noisy(rng, p.athleticism, p.scoutingNoise), characterRating: noisy(rng, p.characterRating, p.scoutingNoise + 5),
          disciplineRating: noisy(rng, p.disciplineRating, p.scoutingNoise + 8),
        },
        interestLevel: interest?.interestLevel ?? 0, pointsInvested: interest?.pointsInvested ?? 0, offered: interest?.offered ?? false,
      };
    });
}

export function pursueRecruit(state: WorldState, prospectId: string, points: number) {
  if (!state.save.coachTeamId) throw new Error("No active team");
  const spendRequested = Math.max(1, Math.min(50, points || 10));
  const team = state.teams.find((t) => t.id === state.save.coachTeamId)!;
  const coach = state.coaches.find((c) => c.id === team.headCoachId)!;
  const prospect = state.prospects.find((p) => p.id === prospectId)!;
  const assistants = state.assistants.filter((a) => a.teamId === team.id && a.role === "RECRUITING");
  const bestAssistant = Math.max(0, ...assistants.map((a) => a.rating), 0);

  const budget = weeklyRecruitingPoints(coach.recruitingSkill, bestAssistant);
  const spend = Math.min(spendRequested, budget);

  let interest = state.interests.find((i) => i.prospectId === prospectId && i.teamId === team.id);
  const pointsInvested = (interest?.pointsInvested ?? 0) + spend;

  const standings = computeStandings(state, state.save.currentSeasonYear);
  const record = standings.get(team.id);
  const recentWinPct = record && record.wins + record.losses > 0 ? winPct(record) : team.prestige / 100;
  const roster = state.players.filter((p) => p.teamId === team.id);

  const prospectInput: RecruitingProspectInput = {
    position: prospect.position, hometownState: prospect.hometownState, countryOfOrigin: prospect.countryOfOrigin,
    characterRating: prospect.characterRating, scoring: prospect.scoring, threePoint: prospect.threePoint,
    finishing: prospect.finishing, playmaking: prospect.playmaking, rebounding: prospect.rebounding, defense: prospect.defense,
    starRating: prospect.starRating, priorities: parsePriorities(prospect.prioritiesJson),
  };

  const teamInput: RecruitingTeamInput = {
    state: team.state, prestige: team.prestige, nilBudget: team.nilBudget, facilitiesRating: team.facilitiesRating,
    academicReputation: team.academicReputation, internationalScoutingRating: team.internationalScoutingRating,
    recruitingSkill: coach.recruitingSkill, assistantRecruitingSkill: bestAssistant, developmentSkill: coach.developmentSkill,
    offenseSkill: coach.offenseSkill, defenseSkill: coach.defenseSkill, hotSeatLevel: coach.hotSeatLevel,
    recentWinPct, roster: roster.map((p) => ({ position: p.position, overall: playerOverall(p), characterRating: p.characterRating })),
  };

  const gain = computeInterestGain(prospectInput, teamInput, pointsInvested);

  if (interest) {
    interest.interestLevel = Math.round(gain);
    interest.pointsInvested = pointsInvested;
    interest.offered = true;
  } else {
    interest = { id: newId(), prospectId, teamId: team.id, interestLevel: Math.round(gain), pointsInvested, offered: true, visitCompleted: false };
    state.interests.push(interest);
  }
  return interest;
}

export function getPendingEvents(state: WorldState) {
  return state.events
    .filter((e) => e.status === "PENDING")
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((e) => ({ ...e, options: JSON.parse(e.optionsJson) as EventOption[] }));
}

export function resolveEvent(state: WorldState, eventId: string, optionId: string) {
  const event = state.events.find((e) => e.id === eventId);
  if (!event) throw new Error("Event not found");
  const options = JSON.parse(event.optionsJson) as EventOption[];
  const chosen = options.find((o) => o.id === optionId);
  if (!chosen) throw new Error("Invalid option");

  applyEffects(state, event.teamId, event.playerId, chosen.effects);
  event.status = "RESOLVED";
  event.chosenOptionId = chosen.id;
  return { resolved: true };
}

function applyEffects(state: WorldState, teamId: string | null, playerId: string | null, effects: EventEffects) {
  if (teamId) {
    const team = state.teams.find((t) => t.id === teamId);
    if (team) {
      if (effects.prestigeDelta) team.prestige = Math.round(clamp(team.prestige + effects.prestigeDelta, 5, 99));
      if (effects.nilBudgetDelta) team.nilBudget = Math.max(0, team.nilBudget + effects.nilBudgetDelta);
      if (effects.hotSeatDelta) {
        const coach = state.coaches.find((c) => c.id === team.headCoachId);
        if (coach) coach.hotSeatLevel = Math.round(clamp(coach.hotSeatLevel + effects.hotSeatDelta, 0, 100));
      }
      if (effects.chemistryDelta) {
        for (const p of state.players) {
          if (p.teamId === team.id) p.characterRating = Math.round(clamp(p.characterRating + effects.chemistryDelta!, 5, 99));
        }
      }
    }
  }

  if (playerId) {
    const player = state.players.find((p) => p.id === playerId);
    if (player) {
      if (effects.playerCharacterDelta) player.characterRating = Math.round(clamp(player.characterRating + effects.playerCharacterDelta, 5, 99));
      if (effects.injuryWeeks) { player.isInjured = true; player.injuryWeeksLeft = effects.injuryWeeks * 7; }
      if (effects.suspensionDays) { player.isSuspended = true; player.suspensionDaysLeft = effects.suspensionDays; }
      if (effects.removePlayer) player.teamId = null;
    }
  }
}

export function getJobOffers(state: WorldState) {
  if (state.save.coachTeamId) return [];
  return state.teams
    .filter((t) => {
      const c = state.coaches.find((cc) => cc.id === t.headCoachId);
      return c && !c.isPlayerControlled && c.hotSeatLevel === 0 && c.careerWins === 0 && c.careerLosses === 0;
    })
    .map((t) => ({ teamId: t.id, teamName: t.name, prestige: t.prestige, division: t.division }));
}

export function acceptJob(state: WorldState, teamId: string) {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) throw new Error("Team not found");
  const newTeamCoach = state.coaches.find((c) => c.id === team.headCoachId);
  if (!newTeamCoach) throw new Error("Team has no coach slot");

  const priorCoach = state.coaches.find((c) => c.isPlayerControlled);

  newTeamCoach.isPlayerControlled = false;
  if (priorCoach) {
    team.headCoachId = priorCoach.id;
    priorCoach.isPlayerControlled = true;
    priorCoach.hotSeatLevel = 0;
    priorCoach.yearsAtCurrentJob = 0;
  }

  state.save.coachTeamId = teamId;
  state.save.currentPhase = "PRESEASON";
  return { ok: true };
}
