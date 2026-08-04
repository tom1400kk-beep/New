import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { computeStandings } from "./standings";
import { updateHotSeat, updatePrestige, updateReputation, shouldFire, generateJobOffers, driftLegalityReputation, expectedWinPct, meetsLegalityBar } from "../engine/career";
import { disciplineDismissalChance, disciplineSigningReputationHit } from "../engine/disciplineDrops";
import { parsePipelineStates, decayPipeline, bumpPipelineState } from "../engine/pipeline";
import { generateProspectPriorities } from "../engine/priorities";
import { generateADTraits, adTurnoverRoll, parseAdRelationships, updateAdRelationship } from "../engine/athleticDirector";
import { maybeGenerateNILPoachingEvent, type NILPoachingContext } from "../engine/nilPoaching";
import { poachingDestinationPool, generatePoachingInterest, type PortalCandidateTeam } from "../engine/portalPoaching";
import { evaluateRealignmentInvite, type RealignmentInvite } from "../engine/conferenceRealignment";
import { overall } from "../engine/simulate";
import { driftPerception } from "../engine/media";
import { atmosphereTarget, driftAtmosphere } from "../engine/atmosphere";
import { sortedPair, growIntensityOnMeeting, decayIntensity, postseasonForgedIntensity, POSTSEASON_RIVALRY_THRESHOLD } from "../engine/rivalry";
import { generateRosterForTeam, generateHighSchoolProspect, generateJucoProspect, generateInternationalProspect } from "../engine/generation";
import { generateSeasonSchedule } from "../engine/schedule";
import { generatePreseasonTournaments, type PreseasonGenerationResult } from "./preseasonTournaments";
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
import type { ClassYear, Division } from "../types";
import { DIVISION_RULES } from "../types";

const CLASS_PROGRESSION: Record<ClassYear, ClassYear | null> = {
  FR: "SO", SO: "JR", JR: "SR", SR: null, GR: null,
};

async function tournamentWinsForTeam(saveGameId: string, seasonYear: number, teamId: string): Promise<{ made: boolean; wins: number }> {
  const games = await prisma.game.findMany({
    where: {
      saveGameId, seasonYear,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      tournament: { type: { in: ["NCAA_TOURNAMENT", "D2_NATIONAL", "D3_NATIONAL"] } },
      isPlayed: true,
    },
  });
  if (games.length === 0) return { made: false, wins: 0 };
  const wins = games.filter((g) => (g.homeTeamId === teamId ? (g.homeScore ?? 0) > (g.awayScore ?? 0) : (g.awayScore ?? 0) > (g.homeScore ?? 0))).length;
  return { made: true, wins };
}

export async function runOffseason(saveGameId: string): Promise<{
  userFired: boolean;
  jobOffers: { teamId: string; teamName: string; prestige: number }[];
  conferenceInvite: RealignmentInvite | null;
}> {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: saveGameId } });
  const seasonYear = save.currentSeasonYear;
  const teams = await prisma.team.findMany({ where: { saveGameId }, include: { headCoach: true, athleticDirector: true } });
  const allConferences = await prisma.conference.findMany({ where: { saveGameId }, select: { id: true, name: true, division: true } });
  const divisionByTeam = new Map(teams.map((t) => [t.id, t.division as Division]));
  const standings = await computeStandings(saveGameId, seasonYear);
  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));

  // Rivalries: active ones feed a hot-seat term for the player (fans and the
  // AD notice a rivalry record independent of the overall one), and all of
  // this season's games double as the source data for meeting counts below.
  const activeRivalries = await prisma.rivalry.findMany({ where: { saveGameId, active: true } });
  const rivalTeamIdsByTeam = new Map<string, Set<string>>();
  for (const r of activeRivalries) {
    if (!rivalTeamIdsByTeam.has(r.teamAId)) rivalTeamIdsByTeam.set(r.teamAId, new Set());
    if (!rivalTeamIdsByTeam.has(r.teamBId)) rivalTeamIdsByTeam.set(r.teamBId, new Set());
    rivalTeamIdsByTeam.get(r.teamAId)!.add(r.teamBId);
    rivalTeamIdsByTeam.get(r.teamBId)!.add(r.teamAId);
  }
  const seasonGames = await prisma.game.findMany({
    where: { saveGameId, seasonYear, isPlayed: true },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, tournamentId: true },
  });

  let userFired = false;
  let userTeamId: string | null = null;
  let userNewReputation = 50;
  let userNewPrestige = 50;
  let userNewLegality = 75;
  let userNewAdRelationshipsJson = "{}";
  let jobOffers: { teamId: string; teamName: string; prestige: number }[] = [];
  let conferenceInvite: RealignmentInvite | null = null;
  const vacancies: { teamId: string; prestige: number; academicReputation: number }[] = [];
  const firedTeamIds = new Set<string>();

  for (const team of teams) {
    if (!team.headCoach) continue;
    const record = standings.get(team.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
    const { made, wins } = await tournamentWinsForTeam(saveGameId, seasonYear, team.id);
    const games = record.wins + record.losses || 1;
    const winPct = record.wins / games;
    const ad = team.athleticDirector;
    const coachAdRelationships = parseAdRelationships(team.headCoach.adRelationshipsJson);
    const currentRelScore = ad ? coachAdRelationships[ad.id] ?? 50 : 50;

    // Only worth computing for the player — AI coaches' hot seat never
    // surfaces this level of detail to anyone.
    let rivalryWinPct: number | undefined;
    if (team.headCoach.isPlayerControlled) {
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

    const newHotSeat = updateHotSeat(team.headCoach.hotSeatLevel, record.wins, record.losses, team.prestige, {
      archetype: team.headCoach.archetype,
      legalityReputation: team.headCoach.legalityReputation,
      academicReputation: team.academicReputation,
      adPatience: ad?.patience,
      adWinFocus: ad?.winFocus,
      campusAtmosphere: team.headCoach.campusAtmosphere,
      rivalryWinPct,
    });
    const fired = shouldFire(newHotSeat, rng, ad?.loyalty, currentRelScore);
    const newReputation = updateReputation(team.headCoach.reputation, record.wins, record.losses, made, wins, fired);
    const newPrestige = updatePrestige(team.prestige, record.wins, record.losses, made, wins, team.headCoach.background);
    const newLegality = driftLegalityReputation(team.headCoach.legalityReputation);
    const newAtmosphere = driftAtmosphere(team.headCoach.campusAtmosphere, atmosphereTarget({
      division: team.division as Division, prestige: team.prestige, winPct, expectedWinPct: expectedWinPct(team.prestige),
      yearsAtCurrentJob: team.headCoach.yearsAtCurrentJob, madeTournament: made, tournamentWins: wins,
    }));
    // Pipeline decay and AD-relationship tracking are coach-scoped and only
    // matter for the player's own coach — skip the extra work for every AI
    // coach every season (their identities get discarded on firing anyway).
    const newPipelineJson = team.headCoach.isPlayerControlled
      ? JSON.stringify(decayPipeline(parsePipelineStates(team.headCoach.pipelineStatesJson)))
      : undefined;
    const newAdRelationshipsJson = team.headCoach.isPlayerControlled && ad
      ? JSON.stringify({ ...coachAdRelationships, [ad.id]: updateAdRelationship(currentRelScore, winPct, expectedWinPct(team.prestige), fired) })
      : undefined;

    if (team.headCoach.isPlayerControlled) {
      userTeamId = team.id;
      userNewReputation = newReputation;
      userNewPrestige = newPrestige;
      userNewLegality = newLegality;
      if (newAdRelationshipsJson) userNewAdRelationshipsJson = newAdRelationshipsJson;
      if (fired) {
        userFired = true;
      } else {
        conferenceInvite = evaluateRealignmentInvite(
          { id: team.id, name: team.name, conferenceId: team.conferenceId, division: team.division as Division, prestige: newPrestige },
          winPct,
          made,
          wins,
          teams.map((t) => ({ id: t.id, name: t.name, conferenceId: t.conferenceId, division: t.division as Division, prestige: t.prestige })),
          allConferences.map((c) => ({ id: c.id, name: c.name, division: c.division as Division })),
          rng
        );
      }
    }

    if (fired) {
      firedTeamIds.add(team.id);
      vacancies.push({ teamId: team.id, prestige: newPrestige, academicReputation: team.academicReputation });
      const replacementArchetype = randomArchetype(rng);
      const replacementSkillRoll = generateCoachSkills(rng, team.prestige, replacementArchetype);
      const replacementSkills = {
        reputation: replacementSkillRoll.reputation,
        offenseSkill: replacementSkillRoll.offenseSkill,
        defenseSkill: replacementSkillRoll.defenseSkill,
        recruitingSkill: replacementSkillRoll.recruitingSkill,
        developmentSkill: replacementSkillRoll.developmentSkill,
        archetype: replacementArchetype,
        background: null as string | null,
      };
      if (team.headCoach.isPlayerControlled) {
        // Bench the user's coach (identity + career stats persist) rather than
        // overwriting them — a fresh AI coach takes over the vacated program.
        const replacement = await prisma.coach.create({
          data: {
            id: randomUUID(), saveGameId, name: `${randomFirstName(rng)} ${randomLastName(rng)}`,
            isPlayerControlled: false, hotSeatLevel: 0, ...replacementSkills, careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
          },
        });
        await prisma.team.update({ where: { id: team.id }, data: { headCoachId: replacement.id } });
        await prisma.coach.update({
          where: { id: team.headCoach.id },
          data: {
            careerWins: team.headCoach.careerWins + record.wins, careerLosses: team.headCoach.careerLosses + record.losses,
            legalityReputation: newLegality, pipelineStatesJson: newPipelineJson, adRelationshipsJson: newAdRelationshipsJson,
          },
        });
      } else {
        await prisma.coach.update({
          where: { id: team.headCoach.id },
          data: {
            name: `${randomFirstName(rng)} ${randomLastName(rng)}`,
            isPlayerControlled: false,
            hotSeatLevel: 0,
            ...replacementSkills,
            careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
          },
        });
      }
    } else {
      await prisma.coach.update({
        where: { id: team.headCoach.id },
        data: {
          hotSeatLevel: newHotSeat,
          reputation: newReputation,
          legalityReputation: newLegality,
          pipelineStatesJson: newPipelineJson,
          adRelationshipsJson: newAdRelationshipsJson,
          raiseRequestedThisSeason: false,
          teamPerception: driftPerception(team.headCoach.teamPerception, 60, 0.05),
          nationalPerception: driftPerception(team.headCoach.nationalPerception, 20, 0.15),
          localPerception: driftPerception(team.headCoach.localPerception, 50, 0.1),
          campusAtmosphere: newAtmosphere,
          careerWins: team.headCoach.careerWins + record.wins,
          careerLosses: team.headCoach.careerLosses + record.losses,
          yearsAtCurrentJob: team.headCoach.yearsAtCurrentJob + 1,
        },
      });
    }

    await prisma.team.update({ where: { id: team.id }, data: { prestige: newPrestige, arenaUpgradeRequestedThisSeason: false } });
  }

  // ---- Rivalries: existing ones intensify with every meeting (and cool off
  // a notch if they didn't play at all this season); new ones can be forged
  // once two teams have clashed enough times in the postseason. ----
  const meetingsByPair = new Map<string, { total: number; postseason: number }>();
  for (const g of seasonGames) {
    const [a, b] = sortedPair(g.homeTeamId, g.awayTeamId);
    const key = `${a}|${b}`;
    const entry = meetingsByPair.get(key) ?? { total: 0, postseason: 0 };
    entry.total += 1;
    if (g.tournamentId) entry.postseason += 1;
    meetingsByPair.set(key, entry);
  }
  const allRivalries = await prisma.rivalry.findMany({ where: { saveGameId } });
  const rivalryByPair = new Map(allRivalries.map((r) => [`${r.teamAId}|${r.teamBId}`, r]));

  for (const [key, meetings] of meetingsByPair) {
    const [teamAId, teamBId] = key.split("|");
    const existing = rivalryByPair.get(key);
    if (existing) {
      if (existing.active) {
        await prisma.rivalry.update({
          where: { id: existing.id },
          data: { intensity: growIntensityOnMeeting(existing.intensity), postseasonMeetings: existing.postseasonMeetings + meetings.postseason },
        });
      } else if (meetings.postseason > 0) {
        const newCount = existing.postseasonMeetings + meetings.postseason;
        if (newCount >= POSTSEASON_RIVALRY_THRESHOLD) {
          await prisma.rivalry.update({
            where: { id: existing.id },
            data: { postseasonMeetings: newCount, active: true, intensity: postseasonForgedIntensity(), origin: "POSTSEASON", establishedYear: seasonYear },
          });
        } else {
          await prisma.rivalry.update({ where: { id: existing.id }, data: { postseasonMeetings: newCount } });
        }
      }
    } else if (meetings.postseason > 0) {
      const activate = meetings.postseason >= POSTSEASON_RIVALRY_THRESHOLD;
      await prisma.rivalry.create({
        data: {
          id: randomUUID(), saveGameId, teamAId, teamBId,
          postseasonMeetings: meetings.postseason, active: activate,
          intensity: activate ? postseasonForgedIntensity() : 0,
          origin: "POSTSEASON", establishedYear: seasonYear,
        },
      });
    }
  }
  for (const r of allRivalries) {
    if (!r.active) continue;
    if (!meetingsByPair.has(`${r.teamAId}|${r.teamBId}`)) {
      await prisma.rivalry.update({ where: { id: r.id }, data: { intensity: decayIntensity(r.intensity) } });
    }
  }

  // ---- Athletic director turnover: ~7-year average tenure (memoryless yearly
  // hazard), and a departing AD sometimes moves to a different school instead
  // of retiring — same "carousel" idea as the coaching job market. ----
  const departingADs: { teamId: string; academicReputation: number; ad: NonNullable<(typeof teams)[number]["athleticDirector"]> }[] = [];
  for (const team of teams) {
    if (!team.athleticDirector) continue;
    if (adTurnoverRoll(rng)) {
      departingADs.push({ teamId: team.id, academicReputation: team.academicReputation, ad: team.athleticDirector });
    } else {
      await prisma.athleticDirector.update({ where: { id: team.athleticDirector.id }, data: { yearsAtCurrentJob: team.athleticDirector.yearsAtCurrentJob + 1 } });
    }
  }
  // athleticDirectorId is unique on Team, so a departing team's slot must be
  // cleared before anyone else can be assigned into it — otherwise a school
  // "swapping in" an AD who hasn't yet been released by their old team trips
  // the unique constraint.
  for (const { teamId } of departingADs) {
    await prisma.team.update({ where: { id: teamId }, data: { athleticDirectorId: null } });
  }
  const movingAdPool = [...departingADs].sort(() => rng() - 0.5).map((d) => d.ad);
  for (const { teamId, academicReputation, ad } of departingADs) {
    const moveIn = movingAdPool.length > 0 && rng() < 0.4 ? movingAdPool.pop() : undefined;
    if (moveIn && moveIn.id !== ad.id) {
      await prisma.team.update({ where: { id: teamId }, data: { athleticDirectorId: moveIn.id } });
      await prisma.athleticDirector.update({ where: { id: moveIn.id }, data: { yearsAtCurrentJob: 0 } });
    } else {
      const freshTraits = generateADTraits(rng, academicReputation);
      const fresh = await prisma.athleticDirector.create({
        data: { id: randomUUID(), saveGameId, name: `${randomFirstName(rng)} ${randomLastName(rng)}`, ...freshTraits, yearsAtCurrentJob: 0 },
      });
      await prisma.team.update({ where: { id: teamId }, data: { athleticDirectorId: fresh.id } });
    }
  }

  // Job market resolves after every program's outcome (and every AD's) is
  // known, so offers reflect the full set of openings league-wide rather than
  // just whichever teams were processed first.
  if (userTeamId) {
    const openings = vacancies.filter((v) => v.teamId !== userTeamId);
    const openingTeams = await prisma.team.findMany({ where: { id: { in: openings.map((o) => o.teamId) } }, include: { athleticDirector: true } });
    const openingsWithAd = openings.map((o) => {
      const t = openingTeams.find((tt) => tt.id === o.teamId);
      return { ...o, athleticDirectorId: t?.athleticDirector?.id, integrityStandard: t?.athleticDirector?.integrityStandard };
    });
    const maxOffers = userFired ? 3 : 2;
    const coachAdRelationships = parseAdRelationships(userNewAdRelationshipsJson);
    const offers = generateJobOffers(userNewReputation, userNewPrestige, openingsWithAd, rng, maxOffers, userNewLegality, coachAdRelationships);
    if (offers.length > 0) {
      const offerTeams = await prisma.team.findMany({ where: { id: { in: offers.map((o) => o.teamId) } } });
      jobOffers = offerTeams.map((t) => ({ teamId: t.id, teamName: t.name, prestige: t.prestige }));
    }
    if (userFired) {
      await prisma.saveGame.update({ where: { id: saveGameId }, data: { coachTeamId: null } });
    }
  }

  // ---- Roster progression: graduate seniors, develop everyone else ----
  const players = await prisma.player.findMany({ where: { saveGameId, teamId: { not: null } } });
  for (const p of players) {
    const nextClass = CLASS_PROGRESSION[p.classYear as ClassYear];
    if (nextClass === null || p.eligibilityYearsLeft <= 1) {
      await prisma.player.update({ where: { id: p.id }, data: { teamId: null } }); // graduates out of the league
      continue;
    }
    const growth = Math.round(((p.potential - (p.scoring + p.defense + p.rebounding) / 3) / 100) * randInt(rng, 6, 14));
    await prisma.player.update({
      where: { id: p.id },
      data: {
        classYear: nextClass,
        eligibilityYearsLeft: p.eligibilityYearsLeft - 1,
        scoring: Math.round(clamp(p.scoring + growth, 15, 99)),
        threePoint: Math.round(clamp(p.threePoint + growth, 15, 99)),
        finishing: Math.round(clamp(p.finishing + growth, 15, 99)),
        playmaking: Math.round(clamp(p.playmaking + growth, 15, 99)),
        rebounding: Math.round(clamp(p.rebounding + growth, 15, 99)),
        defense: Math.round(clamp(p.defense + growth, 15, 99)),
      },
    });
  }

  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const currentRosterAll = await prisma.player.findMany({ where: { saveGameId, teamId: { not: null } } });

  // ---- Discipline drops: a modest, ongoing trickle of players cut loose for
  // accumulated off-court judgment issues (distinct from the ARREST event's
  // own one-off "dismiss" choice) join a leaguewide pool other programs can
  // sign — concentrated almost entirely on the real discipline-risk tail. Most
  // get scooped up by AI programs willing to take the risk before the human
  // coach ever sees the list; a program's own AD can veto too, so image-
  // conscious schools mostly pass. What's left stays browsable. ----
  const disciplineDismissedIds = new Set<string>();
  for (const p of currentRosterAll) {
    const ownerTeam = teams.find((t) => t.id === p.teamId);
    if (rng() < disciplineDismissalChance(p.disciplineRating, ownerTeam?.headCoach?.archetype)) {
      disciplineDismissedIds.add(p.id);
      await prisma.player.update({
        where: { id: p.id },
        data: { teamId: null, droppedForDiscipline: true, previousSchool: teamNameById.get(p.teamId!) ?? null },
      });
    }
  }
  if (disciplineDismissedIds.size > 0) {
    const rosterCounts = new Map<string, number>();
    const scholarshipCounts = new Map<string, number>();
    for (const t of teams) {
      rosterCounts.set(t.id, currentRosterAll.filter((p) => p.teamId === t.id && !disciplineDismissedIds.has(p.id)).length);
      scholarshipCounts.set(t.id, currentRosterAll.filter((p) => p.teamId === t.id && p.onScholarship && !disciplineDismissedIds.has(p.id)).length);
    }
    const pool = await prisma.player.findMany({ where: { saveGameId, droppedForDiscipline: true, teamId: null } });
    for (const p of pool) {
      if (rng() < 0.35) continue; // stays in the pool, unclaimed this cycle
      const eligible = teams.filter((t) => {
        if (t.isPlayerControlled) return false; // the human coach signs these deliberately, never auto-assigned
        const rules = DIVISION_RULES[t.division as Division];
        if ((rosterCounts.get(t.id) ?? 0) >= rules.rosterCap) return false;
        return meetsLegalityBar(p.disciplineRating, t.academicReputation, t.athleticDirector?.integrityStandard);
      });
      if (eligible.length === 0) continue;
      const team = eligible[Math.floor(rng() * eligible.length)];
      const rules = DIVISION_RULES[team.division as Division];
      const hasScholarshipRoom = rules.hasScholarships && (scholarshipCounts.get(team.id) ?? 0) < rules.scholarshipLimit;
      await prisma.player.update({ where: { id: p.id }, data: { teamId: team.id, onScholarship: hasScholarshipRoom } });
      await prisma.team.update({
        where: { id: team.id },
        data: { academicReputation: Math.round(clamp(team.academicReputation - disciplineSigningReputationHit(p.disciplineRating), 5, 99)) },
      });
      rosterCounts.set(team.id, (rosterCounts.get(team.id) ?? 0) + 1);
      if (hasScholarshipRoom) scholarshipCounts.set(team.id, (scholarshipCounts.get(team.id) ?? 0) + 1);
    }
  }

  // ---- Transfer portal: departures free a roster spot and become public;
  // last season's departures resolve now via the same weighted-interest
  // lottery HS recruits use, off a full season of accumulated interest.
  // Landing a transfer builds a real connection to that school — the next
  // transfer portal player from there is easier to land as a result. ----
  const priorPortalPlayers = await prisma.player.findMany({
    where: { saveGameId, inTransferPortal: true },
    include: { transferInterest: true },
  });

  const PORTAL_BASE_CHANCE = 0.05;
  const currentRoster = currentRosterAll.filter((p) => !disciplineDismissedIds.has(p.id));
  const allCandidateTeams: PortalCandidateTeam[] = teams.map((t) => ({ teamId: t.id, division: t.division as Division, prestige: t.prestige }));
  const poachingInterestRows: { id: string; playerId: string; teamId: string; interestLevel: number }[] = [];
  for (const p of currentRoster) {
    const chance = clamp(PORTAL_BASE_CHANCE + (55 - p.characterRating) * 0.0015, 0.02, 0.16);
    if (rng() < chance) {
      await prisma.player.update({
        where: { id: p.id },
        data: {
          inTransferPortal: true,
          teamId: null,
          previousSchool: teamNameById.get(p.teamId!) ?? null,
          prioritiesJson: JSON.stringify(generateProspectPriorities(rng)),
        },
      });

      // Real portal movement skews upward — a genuine standout below the top
      // level draws interest from stronger programs, not just whatever the
      // user's own team happens to pursue.
      const sourceTeam = teams.find((t) => t.id === p.teamId);
      if (sourceTeam) {
        const pool = poachingDestinationPool(
          allCandidateTeams.filter((t) => t.teamId !== p.teamId),
          overall(p), sourceTeam.division as Division, sourceTeam.prestige,
        );
        for (const interest of generatePoachingInterest(rng, pool, overall(p))) {
          poachingInterestRows.push({ id: randomUUID(), playerId: p.id, teamId: interest.teamId, interestLevel: interest.interestLevel });
        }
      }
    }
  }
  if (poachingInterestRows.length > 0) {
    await prisma.transferInterest.createMany({
      data: poachingInterestRows.map((r) => ({ id: r.id, playerId: r.playerId, teamId: r.teamId, interestLevel: r.interestLevel, pointsInvested: 0, offered: true })),
    });
  }

  // ---- NIL poaching: at the same point the portal actually opens (not a
  // random mid-season interrupt), a rival with real money might come after
  // one of the user's own good players. ----
  if (userTeamId && !userFired) {
    const pendingCount = await prisma.gameEvent.count({ where: { saveGameId, status: "PENDING" } });
    if (pendingCount === 0) {
      const nilRosterPlayers = await prisma.player.findMany({
        where: { saveGameId, teamId: userTeamId },
        select: {
          id: true, firstName: true, lastName: true, position: true, scoring: true, threePoint: true, finishing: true,
          playmaking: true, rebounding: true, defense: true, athleticism: true, basketballIq: true, characterRating: true,
          isInjured: true, isSuspended: true, onScholarship: true,
        },
      });
      const userTeamRow = teams.find((t) => t.id === userTeamId)!;
      const rivalTeams = teams.filter((t) => t.division === userTeamRow.division && t.id !== userTeamId);
      const nilCtx: NILPoachingContext = {
        players: nilRosterPlayers,
        rivals: rivalTeams.map((r) => ({ teamId: r.id, teamName: r.name, prestige: r.prestige, nilBudget: r.nilBudget })),
      };
      const nilEvent = maybeGenerateNILPoachingEvent(rng, nilCtx);
      if (nilEvent) {
        await prisma.gameEvent.create({
          data: {
            id: randomUUID(), saveGameId, seasonYear: seasonYear + 1, date: new Date(Date.UTC(seasonYear + 1, 9, 1)),
            type: nilEvent.type, title: nilEvent.title, description: nilEvent.description,
            teamId: userTeamId, playerId: nilEvent.playerId, status: "PENDING", optionsJson: JSON.stringify(nilEvent.options),
          },
        });
      }
    }
  }

  // ---- Recruiting resolution: this year's class gets a small development
  // nudge from their senior season, then either signs with a team now or —
  // for D1-bound HS prospects only, ~25% of the time — commits a year early
  // as a junior instead, buying one more season before actually joining a
  // roster. Prospects who already committed early get one last chance to
  // decommit here, far more likely if their program just fired its coach.
  // Every team's scholarship count and total roster size are tracked live so
  // no program can out-sign its division's limits (scholarshipLimit,
  // rosterCap) — once a team's board is full, its recruits either take a
  // walk-on spot instead or, if the whole roster is full, go unsigned. ----
  const rosterState = await prisma.player.findMany({ where: { saveGameId, teamId: { not: null } }, select: { teamId: true, onScholarship: true } });
  const rosterCounts = new Map<string, number>();
  const scholarshipCounts = new Map<string, number>();
  for (const p of rosterState) {
    rosterCounts.set(p.teamId!, (rosterCounts.get(p.teamId!) ?? 0) + 1);
    if (p.onScholarship) scholarshipCounts.set(p.teamId!, (scholarshipCounts.get(p.teamId!) ?? 0) + 1);
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
  const resolvedPortalPlayerIds = new Set<string>();
  for (const player of priorPortalPlayers) {
    if (player.transferInterest.length === 0) continue;
    const roomyInterest = player.transferInterest.filter((i) => hasRoom(i.teamId));
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

    resolvedPortalPlayerIds.add(player.id);
    await prisma.player.update({
      where: { id: player.id },
      data: { teamId: winnerTeamId, inTransferPortal: false, onScholarship },
    });

    const winningTeam = teams.find((t) => t.id === winnerTeamId);
    if (winningTeam?.headCoach && player.previousSchool) {
      const coachId = winningTeam.headCoach.id;
      const basePipeline = coachTransferPipelines.get(coachId) ?? parsePipelineStates(winningTeam.headCoach.transferPipelineJson);
      coachTransferPipelines.set(coachId, bumpPipelineState(basePipeline, player.previousSchool));
    }
  }
  for (const [coachId, pipeline] of coachTransferPipelines) {
    await prisma.coach.update({ where: { id: coachId }, data: { transferPipelineJson: JSON.stringify(pipeline) } });
  }
  // Anyone who didn't land anywhere this cycle leaves the league — mirrors
  // how an unsigned HS senior simply fades off the board once their window
  // passes — and their now-dead interest rows get cleared out either way.
  const unresolvedPortalIds = priorPortalPlayers.filter((p) => !resolvedPortalPlayerIds.has(p.id)).map((p) => p.id);
  if (unresolvedPortalIds.length > 0) {
    await prisma.player.updateMany({ where: { id: { in: unresolvedPortalIds } }, data: { inTransferPortal: false } });
  }
  if (priorPortalPlayers.length > 0) {
    await prisma.transferInterest.deleteMany({ where: { playerId: { in: priorPortalPlayers.map((p) => p.id) } } });
  }

  const classToSign = await prisma.prospect.findMany({
    where: { saveGameId, graduationYear: seasonYear + 1 },
    include: { interest: true },
  });
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
    const driftedRatings = {
      scoring: prospect.scoring, threePoint: prospect.threePoint, finishing: prospect.finishing,
      playmaking: prospect.playmaking, rebounding: prospect.rebounding, defense: prospect.defense,
      athleticism: prospect.athleticism, basketballIq: prospect.basketballIq,
    };

    let winnerTeamId: string | undefined;
    let eligibleInterest = prospect.interest;

    if (prospect.signed && prospect.committedTeamId) {
      const formerTeamId = prospect.committedTeamId;
      const decommitChance = firedTeamIds.has(formerTeamId) ? JUNIOR_DECOMMIT_COACH_FIRED_CHANCE : JUNIOR_DECOMMIT_BASE_CHANCE;
      const stillCommitted = rng() >= decommitChance;
      if (stillCommitted && hasRoom(formerTeamId)) {
        winnerTeamId = formerTeamId; // still committed and there's a spot — locks in for good
      } else {
        if (!stillCommitted) {
          await prisma.recruitInterest.deleteMany({ where: { prospectId: prospect.id, teamId: formerTeamId } });
        }
        eligibleInterest = prospect.interest.filter((i) => i.teamId !== formerTeamId);
      }
    }

    if (winnerTeamId === undefined) {
      const roomyInterest = eligibleInterest.filter((i) => hasRoom(i.teamId));
      if (roomyInterest.length === 0) {
        await prisma.prospect.update({ where: { id: prospect.id }, data: { signed: false, committedTeamId: null, ...driftedRatings } });
        continue;
      }
      const weights = commitmentWeights(roomyInterest.map((i) => ({ teamId: i.teamId, interest: i.interestLevel })));
      const total = weights.reduce((s, w) => s + w.weight, 0);
      if (total <= 0) {
        await prisma.prospect.update({ where: { id: prospect.id }, data: { signed: false, committedTeamId: null, ...driftedRatings } });
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
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: { signed: true, committedTeamId: winnerTeamId, graduationYear: seasonYear + 2, ...driftedRatings },
        });
        continue;
      }
      await prisma.prospect.update({ where: { id: prospect.id }, data: { signed: true, committedTeamId: winnerTeamId, ...driftedRatings } });
    } else {
      await prisma.prospect.update({ where: { id: prospect.id }, data: driftedRatings });
    }

    const finalTeamId = winnerTeamId as string;
    const finalDivision = divisionByTeam.get(finalTeamId)!;
    const onScholarship = DIVISION_RULES[finalDivision].hasScholarships && (scholarshipCounts.get(finalTeamId) ?? 0) < DIVISION_RULES[finalDivision].scholarshipLimit;
    rosterCounts.set(finalTeamId, (rosterCounts.get(finalTeamId) ?? 0) + 1);
    if (onScholarship) scholarshipCounts.set(finalTeamId, (scholarshipCounts.get(finalTeamId) ?? 0) + 1);

    await prisma.player.create({
      data: {
        id: randomUUID(), saveGameId, teamId: finalTeamId,
        firstName: prospect.firstName, lastName: prospect.lastName, position: prospect.position,
        classYear: "FR", heightInches: 76, hometownState: prospect.hometownState, hometownCity: prospect.hometownCity,
        countryOfOrigin: prospect.countryOfOrigin,
        origin: prospect.source,
        scoring: prospect.scoring, threePoint: prospect.threePoint, finishing: prospect.finishing,
        playmaking: prospect.playmaking, rebounding: prospect.rebounding, defense: prospect.defense,
        athleticism: prospect.athleticism, basketballIq: prospect.basketballIq,
        stamina: Math.round(clamp(randNormal(rng, 65, 15), 20, 99)),
        potential: prospect.potential, characterRating: prospect.characterRating,
        disciplineRating: prospect.disciplineRating,
        eligibilityYearsLeft: prospect.source === "JUCO" ? 2 : 4,
        onScholarship,
      },
    });
  }

  // ---- Generate next recruiting class ----
  // Sized off the division's actual roster cap (roughly a quarter of every
  // roster graduating each year) rather than a flat per-team constant, with
  // a healthy surplus on top — a flat multiplier tuned for D1's 15-man cap
  // quietly under-supplied D2/D3's 20-man rosters. Split HS/JUCO/int'l in
  // the same proportions as before.
  let totalDemand = 0;
  for (const t of teams) totalDemand += DIVISION_RULES[t.division as Division].rosterCap / 4;
  const recruitingPoolTarget = Math.round(totalDemand * 1.6);
  const hsCount = Math.round(recruitingPoolTarget * (3 / 4.4));
  const jucoCount = Math.round(recruitingPoolTarget * (0.6 / 4.4));
  const intlCount = Math.round(recruitingPoolTarget * (0.8 / 4.4));

  const nextProspects: any[] = [];
  for (let i = 0; i < hsCount; i++) {
    const p = generateHighSchoolProspect(rng, seasonYear + 2);
    nextProspects.push({
      id: randomUUID(), saveGameId, firstName: p.firstName, lastName: p.lastName, position: p.position,
      hometownState: p.hometownState, hometownCity: p.hometownCity, countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating,
      scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
      playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
      athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq, potential: p.ratings.potential,
      characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
      scoutingNoise: p.scoutingNoise, graduationYear: p.graduationYear,
      prioritiesJson: JSON.stringify(p.priorities),
    });
  }
  for (let i = 0; i < jucoCount; i++) {
    const p = generateJucoProspect(rng, seasonYear + 2);
    nextProspects.push({
      id: randomUUID(), saveGameId, firstName: p.firstName, lastName: p.lastName, position: p.position,
      hometownState: p.hometownState, hometownCity: p.hometownCity, countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating,
      scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
      playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
      athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq, potential: p.ratings.potential,
      characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
      scoutingNoise: p.scoutingNoise, graduationYear: p.graduationYear,
      prioritiesJson: JSON.stringify(p.priorities),
    });
  }
  for (let i = 0; i < intlCount; i++) {
    const p = generateInternationalProspect(rng, seasonYear + 2);
    nextProspects.push({
      id: randomUUID(), saveGameId, firstName: p.firstName, lastName: p.lastName, position: p.position,
      hometownState: p.hometownState, hometownCity: p.hometownCity, countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating,
      scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
      playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
      athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq, potential: p.ratings.potential,
      characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
      scoutingNoise: p.scoutingNoise, graduationYear: p.graduationYear,
      prioritiesJson: JSON.stringify(p.priorities),
    });
  }
  for (let i = 0; i < nextProspects.length; i += 400) {
    await prisma.prospect.createMany({ data: nextProspects.slice(i, i + 400) });
  }

  // ---- Backfill rosters below cap: AI teams auto-fill with walk-on-level
  // fillers as before. The user's own team instead gets a walk-on tryout
  // pool (local hopefuls plus a few who reached out directly) so the coach
  // can pick who actually earns the open spots. ----
  const currentTeams = await prisma.team.findMany({ where: { saveGameId }, include: { players: true, headCoach: true } });
  await prisma.walkOnCandidate.deleteMany({ where: { saveGameId } });
  for (const team of currentTeams) {
    const teamDivision = team.division as Division;
    const need = DIVISION_RULES[teamDivision].rosterCap - team.players.length;
    if (need <= 0) continue;

    if (team.headCoach?.isPlayerControlled) {
      const candidateCount = Math.min(8, Math.max(3, need + 3));
      const localCount = Math.round(candidateCount * 0.7);
      const localCandidates = generateRosterForTeam(rng, clamp(team.prestige * 0.45, 15, 99), teamDivision, localCount, team.internationalScoutingRating);
      const reachedOutCandidates = generateRosterForTeam(rng, clamp(team.prestige * 0.6, 15, 99), teamDivision, candidateCount - localCount, team.internationalScoutingRating);
      const candidateRows = [
        ...localCandidates.map((p) => ({ ...p, source: "LOCAL" as const })),
        ...reachedOutCandidates.map((p) => ({ ...p, source: "REACHED_OUT" as const })),
      ].map((p) => ({
        id: randomUUID(), saveGameId, teamId: team.id, firstName: p.firstName, lastName: p.lastName,
        position: p.position, hometownState: p.hometownState, hometownCity: p.hometownCity, countryOfOrigin: p.countryOfOrigin, origin: p.origin, source: p.source,
        scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
        playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
        athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq, potential: p.ratings.potential,
        characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
      }));
      if (candidateRows.length > 0) await prisma.walkOnCandidate.createMany({ data: candidateRows });
      continue;
    }

    const roster = generateRosterForTeam(rng, team.prestige, teamDivision, need, team.internationalScoutingRating);
    const rows = roster.map((p) => ({
      id: randomUUID(), saveGameId, teamId: team.id, firstName: p.firstName, lastName: p.lastName,
      position: p.position, classYear: "FR" as ClassYear, heightInches: p.ratings.heightInches,
      hometownState: p.hometownState, hometownCity: p.hometownCity, countryOfOrigin: p.countryOfOrigin, origin: p.origin, scoring: p.ratings.scoring, threePoint: p.ratings.threePoint,
      finishing: p.ratings.finishing, playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding,
      defense: p.ratings.defense, athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq,
      stamina: Math.round(clamp(randNormal(rng, 65, 15), 20, 99)), potential: p.ratings.potential,
      characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
      eligibilityYearsLeft: 4, onScholarship: false,
    }));
    if (rows.length > 0) await prisma.player.createMany({ data: rows });
  }

  // ---- Next season schedule ----
  const nextSeasonYear = seasonYear + 1;
  await prisma.season.create({ data: { id: randomUUID(), saveGameId, year: nextSeasonYear } });

  const nonConfWindowStart = new Date(Date.UTC(nextSeasonYear, 10, 4)); // Nov 4, matches schedule.ts
  const d1TeamsForPreseason = currentTeams.filter((t) => t.division === "D1").map((t) => ({ id: t.id, prestige: t.prestige }));
  const preseasonResult = await generatePreseasonTournaments(saveGameId, nextSeasonYear, d1TeamsForPreseason, nonConfWindowStart, rng);

  const preseasonByDivision: Partial<Record<Division, PreseasonGenerationResult>> = { D1: preseasonResult };
  for (const div of ["D2", "D3"] as const) {
    const candidateTeams = currentTeams.filter((t) => t.division === div)
      .map((t) => ({ id: t.id, name: t.name, state: t.state, prestige: t.prestige, conferenceId: t.conferenceId }));
    if (candidateTeams.length === 0) continue;
    preseasonByDivision[div] = await generateDivisionInSeasonEvents(saveGameId, nextSeasonYear, div, candidateTeams, nonConfWindowStart, rng);
  }

  let schedule: ReturnType<typeof generateSeasonSchedule> = [];
  for (const div of ["D1", "D2", "D3"] as Division[]) {
    const divTeams = teams.filter((t) => t.division === div).map((t) => ({ id: t.id, conferenceId: t.conferenceId }));
    if (divTeams.length === 0) continue;
    schedule = schedule.concat(generateSeasonSchedule(divTeams, div, nextSeasonYear, rng, preseasonByDivision[div]));
  }
  const gameRows = schedule.map((g) => ({
    id: randomUUID(), saveGameId, seasonYear: nextSeasonYear, date: g.date,
    homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, isConference: g.isConference, isPlayed: false,
  }));
  for (let i = 0; i < gameRows.length; i += 400) {
    await prisma.game.createMany({ data: gameRows.slice(i, i + 400) });
  }

  await prisma.saveGame.update({
    where: { id: saveGameId },
    data: {
      currentSeasonYear: nextSeasonYear,
      currentDate: new Date(Date.UTC(nextSeasonYear, 9, 1)),
      currentPhase: userFired ? "OFFSEASON" : "PRESEASON",
    },
  });

  return { userFired, jobOffers, conferenceInvite };
}
