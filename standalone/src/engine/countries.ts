// Real-world-informed international talent weighting, mirroring regions.ts's
// approach to US recruiting hotbeds but for the actual global pipelines that
// feed international college basketball recruiting — not just Europe.

interface CountryProfile {
  weight: number; // relative frequency prospects come from this country
  qualityBias: number; // shifts the talent distribution up/down
}

// ---- Europe (the original pool) ----
const TIER_A: [string, number][] = [["Serbia", 10], ["Lithuania", 9], ["France", 10]];
const TIER_B: [string, number][] = [["Spain", 7], ["Croatia", 6], ["Slovenia", 5], ["Greece", 6]];
const TIER_C: [string, number][] = [
  ["Germany", 5], ["Italy", 5], ["Turkey", 4], ["Latvia", 4], ["Montenegro", 3],
];
const TIER_D: [string, number][] = [
  ["Bosnia and Herzegovina", 2], ["Czech Republic", 2], ["Poland", 2], ["Ukraine", 2], ["Russia", 2],
];
const REMAINING: [string, number][] = [
  ["Belgium", 1], ["Netherlands", 1], ["Portugal", 1], ["Austria", 1], ["Switzerland", 1],
  ["Finland", 1], ["Sweden", 1], ["Norway", 1], ["Denmark", 1], ["Hungary", 1],
  ["Romania", 1], ["Bulgaria", 1], ["Georgia", 1], ["Estonia", 1], ["North Macedonia", 1],
];

// ---- Rest of the world: Canada is the single biggest non-US pipeline today;
// West/Central/East Africa, Australia/NZ, Latin America, and East Asia each
// have real, established NCAA/international pipelines of their own. ----
const TIER_A_WORLD: [string, number][] = [["Canada", 10], ["Nigeria", 8]];
const TIER_B_WORLD: [string, number][] = [["Australia", 6], ["Senegal", 5], ["Cameroon", 4]];
const TIER_C_WORLD: [string, number][] = [
  ["Dominican Republic", 4], ["Argentina", 4], ["Brazil", 4], ["South Sudan", 3], ["Mali", 3],
];
const TIER_D_WORLD: [string, number][] = [
  ["China", 2], ["Japan", 2], ["Philippines", 2], ["Venezuela", 2], ["DR Congo", 2], ["Israel", 2],
];
const REMAINING_WORLD: [string, number][] = [["New Zealand", 1], ["Bahamas", 1]];

export const COUNTRY_PROFILES: Record<string, CountryProfile> = {};
for (const [c, w] of TIER_A) COUNTRY_PROFILES[c] = { weight: w, qualityBias: 1.0 };
for (const [c, w] of TIER_B) COUNTRY_PROFILES[c] = { weight: w, qualityBias: 0.5 };
for (const [c, w] of TIER_C) COUNTRY_PROFILES[c] = { weight: w, qualityBias: 0.15 };
for (const [c, w] of TIER_D) COUNTRY_PROFILES[c] = { weight: w, qualityBias: -0.1 };
for (const [c, w] of REMAINING) COUNTRY_PROFILES[c] = { weight: w, qualityBias: -0.3 };
for (const [c, w] of TIER_A_WORLD) COUNTRY_PROFILES[c] = { weight: w, qualityBias: 1.0 };
for (const [c, w] of TIER_B_WORLD) COUNTRY_PROFILES[c] = { weight: w, qualityBias: 0.5 };
for (const [c, w] of TIER_C_WORLD) COUNTRY_PROFILES[c] = { weight: w, qualityBias: 0.15 };
for (const [c, w] of TIER_D_WORLD) COUNTRY_PROFILES[c] = { weight: w, qualityBias: -0.1 };
for (const [c, w] of REMAINING_WORLD) COUNTRY_PROFILES[c] = { weight: w, qualityBias: -0.3 };

export const INTERNATIONAL_COUNTRIES = Object.keys(COUNTRY_PROFILES);

export function weightedCountryList(): { item: string; weight: number }[] {
  return INTERNATIONAL_COUNTRIES.map((c) => ({ item: c, weight: COUNTRY_PROFILES[c].weight }));
}
