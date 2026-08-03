import { clamp, randNormal } from "./rng";

export type CoachArchetype =
  | "OFFENSIVE_INNOVATOR"
  | "DEFENSIVE_ANCHOR"
  | "RECRUITER"
  | "PLAYER_DEVELOPER"
  | "PROGRAM_BUILDER"
  | "DISCIPLINARIAN";

export interface SkillDeltas {
  offenseSkill?: number;
  defenseSkill?: number;
  recruitingSkill?: number;
  developmentSkill?: number;
  reputation?: number;
}

export interface ArchetypeProfile {
  key: CoachArchetype;
  label: string;
  description: string;
  deltas: SkillDeltas;
}

export const COACH_ARCHETYPES: ArchetypeProfile[] = [
  {
    key: "OFFENSIVE_INNOVATOR",
    label: "Offensive Innovator",
    description: "Builds his identity around pace and spacing. Teams score more under him, but the defensive end can lag.",
    deltas: { offenseSkill: 14, defenseSkill: -5 },
  },
  {
    key: "DEFENSIVE_ANCHOR",
    label: "Defensive Anchor",
    description: "Wins with defense and physicality first. Stingy on that end, but the offense can stall.",
    deltas: { defenseSkill: 14, offenseSkill: -5 },
  },
  {
    key: "RECRUITER",
    label: "The Closer",
    description: "A relentless recruiter who wins the living room. Elite at bringing in talent, less hands-on developing it once it's here.",
    deltas: { recruitingSkill: 14, developmentSkill: -5 },
  },
  {
    key: "PLAYER_DEVELOPER",
    label: "Player Developer",
    description: "Known for turning three-star talent into pros. Great in the gym, spends less time on the recruiting trail.",
    deltas: { developmentSkill: 14, recruitingSkill: -5 },
  },
  {
    key: "PROGRAM_BUILDER",
    label: "Program Builder",
    description: "A steady administrator who plays the long game. Balanced on the court, and boosters/ADs are patient with him.",
    deltas: { offenseSkill: 3, defenseSkill: 3, recruitingSkill: 3, developmentSkill: 3, reputation: 8 },
  },
  {
    key: "DISCIPLINARIAN",
    label: "Disciplinarian",
    description: "Runs a tight ship with real accountability. Locker rooms stay in line and off-court incidents are rarer, but the style doesn't connect with every recruit.",
    deltas: { defenseSkill: 6, developmentSkill: -4 },
  },
];

const ARCHETYPE_BY_KEY = new Map(COACH_ARCHETYPES.map((a) => [a.key, a]));

export function getArchetypeProfile(key: string | null | undefined): ArchetypeProfile {
  return ARCHETYPE_BY_KEY.get(key as CoachArchetype) ?? COACH_ARCHETYPES[4];
}

export function randomArchetype(rng: () => number): CoachArchetype {
  return COACH_ARCHETYPES[Math.floor(rng() * COACH_ARCHETYPES.length)].key;
}

export interface GeneratedCoachSkills {
  offenseSkill: number;
  defenseSkill: number;
  recruitingSkill: number;
  developmentSkill: number;
  reputation: number;
}

// Shared coach-skill generator used for every coach in the league (AI and
// player) — an archetype (and, for the user's own coach, a background) biases
// the mean before the normal-distribution roll, so e.g. a Defensive Anchor is
// *likely* to grade out better on D than an Offensive Innovator at the same
// prestige level, not guaranteed to be.
export function generateCoachSkills(
  rng: () => number,
  prestige: number,
  archetype: CoachArchetype,
  extraDeltas?: SkillDeltas,
): GeneratedCoachSkills {
  const skillMean = 45 + prestige * 0.2;
  const profile = getArchetypeProfile(archetype);
  const d = (key: keyof SkillDeltas) => (profile.deltas[key] ?? 0) + (extraDeltas?.[key] ?? 0);

  return {
    offenseSkill: Math.round(clamp(randNormal(rng, skillMean + d("offenseSkill"), 12), 15, 95)),
    defenseSkill: Math.round(clamp(randNormal(rng, skillMean + d("defenseSkill"), 12), 15, 95)),
    recruitingSkill: Math.round(clamp(randNormal(rng, skillMean + d("recruitingSkill"), 12), 15, 95)),
    developmentSkill: Math.round(clamp(randNormal(rng, skillMean + d("developmentSkill"), 12), 15, 95)),
    reputation: Math.round(clamp(randNormal(rng, prestige * 0.6 + 15 + d("reputation"), 12), 5, 95)),
  };
}
