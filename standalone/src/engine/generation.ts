import { randomFirstName, randomLastName } from "./names";
import { randomInternationalFirstName, randomInternationalLastName } from "./internationalNames";
import { clamp, randInt, randNormal, weightedPick } from "./rng";
import { weightedStateList, STATE_PROFILES } from "./regions";
import { weightedCountryList, COUNTRY_PROFILES } from "./countries";
import { pickCityForState } from "./cities";
import { pickCityForCountry } from "./internationalCities";
import { pickHighSchool } from "./highSchools";
import { generateProspectPriorities, boostPriority, type PriorityProfile } from "./priorities";
import { regionForState, type TravelRegion } from "./travelRegions";
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
  disciplineRating: number;
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

  // Discipline (off-court judgment/legal risk) is related to but distinct from
  // character (locker-room fit) — a great teammate can still have poor impulse
  // control, and a locker-room pain can otherwise stay out of trouble.
  const disciplineRating = Math.round(clamp(randNormal(rng, characterRating * 0.4 + 39, 20), 5, 99));

  return { ...skills, potential, characterRating, disciplineRating, heightInches: heightForPosition(rng, position) };
}

export interface GeneratedProspect {
  firstName: string;
  lastName: string;
  position: PositionType;
  hometownState: string;
  hometownCity: string; // real US city/town matching hometownState; "" for international prospects
  highSchool: string; // US high school attended; "" for JUCO/international prospects
  countryOfOrigin: string | null; // null = USA; set for international prospects and foreign-born HS players
  source: ProspectSource;
  starRating: number;
  graduationYear: number;
  scoutingNoise: number;
  ratings: GeneratedRatings;
  priorities: PriorityProfile;
  playedEYBL: boolean;
  eyblTeam: string | null;
}

// Real EYBL runs ~40 club teams across its circuits — a fixed pool this size
// is plenty for flavor without needing a procedural name generator. Each
// team is tagged with the region it actually recruits out of, so a
// prospect's circuit team is usually one near home, not a random draw from
// across the country.
interface EyblTeamDef { name: string; region: TravelRegion }
const EYBL_TEAMS: EyblTeamDef[] = [
  { name: "Bay State Wolves", region: "NORTHEAST" },
  { name: "New England Playaz", region: "NORTHEAST" },
  { name: "NYC Renegades", region: "NORTHEAST" },
  { name: "Garden State Prodigy", region: "NORTHEAST" },
  { name: "Jersey Shore Ballers", region: "NORTHEAST" },
  { name: "Tri-State Bandits", region: "NORTHEAST" },
  { name: "DMV Elite", region: "MID_ATLANTIC" },
  { name: "Philly Triple Threat", region: "MID_ATLANTIC" },
  { name: "Baltimore Elite", region: "MID_ATLANTIC" },
  { name: "Virginia Kings", region: "MID_ATLANTIC" },
  { name: "Atlanta Xpress", region: "SOUTHEAST" },
  { name: "Carolina Rising", region: "SOUTHEAST" },
  { name: "Georgia Stars", region: "SOUTHEAST" },
  { name: "Palmetto State Ballers", region: "SOUTHEAST" },
  { name: "Queen City Elite", region: "SOUTHEAST" },
  { name: "South Florida Heat", region: "SOUTHEAST" },
  { name: "Florida Rebels", region: "SOUTHEAST" },
  { name: "Southern Assault", region: "SOUTHEAST" },
  { name: "Memphis Tigers Elite", region: "SOUTHEAST" },
  { name: "Metro Atlanta Heat", region: "SOUTHEAST" },
  { name: "Gulf Coast Heat", region: "SOUTHEAST" },
  { name: "Chicago Uprising", region: "MIDWEST" },
  { name: "Midwest Uprising", region: "MIDWEST" },
  { name: "Ohio Basketball Club", region: "MIDWEST" },
  { name: "Indy Heat", region: "MIDWEST" },
  { name: "Detroit Cartel", region: "MIDWEST" },
  { name: "Dallas Mustangs", region: "SOUTH_CENTRAL" },
  { name: "Houston Defenders", region: "SOUTH_CENTRAL" },
  { name: "Lone Star Elite", region: "SOUTH_CENTRAL" },
  { name: "Texas Titans", region: "SOUTH_CENTRAL" },
  { name: "Rocky Mountain Renegades", region: "MOUNTAIN" },
  { name: "Phoenix Rise", region: "MOUNTAIN" },
  { name: "Denver Ballers", region: "MOUNTAIN" },
  { name: "Vegas Elite", region: "MOUNTAIN" },
  { name: "Cali Supreme", region: "PACIFIC" },
  { name: "Pacific Northwest Elite", region: "PACIFIC" },
  { name: "Seattle Slam", region: "PACIFIC" },
  { name: "LA Fire", region: "PACIFIC" },
];

// Most kids play for a club near home; a real minority get scooped up by a
// program from clear across the country (the way a handful of blue-chips
// end up on a marquee circuit team far from their hometown).
const EYBL_LOCAL_CHANCE = 0.7;

export function pickEyblTeam(rng: () => number, state: string): string {
  if (rng() < EYBL_LOCAL_CHANCE) {
    const local = EYBL_TEAMS.filter((t) => t.region === regionForState(state));
    if (local.length > 0) return local[Math.floor(rng() * local.length)].name;
  }
  return EYBL_TEAMS[Math.floor(rng() * EYBL_TEAMS.length)].name;
}

// Virtually every 5-star plays the circuit by senior year; it thins out fast
// below that — mirrors how real EYBL rosters skew toward the very top of a
// class. This is the eventual (senior-year) participation rate; juniors get
// a reduced shot at it up front (EYBL_CHANCE_BY_STAR_JUNIOR) with the rest
// topped up the following year (EYBL_SENIOR_TOPUP_CHANCE_BY_STAR), which is
// what makes the circuit mostly-seniors-but-juniors-too on the board.
const EYBL_CHANCE_BY_STAR: Record<number, number> = { 5: 0.9, 4: 0.55, 3: 0.12, 2: 0, 1: 0 };

// Juniors get roughly a quarter of the eventual rate up front — real
// exposure exists for underclassmen, but the circuit is still a senior's game.
const EYBL_JUNIOR_SHARE = 0.25;
const EYBL_CHANCE_BY_STAR_JUNIOR: Record<number, number> = Object.fromEntries(
  Object.entries(EYBL_CHANCE_BY_STAR).map(([star, chance]) => [star, chance * EYBL_JUNIOR_SHARE]),
);

// Solved so that P(tagged by senior year) = P(junior) + P(1 - junior) * topup
// equals the original EYBL_CHANCE_BY_STAR exactly — juniors who didn't get
// tagged early get a second shot at breaking out senior year, ending up with
// the same overall population split roughly 80% senior-tagged / 20%
// junior-tagged among currently-visible EYBL prospects.
export const EYBL_SENIOR_TOPUP_CHANCE_BY_STAR: Record<number, number> = Object.fromEntries(
  Object.entries(EYBL_CHANCE_BY_STAR).map(([star, full]) => {
    const junior = full * EYBL_JUNIOR_SHARE;
    return [star, junior >= 1 ? 0 : (full - junior) / (1 - junior)];
  }),
);

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

export function generateHighSchoolProspect(rng: () => number, graduationYear: number, isJunior = false): GeneratedProspect {
  const state = weightedPick(rng, weightedStateList());
  const qualityBias = STATE_PROFILES[state].qualityBias;
  const talentScore = clamp(randNormal(rng, 50, 15) + qualityBias * 5, 1, 99);
  const starRating = starTierFromTalentScore(talentScore);
  const { base, variance } = STAR_TIER_TALENT[starRating];
  const position = POSITIONS[Math.floor(rng() * POSITIONS.length)];
  const ratings = generateRatings(rng, position, base, variance, starRating);
  const city = pickCityForState(rng, state);
  const highSchool = pickHighSchool(rng, starRating, city, state);

  // Some US high schoolers were born overseas — flavor/realism, doesn't change
  // where they play (still a domestic HS recruit with a US hometown state).
  const countryOfOrigin = rng() < 0.08 ? weightedPick(rng, weightedCountryList()) : null;
  const { firstName, lastName } = pickName(rng, countryOfOrigin);

  // EYBL exposure: already-scouted-hard prospects care more about staying in
  // the spotlight (brand/exposure priority bump) and are better-scouted
  // overall (tighter noise) from playing in front of every staff nationally.
  // Freshly-generated juniors get a reduced shot up front (offseason.ts tops
  // the rest up to the full rate once they reach their senior/signing year).
  const eyblChanceTable = isJunior ? EYBL_CHANCE_BY_STAR_JUNIOR : EYBL_CHANCE_BY_STAR;
  const playedEYBL = rng() < (eyblChanceTable[starRating] ?? 0);
  const eyblTeam = playedEYBL ? pickEyblTeam(rng, state) : null;
  let priorities = generateProspectPriorities(rng);
  let scoutingNoise = randInt(rng, 4, 16);
  if (playedEYBL) {
    priorities = boostPriority(priorities, "BRAND_EXPOSURE", 15);
    scoutingNoise = randInt(rng, 3, 10);
  }

  return {
    firstName,
    lastName,
    position,
    hometownState: state,
    hometownCity: city,
    highSchool,
    countryOfOrigin,
    source: "HIGH_SCHOOL",
    starRating,
    graduationYear,
    scoutingNoise,
    ratings,
    priorities,
    playedEYBL,
    eyblTeam,
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
    hometownCity: pickCityForState(rng, state),
    highSchool: "",
    countryOfOrigin: jucoCountryOfOrigin,
    source: "JUCO",
    starRating,
    graduationYear,
    scoutingNoise: randInt(rng, 2, 10), // JUCO players have a track record, less scouting uncertainty
    ratings,
    priorities: generateProspectPriorities(rng),
    playedEYBL: false,
    eyblTeam: null,
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
    hometownCity: pickCityForCountry(rng, country),
    highSchool: "",
    countryOfOrigin: country,
    source: "INTERNATIONAL",
    starRating,
    graduationYear,
    // Overseas prospects are the hardest to scout accurately: less game film,
    // fewer live looks, translation/context gaps.
    scoutingNoise: randInt(rng, 10, 24),
    ratings,
    priorities: generateProspectPriorities(rng),
    playedEYBL: false,
    eyblTeam: null,
  };
}

// ---------- Roster generation for initial league seed ----------

export interface GeneratedPlayer {
  firstName: string;
  lastName: string;
  position: PositionType;
  classYear: ClassYear;
  hometownState: string;
  hometownCity: string;
  highSchool: string;
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
    const isInternational = origin === "INTERNATIONAL";
    const city = isInternational ? pickCityForCountry(rng, countryOfOrigin!) : pickCityForState(rng, state);
    players.push({
      firstName,
      lastName,
      position,
      classYear,
      hometownState: isInternational ? "" : state,
      hometownCity: city,
      highSchool: origin === "HIGH_SCHOOL" ? pickHighSchool(rng, starTierApprox, city, state) : "",
      countryOfOrigin,
      origin,
      eligibilityYearsLeft: ELIGIBILITY_BY_CLASS[classYear],
      ratings,
    });
  }

  return players;
}
