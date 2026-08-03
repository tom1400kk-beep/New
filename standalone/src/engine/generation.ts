import { randomFirstName, randomLastName } from "./names";
import { randomInternationalFirstName, randomInternationalLastName } from "./internationalNames";
import { clamp, randInt, randNormal, weightedPick } from "./rng";
import { weightedStateList, STATE_PROFILES } from "./regions";
import { weightedCountryList, COUNTRY_PROFILES } from "./countries";
import type { ClassYear, Division, PlayerOrigin, PositionType, ProspectSource } from "../types";

// A player's name follows their country of origin when set (foreign-born HS
// recruits and JUCO players keep their heritage name too), not just true
// international signees — otherwise a kid born in Serbia reads as generically
// American, which undercuts the whole point of tracking countryOfOrigin.
function pickName(rng: () => number, countryOfOrigin: string | null): { firstName: string; lastName: string } {
  if (countryOfOrigin) {
    return { firstName: randomInternationalFirstName(rng, countryOfOrigin), lastName: randomInternationalLastName(rng, countryOfOrigin) };
  }
  return { firstName: randomFirstName(rng), lastName: randomLastName(rng) };
}

const POSITIONS: PositionType[] = ["PG", "SG", "SF", "PF", "C"];

// Position emphasis: skill -> flat modifier applied on top of base talent roll.
const POSITION_MODIFIERS: Record<PositionType, Partial<Record<SkillKey, number>>> = {
  PG: { playmaking: 10, threePoint: 3, rebounding: -8 },
  SG: { scoring: 8, threePoint: 6, rebounding: -10 },
  SF: { athleticism: 3 },
  PF: { rebounding: 8, finishing: 5, threePoint: -5, playmaking: -8 },
  C: { rebounding: 12, finishing: 8, threePoint: -12, playmaking: -12, athleticism: -3 },
};

type SkillKey =
  | "scoring"
  | "threePoint"
  | "finishing"
  | "playmaking"
  | "rebounding"
  | "defense"
  | "athleticism"
  | "basketballIq";

const SKILL_KEYS: SkillKey[] = [
  "scoring", "threePoint", "finishing", "playmaking", "rebounding", "defense", "athleticism", "basketballIq",
];

export interface GeneratedRatings extends Record<SkillKey, number> {
  potential: number;
  characterRating: number;
  heightInches: number;
}

function heightForPosition(rng: () => number, position: PositionType): number {
  const ranges: Record<PositionType, [number, number]> = {
    PG: [70, 76],
    SG: [74, 78],
    SF: [77, 81],
    PF: [79, 83],
    C: [81, 87],
  };
  const [lo, hi] = ranges[position];
  return randInt(rng, lo, hi);
}

export function generateRatings(
  rng: () => number,
  position: PositionType,
  baseTalent: number,
  variance: number,
  starTier: number, // 1-5, drives character-rating variance
): GeneratedRatings {
  const mods = POSITION_MODIFIERS[position] ?? {};
  const skills = {} as Record<SkillKey, number>;
  for (const key of SKILL_KEYS) {
    const mod = mods[key] ?? 0;
    skills[key] = Math.round(clamp(randNormal(rng, baseTalent + mod, variance), 15, 99));
  }

  const potential = Math.round(clamp(baseTalent + randInt(rng, 3, 18), 15, 99));

  // Character is intentionally decoupled from talent: a 5-star can be a
  // locker-room cancer, a 2-star can be a great leader. Higher star tiers get
  // wider variance (higher hype = higher boom/bust on makeup), not a higher mean.
  const characterVariance = 14 + (starTier - 1) * 3;
  const characterRating = Math.round(clamp(randNormal(rng, 62, characterVariance), 5, 99));

  return { ...skills, potential, characterRating, heightInches: heightForPosition(rng, position) };
}

export interface GeneratedProspect {
  firstName: string;
  lastName: string;
  position: PositionType;
  hometownState: string;
  countryOfOrigin: string | null; // null = USA; set for international prospects and foreign-born HS players
  source: ProspectSource;
  starRating: number;
  graduationYear: number;
  scoutingNoise: number;
  ratings: GeneratedRatings;
}

const STAR_TIER_TALENT: Record<number, { base: number; variance: number }> = {
  5: { base: 88, variance: 5 },
  4: { base: 78, variance: 6 },
  3: { base: 65, variance: 7 },
  2: { base: 52, variance: 7 },
  1: { base: 40, variance: 7 },
};

function starTierFromTalentScore(score: number): number {
  if (score >= 85) return 5;
  if (score >= 72) return 4;
  if (score >= 55) return 3;
  if (score >= 38) return 2;
  return 1;
}

export function generateHighSchoolProspect(rng: () => number, graduationYear: number): GeneratedProspect {
  const state = weightedPick(rng, weightedStateList());
  const qualityBias = STATE_PROFILES[state].qualityBias;
  const talentScore = clamp(randNormal(rng, 50, 15) + qualityBias * 5, 1, 99);
  const starRating = starTierFromTalentScore(talentScore);
  const { base, variance } = STAR_TIER_TALENT[starRating];
  const position = POSITIONS[Math.floor(rng() * POSITIONS.length)];
  const ratings = generateRatings(rng, position, base, variance, starRating);

  // Some US high schoolers were born overseas — flavor/realism, doesn't change
  // where they play (still a domestic HS recruit with a US hometown state).
  const countryOfOrigin = rng() < 0.08 ? weightedPick(rng, weightedCountryList()) : null;
  const { firstName, lastName } = pickName(rng, countryOfOrigin);

  return {
    firstName,
    lastName,
    position,
    hometownState: state,
    countryOfOrigin,
    source: "HIGH_SCHOOL",
    starRating,
    graduationYear,
    scoutingNoise: randInt(rng, 4, 16),
    ratings,
  };
}

export function generateJucoProspect(rng: () => number, graduationYear: number): GeneratedProspect {
  // JUCO pool skews slightly lower ceiling / higher floor than HS recruits:
  // these are proven-at-their-level players, not physical projects.
  const state = weightedPick(rng, weightedStateList());
  const qualityBias = STATE_PROFILES[state].qualityBias;
  const talentScore = clamp(randNormal(rng, 46, 13) + qualityBias * 3, 1, 99);
  const starRating = starTierFromTalentScore(talentScore);
  const { base, variance } = STAR_TIER_TALENT[starRating];
  const position = POSITIONS[Math.floor(rng() * POSITIONS.length)];
  const ratings = generateRatings(rng, position, base + 3, Math.max(4, variance - 2), starRating);
  ratings.potential = Math.round(clamp(ratings.potential - 6, 15, 95)); // less physical upside left

  const jucoCountryOfOrigin = rng() < 0.05 ? weightedPick(rng, weightedCountryList()) : null;
  const jucoName = pickName(rng, jucoCountryOfOrigin);

  return {
    firstName: jucoName.firstName,
    lastName: jucoName.lastName,
    position,
    hometownState: state,
    countryOfOrigin: jucoCountryOfOrigin,
    source: "JUCO",
    starRating,
    graduationYear,
    scoutingNoise: randInt(rng, 2, 10), // JUCO players have a track record, less scouting uncertainty
    ratings,
  };
}

export function generateInternationalProspect(rng: () => number, graduationYear: number): GeneratedProspect {
  const country = weightedPick(rng, weightedCountryList());
  const qualityBias = COUNTRY_PROFILES[country].qualityBias;
  // International recruiting nets a wider talent spread than domestic HS: fewer
  // prospects overall, but real chances at a hidden gem alongside real busts.
  const talentScore = clamp(randNormal(rng, 47, 17) + qualityBias * 6, 1, 99);
  const starRating = starTierFromTalentScore(talentScore);
  const { base, variance } = STAR_TIER_TALENT[starRating];
  const position = POSITIONS[Math.floor(rng() * POSITIONS.length)];
  const ratings = generateRatings(rng, position, base, variance, starRating);
  const intlName = pickName(rng, country);

  return {
    firstName: intlName.firstName,
    lastName: intlName.lastName,
    position,
    hometownState: "",
    countryOfOrigin: country,
    source: "INTERNATIONAL",
    starRating,
    graduationYear,
    // Overseas prospects are the hardest to scout accurately: less game film,
    // fewer live looks, translation/context gaps.
    scoutingNoise: randInt(rng, 10, 24),
    ratings,
  };
}

// ---------- Roster generation for initial league seed ----------

export interface GeneratedPlayer {
  firstName: string;
  lastName: string;
  position: PositionType;
  classYear: ClassYear;
  hometownState: string;
  countryOfOrigin: string | null;
  origin: PlayerOrigin;
  eligibilityYearsLeft: number;
  ratings: GeneratedRatings;
}

const CLASS_YEARS: ClassYear[] = ["FR", "SO", "JR", "SR"];
const ELIGIBILITY_BY_CLASS: Record<ClassYear, number> = { FR: 4, SO: 3, JR: 2, SR: 1, GR: 1 };

// prestige (1-100) + division -> mean talent level for the whole roster
export function baseTalentForTeam(prestige: number, division: Division): number {
  const d1Mean = 30 + prestige * 0.5;
  const offset = division === "D1" ? 0 : division === "D2" ? -12 : -24;
  return clamp(d1Mean + offset, 15, 92);
}

export function generateRosterForTeam(
  rng: () => number,
  prestige: number,
  division: Division,
  rosterSize: number,
  internationalScoutingRating = 30,
): GeneratedPlayer[] {
  const baseTalent = baseTalentForTeam(prestige, division);
  const players: GeneratedPlayer[] = [];

  // Some programs pull far more international talent than others based on
  // staff connections/scouting network, independent of overall prestige.
  const internationalShare = clamp((internationalScoutingRating / 100) * 0.22, 0.02, 0.22);
  const hsShare = Math.max(0.35, 0.75 - internationalShare);
  const jucoShare = 0.15;

  for (let i = 0; i < rosterSize; i++) {
    const position = POSITIONS[i % POSITIONS.length];
    const classYear = CLASS_YEARS[Math.floor(rng() * CLASS_YEARS.length)];
    const state = weightedPick(rng, weightedStateList());
    const variance = 9;
    // Upperclassmen are further along their development curve than the raw
    // talent roll implies; nudge current ability up a bit by class year.
    const classBump = classYear === "SO" ? 3 : classYear === "JR" ? 6 : classYear === "SR" ? 9 : 0;
    const starTierApprox = starTierFromTalentScore(baseTalent);
    const ratings = generateRatings(rng, position, baseTalent + classBump, variance, starTierApprox);

    const originRoll = rng();
    let origin: PlayerOrigin;
    let countryOfOrigin: string | null = null;
    if (originRoll < internationalShare) {
      origin = "INTERNATIONAL";
      countryOfOrigin = weightedPick(rng, weightedCountryList());
    } else if (originRoll < internationalShare + hsShare) {
      origin = "HIGH_SCHOOL";
      if (rng() < 0.08) countryOfOrigin = weightedPick(rng, weightedCountryList());
    } else if (originRoll < internationalShare + hsShare + jucoShare) {
      origin = "JUCO";
    } else {
      origin = "TRANSFER_PORTAL";
    }

    const { firstName, lastName } = pickName(rng, countryOfOrigin);
    players.push({
      firstName,
      lastName,
      position,
      classYear,
      hometownState: state,
      countryOfOrigin,
      origin,
      eligibilityYearsLeft: ELIGIBILITY_BY_CLASS[classYear],
      ratings,
    });
  }

  return players;
}
