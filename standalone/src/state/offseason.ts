import { computeStandings } from "./standings";
import { updateHotSeat, updatePrestige, updateReputation, shouldFire, generateJobOffers, driftLegalityReputation, expectedWinPct, meetsLegalityBar } from "../engine/career";
import { disciplineDismissalChance, disciplineSigningReputationHit } from "../engine/disciplineDrops";
import { parsePipelineStates, decayPipeline, bumpPipelineState } from "../engine/pipeline";
import { generateProspectPriorities } from "../engine/priorities";
import { generateADTraits, adTurnoverRoll, parseAdRelationships, updateAdRelationship } from "../engine/athleticDirector";
import { driftPerception } from "../engine/media";
import { atmosphereTarget, driftAtmosphere } from "../engine/atmosphere";
import { sortedPair, growIntensityOnMeeting, decayIntensity, postseasonForgedIntensity, POSTSEASON_RIVALRY_THRESHOLD } from "../engine/rivalry";
import { generateRosterForTeam, generateHighSchoolProspect, generateJucoProspect, generateInternationalProspect } from "../engine/generation";
import { generateSeasonSchedule } from "../engine/schedule";
import { generatePreseasonTournaments } from "./preseasonTournaments";
import { generateDivisionInSeasonEvents } from "./inSeasonEvents";
import { mulberry32, clamp, randNormal, randInt } from "../engine/rng";
import { randomFirstName, randomLastName } from "../engine/names";
import {
  commitmentWeights,
  driftProspectRating,
  JUNIOR_EARLY_COMMIT_CHANCE,
  JUNIOR_DECOMMIT_BASE_CHANCE,
  JUNIOR_DECOMMIT_COACH_FIRED_CHANCE,
} from "../engine/recruiting";
import { generateCoachSkills, randomArchetype } from "../engine/coachArchetypes";
import { maybeGenerateNILPoachingEvent, type NILPoachingContext } from "../engine/nilPoaching";
import { poachingDestinationPool, generatePoachingInterest, type PortalCandidateTeam } from "../engine/portalPoaching";
import { overall } from "../engine/simulate";
import { evaluateRealignmentInvite, type RealignmentInvite } from "../engine/conferenceRealignment";
import type { ClassYear, Division } from "../types";
import { DIVISION_RULES } from "../types";
import { newId, type WorldState, type RivalryRow, type GameEventRow, type CoachSeasonRecordRow } from "./types";

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
  conferenceInvite: RealignmentInvite | null;
}

export function runOffseason(state: WorldState): OffseasonResult {
  const seasonYear = state.save.currentSeasonYear;
  const divisionByTeam = new Map(state.teams.map((t) => [t.id, t.division as Division]));
  const standings = computeStandings(state, seasonYear);
  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));

  // Rivalries: active ones feed a hot-seat term for the player (fans and the
  // AD notice a rivalry record independent of the overall one), and all of
  // this season's games double as the source data for meeting counts below.
  const activeRivalries = state.rivalries.filter((r) => r.active);
  const rivalTeamIdsByTeam = new Map<string, Set<string>>();
  for (const r of activeRivalries) {
    if (!rivalTeamIdsByTeam.has(r.teamAId)) rivalTeamIdsByTeam.set(r.teamAId, new Set());
    if (!rivalTeamIdsByTeam.has(r.teamBId)) rivalTeamIdsByTeam.set(r.teamBId, new Set());
    rivalTeamIdsByTeam.get(r.teamAId)!.add(r.teamBId);
    rivalTeamIdsByTeam.get(r.teamBId)!.add(r.teamAId);
  }
  const seasonGames = state.games.filter((g) => g.seasonYear === seasonYear && g.isPlayed);

  let userFired = false;
  let userTeamId: string | null = null;
  let userNewReputation = 50;
  let userNewPrestige = 50;
  let userNewLegality = 75;
  let userNewAdRelationshipsJson = "{}";
  let jobOffers: OffseasonResult["jobOffers"] = [];
  let conferenceInvite: RealignmentInvite | null = null;
  const vacancies: { teamId: string; prestige: number; academicReputation: number }[] = [];
  const firedTeamIds = new Set<string>();
  // AI teams whose coach was just fired -- resolved after the main loop by
  // the coaching carousel below, which may hire them out to a different
  // program instead of just discarding them into a fresh random replacement.
  const departingCoaches: { teamId: string; coachId: string; reputation: number; legalityReputation: number; priorPrestige: number }[] = [];

  for (const team of state.teams) {
    const headCoach = state.coaches.find((c) => c.id === team.headCoachId);
    if (!headCoach) continue;
    const record = standings.get(team.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
    const { made, wins } = tournamentWinsForTeam(state, seasonYear, team.id);

    // Per-season history: independent of the cumulative careerWins/Losses bump
    // below, this is what lets a coach stats page answer "how'd I do at each
    // stop" instead of only the career-total line.
    const existingSeasonRecord = state.coachSeasonRecords.find((r) => r.coachId === headCoach.id && r.seasonYear === seasonYear);
    const seasonRecordRow: CoachSeasonRecordRow = existingSeasonRecord ?? { id: newId(), coachId: headCoach.id, teamId: team.id, seasonYear, wins: 0, losses: 0, confWins: 0, confLosses: 0, madePostseason: false, postseasonWins: 0 };
    seasonRecordRow.teamId = team.id;
    seasonRecordRow.wins = record.wins;
    seasonRecordRow.losses = record.losses;
    seasonRecordRow.confWins = record.confWins;
    seasonRecordRow.confLosses = record.confLosses;
    seasonRecordRow.madePostseason = made;
    seasonRecordRow.postseasonWins = wins;
    if (!existingSeasonRecord) state.coachSeasonRecords.push(seasonRecordRow);

    const games = record.wins + record.losses || 1;
    const winPct = record.wins / games;
    const ad = state.athleticDirectors.find((a) => a.id === team.athleticDirectorId);
    const coachAdRelationships = parseAdRelationships(headCoach.adRelationshipsJson);
    const currentRelScore = ad ? coachAdRelationships[ad.id] ?? 50 : 50;

    // Only worth computing for the player — AI coaches' hot seat never
    // surfaces this level of detail to anyone.
    let rivalryWinPct: number | undefined;
    if (headCoach.isPlayerControlled) {
      const rivalIds = rivalTeamIdsByTeam.get(team.id);
      if (rivalIds && rivalIds.size > 0) {
        const rivalGames = seasonGames.filter((g) =>
          (g.homeTeamId === team.id && rivalIds.has(g.awayTeamId)) || (g.awayTeamId === team.id && rivalIds.has(g.homeTeamId)));
        if (rivalGames.length > 0) {
          const rivalWins = rivalGames.filter((g) =>
            g.homeTeamId === team.id ? (g.homeScore ?? 0) > (g.awayScore ?? 0) : (g.awayScore ?? 0) > (g.homeScore ?? 0)).length;
          rivalryWinPct = rivalWins / rivalGames.length;
        }
      }
    }

    const newHotSeat = updateHotSeat(headCoach.hotSeatLevel, record.wins, record.losses, team.prestige, {
      archetype: headCoach.archetype,
      legalityReputation: headCoach.legalityReputation,
      academicReputation: team.academicReputation,
      adPatience: ad?.patience,
      adWinFocus: ad?.winFocus,
      campusAtmosphere: headCoach.campusAtmosphere,
      rivalryWinPct,
    });
    const fired = shouldFire(newHotSeat, rng, ad?.loyalty, currentRelScore);
    const newReputation = updateReputation(headCoach.reputation, record.wins, record.losses, made, wins, fired);
    const newPrestige = updatePrestige(team.prestige, record.wins, record.losses, made, wins, headCoach.background);
    const newLegality = driftLegalityReputation(headCoach.legalityReputation);
    const newAtmosphere = driftAtmosphere(headCoach.campusAtmosphere, atmosphereTarget({
      division: team.division as Division, prestige: team.prestige, winPct, expectedWinPct: expectedWinPct(team.prestige),
      yearsAtCurrentJob: headCoach.yearsAtCurrentJob, madeTournament: made, tournamentWins: wins,
    }));
    if (headCoach.isPlayerControlled) {
      headCoach.pipelineStatesJson = JSON.stringify(decayPipeline(parsePipelineStates(headCoach.pipelineStatesJson)));
      if (ad) {
        headCoach.adRelationshipsJson = JSON.stringify({
          ...coachAdRelationships,
          [ad.id]: updateAdRelationship(currentRelScore, winPct, expectedWinPct(team.prestige), fired),
        });
      }
    }

    if (headCoach.isPlayerControlled) {
      userTeamId = team.id;
      userNewReputation = newReputation;
      userNewPrestige = newPrestige;
      userNewLegality = newLegality;
      userNewAdRelationshipsJson = headCoach.adRelationshipsJson;
      if (fired) {
        userFired = true;
      } else {
        conferenceInvite = evaluateRealignmentInvite(
          { id: team.id, name: team.name, conferenceId: team.conferenceId, division: team.division as Division, prestige: newPrestige },
          winPct,
          made,
          wins,
          state.teams.map((t) => ({ id: t.id, name: t.name, conferenceId: t.conferenceId, division: t.division as Division, prestige: t.prestige })),
          state.conferences.map((c) => ({ id: c.id, name: c.name, division: c.division as Division })),
          rng
        );
      }
    }

    if (fired) {
      firedTeamIds.add(team.id);
      vacancies.push({ teamId: team.id, prestige: newPrestige, academicReputation: team.academicReputation });
      if (headCoach.isPlayerControlled) {
        // Bench the user's coach (identity + career stats persist) rather than
        // overwriting them — a fresh AI coach takes over the vacated program.
        const replacementArchetype = randomArchetype(rng);
        const replacementSkillRoll = generateCoachSkills(rng, team.prestige, replacementArchetype);
        const replacement = {
          id: newId(), name: `${randomFirstName(rng)} ${randomLastName(rng)}`, isPlayerControlled: false, hotSeatLevel: 0,
          reputation: replacementSkillRoll.reputation, offenseSkill: replacementSkillRoll.offenseSkill,
          defenseSkill: replacementSkillRoll.defenseSkill, recruitingSkill: replacementSkillRoll.recruitingSkill,
          developmentSkill: replacementSkillRoll.developmentSkill, archetype: replacementArchetype,
          background: null as string | null, playedCollege: false, collegeTeamName: null as string | null,
          collegeState: null as string | null, proPath: "NONE", proCountry: null as string | null,
          legalityReputation: 75, hometownState: null as string | null, pipelineStatesJson: "{}",
          transferPipelineJson: "{}", adRelationshipsJson: "{}", currentSalary: 300000,
          raiseRequestedThisSeason: false, teamPerception: 65, nationalPerception: 20, localPerception: 50,
          campusAtmosphere: 40, careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
        };
        state.coaches.push(replacement);
        team.headCoachId = replacement.id;
        headCoach.careerWins += record.wins;
        headCoach.careerLosses += record.losses;
        headCoach.legalityReputation = newLegality;
      } else {
        // AI coach: don't overwrite their identity yet — credit their final
        // season onto their own row and hold them as a carousel candidate.
        // The carousel pass below (after every team's outcome is known)
        // decides whether another program hires them or their identity gets
        // reset for a fresh replacement, mirroring the AD turnover carousel.
        headCoach.careerWins += record.wins;
        headCoach.careerLosses += record.losses;
        headCoach.legalityReputation = newLegality;
        headCoach.reputation = newReputation;
        departingCoaches.push({
          teamId: team.id, coachId: headCoach.id, reputation: newReputation, legalityReputation: newLegality, priorPrestige: team.prestige,
        });
      }
    } else {
      Object.assign(headCoach, {
        hotSeatLevel: newHotSeat, reputation: newReputation, legalityReputation: newLegality,
        raiseRequestedThisSeason: false,
        teamPerception: driftPerception(headCoach.teamPerception, 60, 0.05),
        nationalPerception: driftPerception(headCoach.nationalPerception, 20, 0.15),
        localPerception: driftPerception(headCoach.localPerception, 50, 0.1),
        campusAtmosphere: newAtmosphere,
        careerWins: headCoach.careerWins + record.wins, careerLosses: headCoach.careerLosses + record.losses,
        yearsAtCurrentJob: headCoach.yearsAtCurrentJob + 1,
      });
    }

    team.prestige = newPrestige;
    team.arenaUpgradeRequestedThisSeason = false;
  }

  // Rivalries: existing ones intensify with every meeting (and cool off a
  // notch if they didn't play at all this season); new ones can be forged
  // once two teams have clashed enough times in the postseason.
  const meetingsByPair = new Map<string, { total: number; postseason: number }>();
  for (const g of seasonGames) {
    const [a, b] = sortedPair(g.homeTeamId, g.awayTeamId);
    const key = `${a}|${b}`;
    const entry = meetingsByPair.get(key) ?? { total: 0, postseason: 0 };
    entry.total += 1;
    if (g.tournamentId) entry.postseason += 1;
    meetingsByPair.set(key, entry);
  }
  const rivalryByPair = new Map(state.rivalries.map((r) => [`${r.teamAId}|${r.teamBId}`, r]));
  const newRivalries: RivalryRow[] = [];

  for (const [key, meetings] of meetingsByPair) {
    const [teamAId, teamBId] = key.split("|");
    const existing = rivalryByPair.get(key);
    if (existing) {
      if (existing.active) {
        existing.intensity = growIntensityOnMeeting(existing.intensity);
        existing.postseasonMeetings += meetings.postseason;
      } else if (meetings.postseason > 0) {
        existing.postseasonMeetings += meetings.postseason;
        if (existing.postseasonMeetings >= POSTSEASON_RIVALRY_THRESHOLD) {
          existing.active = true;
          existing.intensity = postseasonForgedIntensity();
          existing.origin = "POSTSEASON";
          existing.establishedYear = seasonYear;
        }
      }
    } else if (meetings.postseason > 0) {
      const activate = meetings.postseason >= POSTSEASON_RIVALRY_THRESHOLD;
      newRivalries.push({
        id: newId(), teamAId, teamBId, postseasonMeetings: meetings.postseason, active: activate,
        intensity: activate ? postseasonForgedIntensity() : 0, origin: "POSTSEASON", establishedYear: seasonYear,
      });
    }
  }
  state.rivalries.push(...newRivalries);
  for (const r of state.rivalries) {
    if (!r.active) continue;
    if (!meetingsByPair.has(`${r.teamAId}|${r.teamBId}`)) {
      r.intensity = decayIntensity(r.intensity);
    }
  }

  // Athletic director turnover: ~7-year average tenure (memoryless yearly
  // hazard), and a departing AD sometimes moves to a different school instead
  // of retiring — same "carousel" idea as the coaching job market.
  const departingADs: { team: WorldState["teams"][number]; ad: WorldState["athleticDirectors"][number] }[] = [];
  for (const team of state.teams) {
    const ad = state.athleticDirectors.find((a) => a.id === team.athleticDirectorId);
    if (!ad) continue;
    if (adTurnoverRoll(rng)) {
      departingADs.push({ team, ad });
    } else {
      ad.yearsAtCurrentJob += 1;
    }
  }
  const movingAdPool = [...departingADs].sort(() => rng() - 0.5).map((d) => d.ad);
  for (const { team, ad } of departingADs) {
    const moveIn = movingAdPool.length > 0 && rng() < 0.4 ? movingAdPool.pop() : undefined;
    if (moveIn && moveIn.id !== ad.id) {
      team.athleticDirectorId = moveIn.id;
      moveIn.yearsAtCurrentJob = 0;
    } else {
      const fresh = {
        id: newId(), name: `${randomFirstName(rng)} ${randomLastName(rng)}`,
        ...generateADTraits(rng, team.academicReputation), yearsAtCurrentJob: 0,
      };
      state.athleticDirectors.push(fresh);
      team.athleticDirectorId = fresh.id;
    }
  }

  // AI coaching carousel: a fired coach sometimes lands at another program
  // instead of just vanishing into a freshly-generated unknown — same idea
  // as the AD turnover carousel above. Purely AI-vs-AI; the player's own
  // re-hiring runs through generateJobOffers below, which has its own
  // reputation/legality/AD-relationship-aware logic.
  if (departingCoaches.length > 0) {
    const candidatePool = [...departingCoaches].sort(() => rng() - 0.5);
    const claimedCoachIds = new Set<string>();
    const resolvedTeamIds = new Set<string>();

    for (const vacancy of departingCoaches) {
      const team = state.teams.find((t) => t.id === vacancy.teamId)!;
      const ad = state.athleticDirectors.find((a) => a.id === team.athleticDirectorId);
      const candidateIndex = candidatePool.findIndex((c) =>
        c.coachId !== vacancy.coachId && !claimedCoachIds.has(c.coachId) &&
        team.prestige <= clamp(c.reputation + 10, 0, 100) && team.prestige > c.priorPrestige - 15 &&
        meetsLegalityBar(c.legalityReputation, team.academicReputation, ad?.integrityStandard)
      );
      if (candidateIndex !== -1 && rng() < 0.35) {
        const hired = candidatePool[candidateIndex];
        claimedCoachIds.add(hired.coachId);
        resolvedTeamIds.add(vacancy.teamId);
        team.headCoachId = hired.coachId;
        const hiredCoach = state.coaches.find((c) => c.id === hired.coachId)!;
        hiredCoach.isPlayerControlled = false;
        hiredCoach.hotSeatLevel = 0;
        hiredCoach.yearsAtCurrentJob = 0;
      }
    }

    for (const vacancy of departingCoaches) {
      if (resolvedTeamIds.has(vacancy.teamId)) continue; // already filled via the carousel above
      const team = state.teams.find((t) => t.id === vacancy.teamId)!;
      const replacementArchetype = randomArchetype(rng);
      const replacementSkillRoll = generateCoachSkills(rng, team.prestige, replacementArchetype);
      const replacementData = {
        name: `${randomFirstName(rng)} ${randomLastName(rng)}`, isPlayerControlled: false, hotSeatLevel: 0,
        reputation: replacementSkillRoll.reputation, offenseSkill: replacementSkillRoll.offenseSkill,
        defenseSkill: replacementSkillRoll.defenseSkill, recruitingSkill: replacementSkillRoll.recruitingSkill,
        developmentSkill: replacementSkillRoll.developmentSkill, archetype: replacementArchetype,
        background: null as string | null, careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
      };
      if (claimedCoachIds.has(vacancy.coachId)) {
        // Our own just-fired coach got scooped up by another program in the
        // loop above — their row now belongs there, so this team needs a
        // brand-new coach rather than reusing (and corrupting) that identity.
        const fresh = {
          id: newId(), playedCollege: false, collegeTeamName: null as string | null, collegeState: null as string | null,
          proPath: "NONE", proCountry: null as string | null, legalityReputation: 75, hometownState: null as string | null,
          pipelineStatesJson: "{}", transferPipelineJson: "{}", adRelationshipsJson: "{}", currentSalary: 300000,
          raiseRequestedThisSeason: false, teamPerception: 65, nationalPerception: 20, localPerception: 50, campusAtmosphere: 40,
          ...replacementData,
        };
        state.coaches.push(fresh);
        team.headCoachId = fresh.id;
      } else {
        const original = state.coaches.find((c) => c.id === vacancy.coachId)!;
        Object.assign(original, replacementData);
      }
    }
  }

  if (userTeamId) {
    const openings = vacancies
      .filter((v) => v.teamId !== userTeamId)
      .map((v) => {
        const t = state.teams.find((tt) => tt.id === v.teamId);
        const ad = t ? state.athleticDirectors.find((a) => a.id === t.athleticDirectorId) : undefined;
        return { ...v, athleticDirectorId: ad?.id, integrityStandard: ad?.integrityStandard };
      });
    const maxOffers = userFired ? 3 : 2;
    const coachAdRelationships = parseAdRelationships(userNewAdRelationshipsJson);
    const offers = generateJobOffers(userNewReputation, userNewPrestige, openings, rng, maxOffers, userNewLegality, coachAdRelationships);
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

  const teamNameById = new Map(state.teams.map((t) => [t.id, t.name]));

  // Discipline drops: a modest, ongoing trickle of players cut loose for
  // accumulated off-court judgment issues (distinct from the ARREST event's
  // own one-off "dismiss" choice) join a leaguewide pool other programs can
  // sign — concentrated almost entirely on the real discipline-risk tail. Most
  // get scooped up by AI programs willing to take the risk before the human
  // coach ever sees the list; a program's own AD can veto too, so image-
  // conscious schools mostly pass. What's left stays browsable.
  const rosterSnapshot = state.players.filter((p) => p.teamId);
  for (const p of rosterSnapshot) {
    const ownerTeam = state.teams.find((t) => t.id === p.teamId);
    const ownerCoach = ownerTeam ? state.coaches.find((c) => c.id === ownerTeam.headCoachId) : undefined;
    if (rng() < disciplineDismissalChance(p.disciplineRating, ownerCoach?.archetype)) {
      p.previousSchool = teamNameById.get(p.teamId!) ?? null;
      p.droppedForDiscipline = true;
      p.teamId = null;
    }
  }
  const disciplinePool = state.players.filter((p) => p.droppedForDiscipline && !p.teamId);
  if (disciplinePool.length > 0) {
    const rosterCounts = new Map<string, number>();
    const scholarshipCounts = new Map<string, number>();
    for (const t of state.teams) {
      rosterCounts.set(t.id, state.players.filter((p) => p.teamId === t.id).length);
      scholarshipCounts.set(t.id, state.players.filter((p) => p.teamId === t.id && p.onScholarship).length);
    }
    for (const p of disciplinePool) {
      if (rng() < 0.35) continue; // stays in the pool, unclaimed this cycle
      const eligible = state.teams.filter((t) => {
        if (t.isPlayerControlled) return false; // the human coach signs these deliberately, never auto-assigned
        const rules = DIVISION_RULES[t.division as Division];
        if ((rosterCounts.get(t.id) ?? 0) >= rules.rosterCap) return false;
        const ad = state.athleticDirectors.find((a) => a.id === t.athleticDirectorId);
        return meetsLegalityBar(p.disciplineRating, t.academicReputation, ad?.integrityStandard);
      });
      if (eligible.length === 0) continue;
      const team = eligible[Math.floor(rng() * eligible.length)];
      const rules = DIVISION_RULES[team.division as Division];
      const hasScholarshipRoom = rules.hasScholarships && (scholarshipCounts.get(team.id) ?? 0) < rules.scholarshipLimit;
      p.teamId = team.id;
      p.onScholarship = hasScholarshipRoom;
      team.academicReputation = Math.round(clamp(team.academicReputation - disciplineSigningReputationHit(p.disciplineRating), 5, 99));
      rosterCounts.set(team.id, (rosterCounts.get(team.id) ?? 0) + 1);
      if (hasScholarshipRoom) scholarshipCounts.set(team.id, (scholarshipCounts.get(team.id) ?? 0) + 1);
    }
  }

  // Transfer portal: departures free a roster spot and become public; last
  // season's departures resolve now via the same weighted-interest lottery
  // HS recruits use, off a full season of accumulated interest. Landing a
  // transfer builds a real connection to that school — the next transfer
  // portal player from there is easier to land as a result.
  const priorPortalPlayers = state.players.filter((p) => p.inTransferPortal);

  const PORTAL_BASE_CHANCE = 0.05;
  const allCandidateTeams: PortalCandidateTeam[] = state.teams.map((t) => ({ teamId: t.id, division: t.division as Division, prestige: t.prestige }));
  for (const p of state.players) {
    if (!p.teamId) continue;
    const chance = clamp(PORTAL_BASE_CHANCE + (55 - p.characterRating) * 0.0015, 0.02, 0.16);
    if (rng() < chance) {
      const sourceTeamId = p.teamId;
      const sourceTeam = state.teams.find((t) => t.id === sourceTeamId);

      p.previousSchool = teamNameById.get(sourceTeamId) ?? null;
      p.inTransferPortal = true;
      p.teamId = null;
      p.prioritiesJson = JSON.stringify(generateProspectPriorities(rng));

      // Real portal movement skews upward — a genuine standout below the top
      // level draws interest from stronger programs, not just whatever the
      // user's own team happens to pursue.
      if (sourceTeam) {
        const pool = poachingDestinationPool(
          allCandidateTeams.filter((t) => t.teamId !== sourceTeamId),
          overall(p), sourceTeam.division as Division, sourceTeam.prestige,
        );
        for (const interest of generatePoachingInterest(rng, pool, overall(p))) {
          state.transferInterests.push({
            id: newId(), playerId: p.id, teamId: interest.teamId, interestLevel: interest.interestLevel,
            pointsInvested: 0, offered: true,
          });
        }
      }
    }
  }

  // NIL poaching: at the same point the portal actually opens (not a random
  // mid-season interrupt), a rival with real money might come after one of
  // the user's own good players.
  if (userTeamId && !userFired) {
    const pendingCount = state.events.filter((e) => e.status === "PENDING").length;
    if (pendingCount === 0) {
      const nilRosterPlayers = state.players.filter((p) => p.teamId === userTeamId);
      const userTeamRow = state.teams.find((t) => t.id === userTeamId)!;
      const rivalTeams = state.teams.filter((t) => t.division === userTeamRow.division && t.id !== userTeamId);
      const nilCtx: NILPoachingContext = {
        players: nilRosterPlayers,
        rivals: rivalTeams.map((r) => ({ teamId: r.id, teamName: r.name, prestige: r.prestige, nilBudget: r.nilBudget })),
      };
      const nilEvent = maybeGenerateNILPoachingEvent(rng, nilCtx);
      if (nilEvent) {
        const row: GameEventRow = {
          id: newId(), seasonYear: seasonYear + 1, date: new Date(Date.UTC(seasonYear + 1, 9, 1)),
          type: nilEvent.type, title: nilEvent.title, description: nilEvent.description,
          teamId: userTeamId, playerId: nilEvent.playerId, status: "PENDING",
          optionsJson: JSON.stringify(nilEvent.options), chosenOptionId: null,
        };
        state.events.push(row);
      }
    }
  }

  // Recruiting resolution: this year's class gets a small development nudge
  // from their senior season, then either signs with a team now or — for
  // D1-bound HS prospects only, ~25% of the time — commits a year early as a
  // junior instead, buying one more season before actually joining a roster.
  // Prospects who already committed early get one last chance to decommit
  // here, far more likely if their program just fired its coach. Every
  // team's scholarship count and roster size are tracked live so no program
  // out-signs its division's limits.
  const rosterCounts = new Map<string, number>();
  const scholarshipCounts = new Map<string, number>();
  for (const p of state.players) {
    if (!p.teamId) continue;
    rosterCounts.set(p.teamId, (rosterCounts.get(p.teamId) ?? 0) + 1);
    if (p.onScholarship) scholarshipCounts.set(p.teamId, (scholarshipCounts.get(p.teamId) ?? 0) + 1);
  }
  const hasRoom = (teamId: string) => {
    const teamDivision = divisionByTeam.get(teamId);
    const cap = teamDivision ? DIVISION_RULES[teamDivision].rosterCap : 15;
    return (rosterCounts.get(teamId) ?? 0) < cap;
  };

  // Resolve last season's portal entrants now that the season's worth of
  // interest they accumulated (and this cycle's freed-up roster spots) are
  // both known.
  const coachTransferPipelines = new Map<string, Record<string, number>>();
  for (const player of priorPortalPlayers) {
    const playerInterest = state.transferInterests.filter((i) => i.playerId === player.id);
    if (playerInterest.length === 0) continue;
    const roomyInterest = playerInterest.filter((i) => hasRoom(i.teamId));
    if (roomyInterest.length === 0) continue;
    const weights = commitmentWeights(roomyInterest.map((i) => ({ teamId: i.teamId, interest: i.interestLevel })));
    const total = weights.reduce((s, w) => s + w.weight, 0);
    if (total <= 0) continue;
    let r = rng() * total;
    let winnerTeamId = weights[0]?.teamId;
    for (const w of weights) {
      r -= w.weight;
      if (r <= 0) { winnerTeamId = w.teamId; break; }
    }
    if (!winnerTeamId) continue;

    const winnerDivision = divisionByTeam.get(winnerTeamId)!;
    const onScholarship = DIVISION_RULES[winnerDivision].hasScholarships && (scholarshipCounts.get(winnerTeamId) ?? 0) < DIVISION_RULES[winnerDivision].scholarshipLimit;
    rosterCounts.set(winnerTeamId, (rosterCounts.get(winnerTeamId) ?? 0) + 1);
    if (onScholarship) scholarshipCounts.set(winnerTeamId, (scholarshipCounts.get(winnerTeamId) ?? 0) + 1);

    player.teamId = winnerTeamId;
    player.inTransferPortal = false;
    player.onScholarship = onScholarship;

    const winningTeam = state.teams.find((t) => t.id === winnerTeamId);
    const winningCoach = winningTeam ? state.coaches.find((c) => c.id === winningTeam.headCoachId) : undefined;
    if (winningCoach && player.previousSchool) {
      const basePipeline = coachTransferPipelines.get(winningCoach.id) ?? parsePipelineStates(winningCoach.transferPipelineJson);
      coachTransferPipelines.set(winningCoach.id, bumpPipelineState(basePipeline, player.previousSchool));
    }
  }
  for (const [coachId, pipeline] of coachTransferPipelines) {
    const coach = state.coaches.find((c) => c.id === coachId);
    if (coach) coach.transferPipelineJson = JSON.stringify(pipeline);
  }
  // Anyone who didn't land anywhere this cycle leaves the league — mirrors
  // how an unsigned HS senior simply fades off the board once their window
  // passes — and their now-dead interest rows get cleared out either way.
  for (const player of priorPortalPlayers) {
    if (player.inTransferPortal) player.inTransferPortal = false;
  }
  state.transferInterests = state.transferInterests.filter((i) => !priorPortalPlayers.some((p) => p.id === i.playerId));

  const classToSign = state.prospects.filter((p) => p.graduationYear === seasonYear + 1);
  for (const prospect of classToSign) {
    if (prospect.source === "HIGH_SCHOOL") {
      prospect.scoring = driftProspectRating(rng, prospect.scoring, prospect.potential);
      prospect.threePoint = driftProspectRating(rng, prospect.threePoint, prospect.potential);
      prospect.finishing = driftProspectRating(rng, prospect.finishing, prospect.potential);
      prospect.playmaking = driftProspectRating(rng, prospect.playmaking, prospect.potential);
      prospect.rebounding = driftProspectRating(rng, prospect.rebounding, prospect.potential);
      prospect.defense = driftProspectRating(rng, prospect.defense, prospect.potential);
      prospect.athleticism = driftProspectRating(rng, prospect.athleticism, prospect.potential);
      prospect.basketballIq = driftProspectRating(rng, prospect.basketballIq, prospect.potential);
    }

    let winnerTeamId: string | undefined;
    let eligibleInterest = state.interests.filter((i) => i.prospectId === prospect.id);

    if (prospect.signed && prospect.committedTeamId) {
      const formerTeamId = prospect.committedTeamId;
      const decommitChance = firedTeamIds.has(formerTeamId) ? JUNIOR_DECOMMIT_COACH_FIRED_CHANCE : JUNIOR_DECOMMIT_BASE_CHANCE;
      const stillCommitted = rng() >= decommitChance;
      if (stillCommitted && hasRoom(formerTeamId)) {
        winnerTeamId = formerTeamId; // still committed and there's a spot — locks in for good
      } else {
        if (!stillCommitted) {
          state.interests = state.interests.filter((i) => !(i.prospectId === prospect.id && i.teamId === formerTeamId));
        }
        eligibleInterest = eligibleInterest.filter((i) => i.teamId !== formerTeamId);
      }
    }

    if (winnerTeamId === undefined) {
      const roomyInterest = eligibleInterest.filter((i) => hasRoom(i.teamId));
      if (roomyInterest.length === 0) {
        prospect.signed = false;
        prospect.committedTeamId = null;
        continue;
      }
      const weights = commitmentWeights(roomyInterest.map((i) => ({ teamId: i.teamId, interest: i.interestLevel })));
      const total = weights.reduce((s, w) => s + w.weight, 0);
      if (total <= 0) {
        prospect.signed = false;
        prospect.committedTeamId = null;
        continue;
      }
      let r = rng() * total;
      winnerTeamId = weights[0]?.teamId;
      for (const w of weights) {
        r -= w.weight;
        if (r <= 0) { winnerTeamId = w.teamId; break; }
      }
      if (!winnerTeamId) continue;

      if (divisionByTeam.get(winnerTeamId) === "D1" && prospect.source === "HIGH_SCHOOL" && rng() < JUNIOR_EARLY_COMMIT_CHANCE) {
        prospect.signed = true;
        prospect.committedTeamId = winnerTeamId;
        prospect.graduationYear = seasonYear + 2;
        continue;
      }
      prospect.signed = true;
      prospect.committedTeamId = winnerTeamId;
    }

    const finalTeamId = winnerTeamId as string;
    const finalDivision = divisionByTeam.get(finalTeamId)!;
    const onScholarship = DIVISION_RULES[finalDivision].hasScholarships && (scholarshipCounts.get(finalTeamId) ?? 0) < DIVISION_RULES[finalDivision].scholarshipLimit;
    rosterCounts.set(finalTeamId, (rosterCounts.get(finalTeamId) ?? 0) + 1);
    if (onScholarship) scholarshipCounts.set(finalTeamId, (scholarshipCounts.get(finalTeamId) ?? 0) + 1);

    state.players.push({
      id: newId(), teamId: finalTeamId, firstName: prospect.firstName, lastName: prospect.lastName,
      position: prospect.position, classYear: "FR", heightInches: 76, hometownState: prospect.hometownState, hometownCity: prospect.hometownCity,
      countryOfOrigin: prospect.countryOfOrigin, origin: prospect.source,
      scoring: prospect.scoring, threePoint: prospect.threePoint, finishing: prospect.finishing,
      playmaking: prospect.playmaking, rebounding: prospect.rebounding, defense: prospect.defense,
      athleticism: prospect.athleticism, basketballIq: prospect.basketballIq,
      stamina: Math.round(clamp(randNormal(rng, 65, 15), 20, 99)),
      potential: prospect.potential, characterRating: prospect.characterRating,
      disciplineRating: prospect.disciplineRating, chemistryImpact: 0,
      eligibilityYearsLeft: prospect.source === "JUCO" ? 2 : 4, inTransferPortal: false, previousSchool: null, prioritiesJson: "{}", isInjured: false, injuryWeeksLeft: 0, injuryType: null,
      isSuspended: false, suspensionDaysLeft: 0, onScholarship, droppedForDiscipline: false,
    });
  }

  // Next recruiting class — sized off the division's actual roster cap
  // (roughly a quarter of every roster graduating each year) with a healthy
  // surplus, rather than a flat per-team constant that quietly under-supplied
  // D2/D3's bigger 20-man rosters relative to D1's 15-man cap.
  let totalDemand = 0;
  for (const t of state.teams) totalDemand += DIVISION_RULES[t.division as Division].rosterCap / 4;
  const recruitingPoolTarget = Math.round(totalDemand * 1.6);
  const hsCount = Math.round(recruitingPoolTarget * (3 / 4.4));
  const jucoCount = Math.round(recruitingPoolTarget * (0.6 / 4.4));
  const intlCount = Math.round(recruitingPoolTarget * (0.8 / 4.4));
  for (let i = 0; i < hsCount; i++) {
    const p = generateHighSchoolProspect(rng, seasonYear + 2);
    state.prospects.push({
      id: newId(), firstName: p.firstName, lastName: p.lastName, position: p.position, hometownState: p.hometownState, hometownCity: p.hometownCity,
      countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating, scoring: p.ratings.scoring, threePoint: p.ratings.threePoint,
      finishing: p.ratings.finishing, playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding,
      defense: p.ratings.defense, athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq,
      potential: p.ratings.potential, characterRating: p.ratings.characterRating,
      disciplineRating: p.ratings.disciplineRating, scoutingNoise: p.scoutingNoise,
      graduationYear: p.graduationYear, signed: false, committedTeamId: null, prioritiesJson: JSON.stringify(p.priorities),
      playedEYBL: p.playedEYBL, eyblTeam: p.eyblTeam,
    });
  }
  for (let i = 0; i < jucoCount; i++) {
    const p = generateJucoProspect(rng, seasonYear + 2);
    state.prospects.push({
      id: newId(), firstName: p.firstName, lastName: p.lastName, position: p.position, hometownState: p.hometownState, hometownCity: p.hometownCity,
      countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating, scoring: p.ratings.scoring, threePoint: p.ratings.threePoint,
      finishing: p.ratings.finishing, playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding,
      defense: p.ratings.defense, athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq,
      potential: p.ratings.potential, characterRating: p.ratings.characterRating,
      disciplineRating: p.ratings.disciplineRating, scoutingNoise: p.scoutingNoise,
      graduationYear: p.graduationYear, signed: false, committedTeamId: null, prioritiesJson: JSON.stringify(p.priorities),
      playedEYBL: p.playedEYBL, eyblTeam: p.eyblTeam,
    });
  }
  for (let i = 0; i < intlCount; i++) {
    const p = generateInternationalProspect(rng, seasonYear + 2);
    state.prospects.push({
      id: newId(), firstName: p.firstName, lastName: p.lastName, position: p.position, hometownState: p.hometownState, hometownCity: p.hometownCity,
      countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating, scoring: p.ratings.scoring, threePoint: p.ratings.threePoint,
      finishing: p.ratings.finishing, playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding,
      defense: p.ratings.defense, athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq,
      potential: p.ratings.potential, characterRating: p.ratings.characterRating,
      disciplineRating: p.ratings.disciplineRating, scoutingNoise: p.scoutingNoise,
      graduationYear: p.graduationYear, signed: false, committedTeamId: null, prioritiesJson: JSON.stringify(p.priorities),
      playedEYBL: p.playedEYBL, eyblTeam: p.eyblTeam,
    });
  }

  // Backfill rosters below cap: AI teams auto-fill with walk-on-level
  // fillers as before. The user's own team instead gets a walk-on tryout
  // pool (local hopefuls plus a few who reached out directly) so the coach
  // can pick who actually earns the open spots.
  state.walkOnCandidates = [];
  for (const team of state.teams) {
    const teamDivision = team.division as Division;
    const rosterCount = state.players.filter((p) => p.teamId === team.id).length;
    const need = DIVISION_RULES[teamDivision].rosterCap - rosterCount;
    if (need <= 0) continue;

    const coach = state.coaches.find((c) => c.id === team.headCoachId);
    if (coach?.isPlayerControlled) {
      const candidateCount = Math.min(8, Math.max(3, need + 3));
      const localCount = Math.round(candidateCount * 0.7);
      const localCandidates = generateRosterForTeam(rng, clamp(team.prestige * 0.45, 15, 99), teamDivision, localCount, team.internationalScoutingRating);
      const reachedOutCandidates = generateRosterForTeam(rng, clamp(team.prestige * 0.6, 15, 99), teamDivision, candidateCount - localCount, team.internationalScoutingRating);
      const withSource = [
        ...localCandidates.map((p) => ({ ...p, source: "LOCAL" as const })),
        ...reachedOutCandidates.map((p) => ({ ...p, source: "REACHED_OUT" as const })),
      ];
      for (const p of withSource) {
        state.walkOnCandidates.push({
          id: newId(), teamId: team.id, firstName: p.firstName, lastName: p.lastName, position: p.position,
          hometownState: p.hometownState, hometownCity: p.hometownCity, countryOfOrigin: p.countryOfOrigin, origin: p.origin, source: p.source,
          scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
          playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
          athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq, potential: p.ratings.potential,
          characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
        });
      }
      continue;
    }

    const roster = generateRosterForTeam(rng, team.prestige, teamDivision, need, team.internationalScoutingRating);
    for (const p of roster) {
      state.players.push({
        id: newId(), teamId: team.id, firstName: p.firstName, lastName: p.lastName, position: p.position,
        classYear: "FR", heightInches: p.ratings.heightInches, hometownState: p.hometownState, hometownCity: p.hometownCity, countryOfOrigin: p.countryOfOrigin, origin: p.origin,
        scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
        playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
        athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq,
        stamina: Math.round(clamp(randNormal(rng, 65, 15), 20, 99)), potential: p.ratings.potential,
        characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
        chemistryImpact: 0, eligibilityYearsLeft: 4,
        inTransferPortal: false, previousSchool: null, prioritiesJson: "{}", isInjured: false, injuryWeeksLeft: 0, injuryType: null,
        isSuspended: false, suspensionDaysLeft: 0, onScholarship: false, droppedForDiscipline: false,
      });
    }
  }

  // Next season schedule
  const nextSeasonYear = seasonYear + 1;
  state.seasons.push({ id: newId(), year: nextSeasonYear });

  const nonConfWindowStart = new Date(Date.UTC(nextSeasonYear, 10, 4)); // Nov 4, matches schedule.ts
  const d1TeamsForPreseason = state.teams.filter((t) => t.division === "D1").map((t) => ({ id: t.id, prestige: t.prestige }));
  const preseasonResult = generatePreseasonTournaments(state, nextSeasonYear, d1TeamsForPreseason, nonConfWindowStart, rng);

  // D2/D3 in-season events — same non-conference-slot bookkeeping, but the
  // fields are procedurally generated per save (no fixed real-world list at
  // this scale) and cover six formats instead of D1's four.
  const preseasonByDivision: Partial<Record<Division, ReturnType<typeof generatePreseasonTournaments>>> = { D1: preseasonResult };
  for (const div of ["D2", "D3"] as const) {
    const candidateTeams = state.teams.filter((t) => t.division === div)
      .map((t) => ({ id: t.id, name: t.name, state: t.state, prestige: t.prestige, conferenceId: t.conferenceId }));
    if (candidateTeams.length === 0) continue;
    preseasonByDivision[div] = generateDivisionInSeasonEvents(state, nextSeasonYear, div, candidateTeams, nonConfWindowStart, rng);
  }

  let schedule: ReturnType<typeof generateSeasonSchedule> = [];
  for (const d of ["D1", "D2", "D3"] as Division[]) {
    const divTeams = state.teams.filter((t) => t.division === d).map((t) => ({ id: t.id, conferenceId: t.conferenceId }));
    if (divTeams.length === 0) continue;
    schedule = schedule.concat(generateSeasonSchedule(divTeams, d, nextSeasonYear, rng, preseasonByDivision[d]));
  }
  for (const g of schedule) {
    state.games.push({
      id: newId(), seasonYear: nextSeasonYear, date: g.date, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
      homeScore: null, awayScore: null, attendance: null, isPlayed: false, isConference: g.isConference,
      tournamentId: null, round: null, bracketSlot: null,
    });
  }

  state.save.currentSeasonYear = nextSeasonYear;
  state.save.currentDate = new Date(Date.UTC(nextSeasonYear, 9, 1));
  state.save.currentPhase = userFired ? "OFFSEASON" : "PRESEASON";

  return { userFired, jobOffers, conferenceInvite };
}
