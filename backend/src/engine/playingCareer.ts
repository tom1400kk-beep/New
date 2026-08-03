import type { SkillDeltas } from "./coachArchetypes";

export type ProPath = "NONE" | "DOMESTIC_PRO" | "OVERSEAS_PRO";

export interface PlayingCareerChoice {
  playedCollege: boolean;
  collegeTeamName: string | null;
  collegeState: string | null;
  proPath: ProPath;
  proCountry: string | null; // only meaningful when proPath === "OVERSEAS_PRO"
}

export const NO_PLAYING_CAREER: PlayingCareerChoice = {
  playedCollege: false,
  collegeTeamName: null,
  collegeState: null,
  proPath: "NONE",
  proCountry: null,
};

export interface PlayingCareerPerk {
  label: string;
  description: string;
}

export interface PlayingCareerEffects {
  deltas: SkillDeltas;
  perks: PlayingCareerPerk[];
}

// A playing career is a second, independent axis on top of archetype +
// background — most coaches have one, but it's optional and stacks with
// whatever "past" they picked as an assistant/coordinator/etc.
export function playingCareerEffects(choice: PlayingCareerChoice): PlayingCareerEffects {
  if (!choice.playedCollege) {
    return { deltas: {}, perks: [] };
  }

  const deltas: SkillDeltas = { reputation: 3, developmentSkill: 4 };
  const perks: PlayingCareerPerk[] = [
    { label: "Alma Mater Ties", description: `Extra recruiting pull with prospects from ${choice.collegeState ?? "your alma mater's home state"}.` },
  ];

  if (choice.proPath === "DOMESTIC_PRO") {
    deltas.reputation = (deltas.reputation ?? 0) + 5;
    deltas.developmentSkill = (deltas.developmentSkill ?? 0) + 2;
    perks.push({ label: "Pro Pedigree", description: "A small nationwide recruiting edge with 4- and 5-star prospects." });
  } else if (choice.proPath === "OVERSEAS_PRO") {
    deltas.reputation = (deltas.reputation ?? 0) + 3;
    deltas.recruitingSkill = (deltas.recruitingSkill ?? 0) + 8;
    perks.push({
      label: "International Playing Ties",
      description: `Extra recruiting pull with prospects from ${choice.proCountry ?? "the country you played in"}, and a boost to your program's international scouting network.`,
    });
  }

  return { deltas, perks };
}
