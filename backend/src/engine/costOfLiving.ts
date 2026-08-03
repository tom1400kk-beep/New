// Relative cost-of-living index by state, 100 = national average. Flavor
// data in the same spirit as regions.ts's talent weighting — approximate,
// not sourced from a specific index, but directionally realistic (HI/DC/CA/
// NY/MA read as expensive, MS/AR/WV/OK/KS read as cheap, matching broad
// public understanding of US cost-of-living geography).
export const COST_OF_LIVING_INDEX: Record<string, number> = {
  AL: 87, AK: 125, AZ: 103, AR: 85, CA: 142, CO: 105, CT: 118, DE: 103, DC: 152,
  FL: 103, GA: 90, HI: 184, ID: 96, IL: 95, IN: 90, IA: 89, KS: 87, KY: 89,
  LA: 92, ME: 111, MD: 111, MA: 131, MI: 90, MN: 99, MS: 84, MO: 87, MT: 96,
  NE: 89, NV: 104, NH: 110, NJ: 114, NM: 92, NY: 125, NC: 93, ND: 98, OH: 90,
  OK: 87, OR: 113, PA: 96, RI: 116, SC: 92, SD: 92, TN: 90, TX: 92, UT: 100,
  VT: 115, VA: 100, WA: 115, WV: 87, WI: 96, WY: 93,
};

export function costOfLivingIndex(state: string): number {
  return COST_OF_LIVING_INDEX[state] ?? 100;
}

export function costOfLivingLabel(index: number): string {
  if (index >= 130) return "Much pricier";
  if (index >= 112) return "Pricier";
  if (index >= 95) return "About average";
  if (index >= 85) return "Cheaper";
  return "Much cheaper";
}

// A salary adjusted for local purchasing power — what it's actually "worth"
// relative to the national-average dollar, useful for comparing two offers
// in different states honestly instead of just comparing sticker prices.
export function realTermsValue(salary: number, state: string): number {
  return Math.round(salary / (costOfLivingIndex(state) / 100));
}
