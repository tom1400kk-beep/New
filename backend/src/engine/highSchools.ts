// Real US high schools for domestic HS prospects/players, plus a large pool of
// generic town-based school names for everyone else — same idea as EYBL_TEAMS
// in generation.ts (a fixed curated flavor pool) but for the school itself.
export interface PowerhouseSchool {
  name: string;
  state: string;
  weight: number;
}

export const POWERHOUSE_SCHOOLS: PowerhouseSchool[] = [
  // ~38 real, well-known national/regional basketball-powerhouse HS/prep programs,
  // spread across many states so the national (non-state-gated) draw doesn't skew
  // to just CA/FL. Weight reflects general basketball-recruiting reputation, not an
  // audit of specific rosters or players — flavor/realism data, same spirit as the
  // real D1 team/conference names already used throughout this game.
  { name: "Montverde Academy", state: "FL", weight: 12 },
  { name: "IMG Academy", state: "FL", weight: 11 },
  { name: "Oak Hill Academy", state: "VA", weight: 9 },
  { name: "Wasatch Academy", state: "UT", weight: 8 },
  { name: "Link Academy", state: "MO", weight: 8 },
  { name: "Prolific Prep", state: "CA", weight: 8 },
  { name: "Sunrise Christian Academy", state: "KS", weight: 7 },
  { name: "AZ Compass Prep", state: "AZ", weight: 7 },
  { name: "La Lumiere School", state: "IN", weight: 7 },
  { name: "Sierra Canyon School", state: "CA", weight: 7 },
  { name: "Long Island Lutheran", state: "NY", weight: 7 },
  { name: "DeMatha Catholic High School", state: "MD", weight: 6 },
  { name: "Huntington Prep", state: "WV", weight: 6 },
  { name: "Roselle Catholic High School", state: "NJ", weight: 6 },
  { name: "Westtown School", state: "PA", weight: 6 },
  { name: "Combine Academy", state: "NC", weight: 5 },
  { name: "Spire Academy", state: "OH", weight: 5 },
  { name: "Hillcrest Prep", state: "AZ", weight: 5 },
  { name: "Rancho Christian School", state: "CA", weight: 5 },
  { name: "Notre Dame Prep", state: "MA", weight: 5 },
  { name: "Chino Hills High School", state: "CA", weight: 5 },
  { name: "Simeon Career Academy", state: "IL", weight: 5 },
  { name: "Corona Centennial High School", state: "CA", weight: 4 },
  { name: "Etiwanda High School", state: "CA", weight: 4 },
  { name: "Christ School", state: "NC", weight: 4 },
  { name: "Whitney Young High School", state: "IL", weight: 4 },
  { name: "Camden High School", state: "NJ", weight: 4 },
  { name: "Word of God Christian Academy", state: "NC", weight: 4 },
  { name: "Brewster Academy", state: "NH", weight: 4 },
  { name: "St. Benedict's Preparatory School", state: "NJ", weight: 4 },
  { name: "Paul VI Catholic High School", state: "VA", weight: 4 },
  { name: "Duncanville High School", state: "TX", weight: 4 },
  { name: "Vertical Academy", state: "NC", weight: 3 },
  { name: "Blair Academy", state: "NJ", weight: 3 },
  { name: "Gonzaga College High School", state: "DC", weight: 3 },
  { name: "St. John's College High School", state: "DC", weight: 3 },
  { name: "Wheeler High School", state: "GA", weight: 3 },
  { name: "Bishop Gorman High School", state: "NV", weight: 3 },
  { name: "Cardinal Hayes High School", state: "NY", weight: 3 },
];

export const POWERHOUSE_SCHOOL_NAMES: Set<string> = new Set(POWERHOUSE_SCHOOLS.map((s) => s.name));

// Blue-chips disproportionately funnel through a small number of national
// prep powerhouses in real recruiting; thins out fast below 4-star, mirroring
// the EYBL_CHANCE_BY_STAR precedent in generation.ts. Caps at 35% even for
// 5-stars, so the large majority of every class — regular local schools —
// still dominates, at every star tier.
export const HIGH_SCHOOL_CHANCE_BY_STAR: Record<number, number> = { 5: 0.35, 4: 0.15, 3: 0.045, 2: 0.012, 1: 0.003 };

export const GENERIC_SCHOOL_TEMPLATES: string[] = [
  "{city} High School", "{city} Central High School", "{city} North High School", "{city} South High School",
  "{city} East High School", "{city} West High School", "{city} Christian Academy", "{city} Catholic High School",
  "{city} Preparatory Academy", "{city} Community High School",
  "Lincoln High School", "Washington High School", "Jefferson High School", "Roosevelt High School",
  "Kennedy High School", "Madison High School", "Central High School",
];

export const POWERHOUSE_D1_CLASS_CAP = 5;

export function pickGenericHighSchool(rng: () => number, city: string): string {
  const template = GENERIC_SCHOOL_TEMPLATES[Math.floor(rng() * GENERIC_SCHOOL_TEMPLATES.length)];
  return template.includes("{city}") ? template.replace("{city}", city || "Central") : template;
}

export function pickHighSchool(rng: () => number, starRating: number, city: string, state: string): string {
  const chance = HIGH_SCHOOL_CHANCE_BY_STAR[starRating] ?? 0;
  if (rng() < chance) {
    const total = POWERHOUSE_SCHOOLS.reduce((s, p) => s + p.weight, 0);
    let r = rng() * total;
    for (const p of POWERHOUSE_SCHOOLS) {
      r -= p.weight;
      if (r <= 0) return p.name;
    }
    return POWERHOUSE_SCHOOLS[POWERHOUSE_SCHOOLS.length - 1].name;
  }
  return pickGenericHighSchool(rng, city);
}

// Caps how many D1 signings a single powerhouse school can produce in one
// recruiting class (summed across every D1 team combined). If this signing
// would push the school over the cap, silently reroll to a generic local
// school instead of blocking the signing outright — realistic enough (kids
// from a stacked class end up dispersed to non-flagship local schools) and
// keeps roster generation simple (no retry/backoff needed).
export function capHighSchoolIfNeeded(
  rng: () => number,
  highSchool: string,
  city: string,
  isD1: boolean,
  counter: Map<string, number>,
): string {
  if (!isD1 || !POWERHOUSE_SCHOOL_NAMES.has(highSchool)) return highSchool;
  const count = counter.get(highSchool) ?? 0;
  if (count >= POWERHOUSE_D1_CLASS_CAP) return pickGenericHighSchool(rng, city);
  counter.set(highSchool, count + 1);
  return highSchool;
}
