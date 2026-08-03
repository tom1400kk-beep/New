import type { SkillDeltas } from "./coachArchetypes";

// Backgrounds are the RPG-creator "past" choice for the user's own coach only
// — AI coaches in the league get an archetype but no background story, so
// these perks never fire for them.
export type CoachBackground =
  | "HIGH_SCHOOL_COACH"
  | "BLUE_BLOOD_ASSISTANT"
  | "FORMER_PRO_PLAYER"
  | "MID_MAJOR_GRINDER"
  | "ANALYTICS_COORDINATOR"
  | "INTERNATIONAL_SCOUT";

export interface BackgroundProfile {
  key: CoachBackground;
  label: string;
  description: string;
  deltas: SkillDeltas;
  perkLabel: string;
  perkDescription: string;
}

export const COACH_BACKGROUNDS: BackgroundProfile[] = [
  {
    key: "HIGH_SCHOOL_COACH",
    label: "Former High School Coach",
    description: "Built a name running a powerhouse HS program before jumping to college. Deep local ties, a thinner résumé at this level.",
    deltas: { recruitingSkill: 10, reputation: -8 },
    perkLabel: "Home Turf",
    perkDescription: "Extra recruiting pull with prospects from your team's home state.",
  },
  {
    key: "BLUE_BLOOD_ASSISTANT",
    label: "Longtime Blue-Blood Assistant",
    description: "Spent years as a top assistant at a national power, learning from a legendary staff.",
    deltas: { offenseSkill: 5, defenseSkill: 5, reputation: 12 },
    perkLabel: "Big-Time Pedigree",
    perkDescription: "Extra pull with 4- and 5-star recruits who recognize the résumé.",
  },
  {
    key: "FORMER_PRO_PLAYER",
    label: "Former Pro Player",
    description: "Played professionally before getting into coaching. Players listen — he's lived it.",
    deltas: { developmentSkill: 12, recruitingSkill: -4 },
    perkLabel: "Trusted Voice",
    perkDescription: "Locker room conflicts and transfer requests come up less often on his roster.",
  },
  {
    key: "MID_MAJOR_GRINDER",
    label: "Mid-Major Grinder",
    description: "Clawed a small program up from nothing with grit and player development, not blue-chip talent.",
    deltas: { developmentSkill: 6, offenseSkill: 3, defenseSkill: 3 },
    perkLabel: "Program Builder",
    perkDescription: "Prestige climbs a little faster when the team overperforms.",
  },
  {
    key: "ANALYTICS_COORDINATOR",
    label: "Analytics & Video Coordinator",
    description: "Came up through film study and data, not a playing career. Sees matchups other coaches miss.",
    deltas: { offenseSkill: 8, defenseSkill: 8, recruitingSkill: -6 },
    perkLabel: "Scouted Edge",
    perkDescription: "A small, hidden in-game edge from superior preparation.",
  },
  {
    key: "INTERNATIONAL_SCOUT",
    label: "International Scouting Background",
    description: "Cut his teeth scouting overseas leagues and academies before coming stateside.",
    deltas: { recruitingSkill: 6 },
    perkLabel: "Global Network",
    perkDescription: "Your program's international scouting network starts significantly stronger.",
  },
];

const BACKGROUND_BY_KEY = new Map(COACH_BACKGROUNDS.map((b) => [b.key, b]));

export function getBackgroundProfile(key: string | null | undefined): BackgroundProfile | null {
  if (!key) return null;
  return BACKGROUND_BY_KEY.get(key as CoachBackground) ?? null;
}
