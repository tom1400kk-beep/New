// Real in-game injury risk, tied to actual minutes played rather than a
// random narrative pop-up — rolled once per player per game right after the
// box score is simulated. Most hits are minor; true season-enders are rare,
// matching how injury reports actually skew in real college basketball.

import { clamp, randInt } from "./rng";

export interface InjuryResult {
  type: string;
  daysOut: number;
}

// A small base risk (even garbage-time minutes carry some chance) plus a
// per-minute component so starters who log heavy minutes face meaningfully
// more exposure over a season than end-of-bench guys — a 34-minute starter
// sits around a 1% chance per game, which compounds to roughly a
// one-in-four shot at some injury across a full season.
const BASE_RISK = 0.0015;
const PER_MINUTE_RISK = 0.00025;

interface SeverityTier {
  label: "MINOR" | "MODERATE" | "SIGNIFICANT" | "SEVERE";
  weight: number;
  minDays: number;
  maxDays: number;
  names: string[];
}

const SEVERITY_TIERS: SeverityTier[] = [
  {
    label: "MINOR", weight: 55, minDays: 3, maxDays: 9,
    names: ["Ankle sprain", "Knee soreness", "Back spasms", "Wrist sprain", "Hip pointer", "Finger sprain", "Bruised heel"],
  },
  {
    label: "MODERATE", weight: 30, minDays: 10, maxDays: 21,
    names: ["High ankle sprain", "Hamstring strain", "Shoulder sprain", "Calf strain", "Groin strain", "Turf toe"],
  },
  {
    label: "SIGNIFICANT", weight: 11, minDays: 22, maxDays: 42,
    names: ["Concussion protocol", "Stress reaction", "MCL sprain", "Foot fracture", "Oblique strain"],
  },
  {
    label: "SEVERE", weight: 4, minDays: 60, maxDays: 140,
    names: ["ACL tear", "Achilles rupture", "Fractured leg", "Torn labrum", "Fractured wrist"],
  },
];

function pickSeverityTier(rng: () => number): SeverityTier {
  const total = SEVERITY_TIERS.reduce((s, t) => s + t.weight, 0);
  let r = rng() * total;
  for (const tier of SEVERITY_TIERS) {
    r -= tier.weight;
    if (r <= 0) return tier;
  }
  return SEVERITY_TIERS[0];
}

export function rollInjury(rng: () => number, minutesPlayed: number): InjuryResult | null {
  if (minutesPlayed <= 0) return null;
  const chance = clamp(BASE_RISK + minutesPlayed * PER_MINUTE_RISK, 0, 1);
  if (rng() > chance) return null;

  const tier = pickSeverityTier(rng);
  const daysOut = randInt(rng, tier.minDays, tier.maxDays);
  const type = tier.names[Math.floor(rng() * tier.names.length)];
  return { type, daysOut };
}
