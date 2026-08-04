// Broad geographic groupings used to keep D2/D3 in-season event fields
// realistic — these programs don't have the travel budgets D1 blue-bloods
// do, so participants in a given event should mostly come from the same
// pocket of the country rather than being scattered coast to coast.

export type TravelRegion =
  | "NORTHEAST"
  | "MID_ATLANTIC"
  | "SOUTHEAST"
  | "MIDWEST"
  | "SOUTH_CENTRAL"
  | "MOUNTAIN"
  | "PACIFIC";

const REGION_STATES: Record<TravelRegion, string[]> = {
  NORTHEAST: ["CT", "MA", "ME", "NH", "RI", "VT", "NY", "NJ"],
  MID_ATLANTIC: ["PA", "MD", "DE", "VA", "WV", "DC"],
  SOUTHEAST: ["NC", "SC", "GA", "FL", "AL", "MS", "TN", "KY"],
  MIDWEST: ["OH", "MI", "IN", "IL", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"],
  SOUTH_CENTRAL: ["TX", "OK", "AR", "LA"],
  MOUNTAIN: ["CO", "UT", "WY", "MT", "ID", "NV", "AZ", "NM"],
  PACIFIC: ["CA", "OR", "WA", "AK", "HI"],
};

const STATE_TO_REGION: Record<string, TravelRegion> = {};
for (const [region, states] of Object.entries(REGION_STATES) as [TravelRegion, string[]][]) {
  for (const s of states) STATE_TO_REGION[s] = region;
}

// Regions close enough together that a short bus/van trip across the border
// is still realistic for a program that mostly plays within a day's drive.
const ADJACENT_REGIONS: Record<TravelRegion, TravelRegion[]> = {
  NORTHEAST: ["MID_ATLANTIC"],
  MID_ATLANTIC: ["NORTHEAST", "SOUTHEAST", "MIDWEST"],
  SOUTHEAST: ["MID_ATLANTIC", "SOUTH_CENTRAL", "MIDWEST"],
  MIDWEST: ["MID_ATLANTIC", "SOUTHEAST", "SOUTH_CENTRAL", "MOUNTAIN"],
  SOUTH_CENTRAL: ["SOUTHEAST", "MIDWEST", "MOUNTAIN"],
  MOUNTAIN: ["MIDWEST", "SOUTH_CENTRAL", "PACIFIC"],
  PACIFIC: ["MOUNTAIN"],
};

// A small number of member schools sit outside the 50 states + DC (e.g. Simon
// Fraser University, a Canadian D2 program in the Pacific Northwest) — these
// arrive as freeform strings rather than a 2-letter abbreviation, so match by
// substring instead of falling back to a generic (and often wrong) default.
const NON_US_OVERRIDES: [string, TravelRegion][] = [["BRITISH COLUMBIA", "PACIFIC"]];

export function regionForState(state: string): TravelRegion {
  const upper = state.toUpperCase();
  if (STATE_TO_REGION[upper]) return STATE_TO_REGION[upper];
  const override = NON_US_OVERRIDES.find(([needle]) => upper.includes(needle));
  return override?.[1] ?? "MIDWEST";
}

export function regionsInTravelRange(region: TravelRegion): TravelRegion[] {
  return [region, ...ADJACENT_REGIONS[region]];
}

export const ALL_TRAVEL_REGIONS: TravelRegion[] = Object.keys(REGION_STATES) as TravelRegion[];
