// Real-world-informed international talent weighting, mirroring regions.ts's
// approach to US recruiting hotbeds but for European basketball pipelines.

interface CountryProfile {
  weight: number; // relative frequency prospects come from this country
  qualityBias: number; // shifts the talent distribution up/down
}

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

export const COUNTRY_PROFILES: Record<string, CountryProfile> = {};
for (const [c, w] of TIER_A) COUNTRY_PROFILES[c] = { weight: w, qualityBias: 1.0 };
for (const [c, w] of TIER_B) COUNTRY_PROFILES[c] = { weight: w, qualityBias: 0.5 };
for (const [c, w] of TIER_C) COUNTRY_PROFILES[c] = { weight: w, qualityBias: 0.15 };
for (const [c, w] of TIER_D) COUNTRY_PROFILES[c] = { weight: w, qualityBias: -0.1 };
for (const [c, w] of REMAINING) COUNTRY_PROFILES[c] = { weight: w, qualityBias: -0.3 };

export const EUROPEAN_COUNTRIES = Object.keys(COUNTRY_PROFILES);

export function weightedCountryList(): { item: string; weight: number }[] {
  return EUROPEAN_COUNTRIES.map((c) => ({ item: c, weight: COUNTRY_PROFILES[c].weight }));
}
