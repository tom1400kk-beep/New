import { computeStandings } from "./standings";
import { updateHotSeat, updatePrestige, updateReputation, shouldFire, generateJobOffers } from "../engine/career";
import { generateRosterForTeam, generateHighSchoolProspect, generateJucoProspect } from "../engine/generation";
import { generateSeasonSchedule } from "../engine/schedule";
import { mulberry32, clamp, randNormal, randInt } from "../engine/rng";
import { randomFirstName, randomLastName } from "../engine/names";
import { commitmentWeights } from "../engine/recruiting";
import type { ClassYear, Division } from "../types";
import { DIVISION_RULES } from "../types";
import { newId, type WorldState } from "./types";

const CLASS_PROGRESSION: Record<ClassYear, ClassYear | null> = { FR: "SO", SO: "JR", JR: "SR", SR: null, GR: null };

function tournamentWinsForTeam(state: WorldState, seasonYear: number, teamId: string): { made: boolean; wins: number } {
  const games = state.games.filter((g) => {
    if (g.seasonYear !== seasonYear || !g.isPlayed) return false;
    if (g.homeTeamId !== teamId && g.awayTeamId !== teamId) return false;
    const t = state.tournaments.find((tt) => tt.id === g.tournamentId);
    return t && ["NCAA_TOURNAMENT", "D2_NATIONAL", "D3_NATIONAL"].includes(t.type);
  });
  if (games.length === 0) return { made: false, wins: 0 };
  const wins = games.filter((g) => (g.homeTeamId === teamId ? (g.homeScore ?? 0) > (g.awayScore ?? 0) : (g.awayScore ?? 0) > (g.homeScore ?? 0))).length;
  return { made: true, wins };
}

export interface OffseasonResult {
  userFired: boolean;
  jobOffers: { teamId: string; teamName: string; prestige: number }[];
}

export function runOffseason(state: WorldState): OffseasonResult {
  const seasonYear = state.save.currentSeasonYear;
  const division = state.teams[0]?.division as Division;
  const standings = computeStandings(state, seasonYear);
  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));

  let userFired = false;
  let userTeamId: string | null = null;
  let userNewReputation = 50;
  let userNewPrestige = 50;
  let jobOffers: OffseasonResult["jobOffers"] = [];
  const vacancies: { teamId: string; prestige: number }[] = [];

  for (const team of state.teams) {
    const headCoach = state.coaches.find((c) => c.id === team.headCoachId);
    if (!headCoach) continue;
    const record = standings.get(team.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
    const { made, wins } = tournamentWinsForTeam(state, seasonYear, team.id);

    const newHotSeat = updateHotSeat(headCoach.hotSeatLevel, record.wins, record.losses, team.prestige);
    const fired = shouldFire(newHotSeat, rng);
    const newReputation = updateReputation(headCoach.reputation, record.wins, record.losses, made, wins, fired);
    const newPrestige = updatePrestige(team.prestige, record.wins, record.losses, made, wins);

    if (headCoach.isPlayerControlled) {
      userTeamId = team.id;
      userNewReputation = newReputation;
      userNewPrestige = newPrestige;
      if (fired) userFired = true;
    }

    if (fired) {
      vacancies.push({ teamId: team.id, prestige: newPrestige });
      const skillMean = 45 + team.prestige * 0.2;
      const replacementSkills = {
        reputation: Math.round(clamp(randNormal(rng, team.prestige * 0.5 + 15, 12), 5, 90)),
        offenseSkill: Math.round(clamp(randNormal(rng, skillMean, 12), 15, 95)),
        defenseSkill: Math.round(clamp(randNormal(rng, skillMean, 12), 15, 95)),
        recruitingSkill: Math.round(clamp(randNormal(rng, skillMean, 12), 15, 95)),
        developmentSkill: Math.round(clamp(randNormal(rng, skillMean, 12), 15, 95)),
      };
      if (headCoach.isPlayerControlled) {
        const replacement = {
          id: newId(), name: `${randomFirstName(rng)} ${randomLastName(rng)}`, isPlayerControlled: false,
          hotSeatLevel: 0, ...replacementSkills, careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
        };
        state.coaches.push(replacement);
        team.headCoachId = replacement.id;
        headCoach.careerWins += record.wins;
        headCoach.careerLosses += record.losses;
      } else {
        Object.assign(headCoach, {
          name: `${randomFirstName(rng)} ${randomLastName(rng)}`, isPlayerControlled: false, hotSeatLevel: 0,
          ...replacementSkills, careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
        });
      }
    } else {
      Object.assign(headCoach, {
        hotSeatLevel: newHotSeat, reputation: newReputation,
        careerWins: headCoach.careerWins + record.wins, careerLosses: headCoach.careerLosses + record.losses,
        yearsAtCurrentJob: headCoach.yearsAtCurrentJob + 1,
      });
    }

    team.prestige = newPrestige;
  }

  if (userTeamId) {
    const openings = vacancies.filter((v) => v.teamId !== userTeamId);
    const maxOffers = userFired ? 3 : 2;
    const offers = generateJobOffers(userNewReputation, userNewPrestige, openings, rng, maxOffers);
    if (offers.length > 0) {
      jobOffers = offers.map((o) => {
        const t = state.teams.find((tt) => tt.id === o.teamId)!;
        return { teamId: t.id, teamName: t.name, prestige: t.prestige };
      });
    }
    if (userFired) state.save.coachTeamId = null;
  }

  // Roster progression: graduate seniors, develop everyone else
  for (const p of [...state.players]) {
    if (!p.teamId) continue;
    const nextClass = CLASS_PROGRESSION[p.classYear as ClassYear];
    if (nextClass === null || p.eligibilityYearsLeft <= 1) {
      p.teamId = null;
      continue;
    }
    const growth = Math.round(((p.potential - (p.scoring + p.defense + p.rebounding) / 3) / 100) * randInt(rng, 6, 14));
    p.classYear = nextClass;
    p.eligibilityYearsLeft -= 1;
    p.scoring = Math.round(clamp(p.scoring + growth, 15, 99));
    p.threePoint = Math.round(clamp(p.threePoint + growth, 15, 99));
    p.finishing = Math.round(clamp(p.finishing + growth, 15, 99));
    p.playmaking = Math.round(clamp(p.playmaking + growth, 15, 99));
    p.rebounding = Math.round(clamp(p.rebounding + growth, 15, 99));
    p.defense = Math.round(clamp(p.defense + growth, 15, 99));
  }

  // Recruiting resolution
  const classToSign = state.prospects.filter((p) => !p.signed && p.graduationYear === seasonYear + 1);
  for (const prospect of classToSign) {
    const interests = state.interests.filter((i) => i.prospectId === prospect.id);
    if (interests.length === 0) continue;
    const weights = commitmentWeights(interests.map((i) => ({ teamId: i.teamId, interest: i.interestLevel })));
    const total = weights.reduce((s, w) => s + w.weight, 0);
    if (total <= 0) continue;
    let r = rng() * total;
    let winnerTeamId = weights[0]?.teamId;
    for (const w of weights) {
      r -= w.weight;
      if (r <= 0) { winnerTeamId = w.teamId; break; }
    }

    prospect.signed = true;
    prospect.committedTeamId = winnerTeamId;
    state.players.push({
      id: newId(), teamId: winnerTeamId, firstName: prospect.firstName, lastName: prospect.lastName,
      position: prospect.position, classYear: "FR", heightInches: 76, hometownState: prospect.hometownState,
      origin: prospect.source === "JUCO" ? "JUCO" : "HIGH_SCHOOL",
      scoring: prospect.scoring, threePoint: prospect.threePoint, finishing: prospect.finishing,
      playmaking: prospect.playmaking, rebounding: prospect.rebounding, defense: prospect.defense,
      athleticism: prospect.athleticism, basketballIq: prospect.basketballIq,
      stamina: Math.round(clamp(randNormal(rng, 65, 15), 20, 99)),
      potential: prospect.potential, characterRating: prospect.characterRating, chemistryImpact: 0,
      eligibilityYearsLeft: prospect.source === "JUCO" ? 2 : 4, inTransferPortal: false, isInjured: false, injuryWeeksLeft: 0,
    });
  }

  // Next recruiting class
  const teamCount = state.teams.length;
  for (let i = 0; i < Math.round(teamCount * 3); i++) {
    const p = generateHighSchoolProspect(rng, seasonYear + 2);
    state.prospects.push({
      id: newId(), firstName: p.firstName, lastName: p.lastName, position: p.position, hometownState: p.hometownState,
      source: p.source, starRating: p.starRating, scoring: p.ratings.scoring, threePoint: p.ratings.threePoint,
      finishing: p.ratings.finishing, playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding,
      defense: p.ratings.defense, athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq,
      potential: p.ratings.potential, characterRating: p.ratings.characterRating, scoutingNoise: p.scoutingNoise,
      graduationYear: p.graduationYear, signed: false, committedTeamId: null,
    });
  }
  for (let i = 0; i < Math.round(teamCount * 0.6); i++) {
    const p = generateJucoProspect(rng, seasonYear + 2);
    state.prospects.push({
      id: newId(), firstName: p.firstName, lastName: p.lastName, position: p.position, hometownState: p.hometownState,
      source: p.source, starRating: p.starRating, scoring: p.ratings.scoring, threePoint: p.ratings.threePoint,
      finishing: p.ratings.finishing, playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding,
      defense: p.ratings.defense, athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq,
      potential: p.ratings.potential, characterRating: p.ratings.characterRating, scoutingNoise: p.scoutingNoise,
      graduationYear: p.graduationYear, signed: false, committedTeamId: null,
    });
  }

  // Backfill rosters below cap
  const rosterCap = DIVISION_RULES[division].rosterCap;
  for (const team of state.teams) {
    const rosterCount = state.players.filter((p) => p.teamId === team.id).length;
    const need = rosterCap - rosterCount;
    if (need <= 0) continue;
    const roster = generateRosterForTeam(rng, team.prestige, division, need);
    for (const p of roster) {
      state.players.push({
        id: newId(), teamId: team.id, firstName: p.firstName, lastName: p.lastName, position: p.position,
        classYear: "FR", heightInches: p.ratings.heightInches, hometownState: p.hometownState, origin: p.origin,
        scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
        playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
        athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq,
        stamina: Math.round(clamp(randNormal(rng, 65, 15), 20, 99)), potential: p.ratings.potential,
        characterRating: p.ratings.characterRating, chemistryImpact: 0, eligibilityYearsLeft: 4,
        inTransferPortal: false, isInjured: false, injuryWeeksLeft: 0,
      });
    }
  }

  // Next season schedule
  const nextSeasonYear = seasonYear + 1;
  state.seasons.push({ id: newId(), year: nextSeasonYear });
  const scheduleTeams = state.teams.map((t) => ({ id: t.id, conferenceId: t.conferenceId }));
  const schedule = generateSeasonSchedule(scheduleTeams, division, nextSeasonYear, rng);
  for (const g of schedule) {
    state.games.push({
      id: newId(), seasonYear: nextSeasonYear, date: g.date, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
      homeScore: null, awayScore: null, isPlayed: false, isConference: g.isConference,
      tournamentId: null, round: null, bracketSlot: null,
    });
  }

  state.save.currentSeasonYear = nextSeasonYear;
  state.save.currentDate = new Date(Date.UTC(nextSeasonYear, 9, 1));
  state.save.currentPhase = userFired ? "OFFSEASON" : "PRESEASON";

  return { userFired, jobOffers };
}
