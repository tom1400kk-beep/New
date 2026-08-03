import { clamp } from "./rng";

export interface EventContext {
  teamId: string;
  players: {
    id: string; firstName: string; lastName: string; characterRating: number; disciplineRating: number; scoring: number;
    countryOfOrigin: string | null;
  }[];
  chemistry: number; // 0-100
  phase: "IN_SEASON" | "OFFSEASON";
  recentWinPct: number;
  coachArchetype?: string | null;
  coachBackground?: string | null;
}

export interface EventOption {
  id: string;
  label: string;
  description: string;
  effects: EventEffects;
}

export interface EventEffects {
  chemistryDelta?: number;
  hotSeatDelta?: number;
  prestigeDelta?: number;
  nilBudgetDelta?: number;
  playerCharacterDelta?: number;
  injuryWeeks?: number;
  removePlayer?: boolean; // player leaves team (transfer out)
  suspensionDays?: number;
  legalityDelta?: number; // program off-court integrity reputation
  teamPerceptionDelta?: number; // how the locker room views the coach
  nationalPerceptionDelta?: number; // national media profile
  localPerceptionDelta?: number; // local fanbase/booster goodwill
  adRelationshipDelta?: number; // shifts the coach's relationship with the CURRENT team's AD
}

export interface GeneratedEvent {
  type: string;
  title: string;
  description: string;
  playerId: string | null;
  options: EventOption[];
}

function pickWeightedPlayer(
  rng: () => number,
  players: EventContext["players"],
  favorLowCharacter: boolean,
): EventContext["players"][number] | null {
  if (players.length === 0) return null;
  if (!favorLowCharacter) return players[Math.floor(rng() * players.length)];
  const weights = players.map((p) => ({ item: p, weight: Math.max(1, 100 - p.characterRating) }));
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let r = rng() * total;
  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w.item;
  }
  return players[players.length - 1];
}

// Weighted toward low disciplineRating — poor off-court judgment makes legal
// trouble more likely, independent of how good a locker-room presence the
// player otherwise is (a well-liked player can still make a bad decision).
function pickWeightedByLowDiscipline(
  rng: () => number,
  players: EventContext["players"],
): EventContext["players"][number] | null {
  if (players.length === 0) return null;
  const weights = players.map((p) => ({ item: p, weight: Math.max(1, 105 - p.disciplineRating) ** 2 }));
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let r = rng() * total;
  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w.item;
  }
  return players[players.length - 1];
}

type Template = {
  type: string;
  phase: "IN_SEASON" | "OFFSEASON" | "ANY";
  baseWeight: number;
  weightModifier: (ctx: EventContext) => number;
  generate: (rng: () => number, ctx: EventContext) => GeneratedEvent;
};

const TEMPLATES: Template[] = [
  {
    type: "INJURY",
    phase: "IN_SEASON",
    baseWeight: 10,
    weightModifier: () => 1,
    generate: (rng, ctx) => {
      const p = pickWeightedPlayer(rng, ctx.players, false)!;
      return {
        type: "INJURY",
        title: `${p.firstName} ${p.lastName} banged up`,
        description: `${p.firstName} ${p.lastName} is dealing with a minor injury after practice. How do you handle their recovery?`,
        playerId: p.id,
        options: [
          {
            id: "rest",
            label: "Full rest",
            description: "Sit them until they're 100% — safest for the long run.",
            effects: { injuryWeeks: 2 },
          },
          {
            id: "push",
            label: "Push through it",
            description: "Play them anyway. Risk of a worse injury, but you need the minutes now.",
            effects: { injuryWeeks: rng() < 0.35 ? 5 : 0, chemistryDelta: 1 },
          },
        ],
      };
    },
  },
  {
    type: "TRANSFER_REQUEST",
    phase: "ANY",
    baseWeight: 6,
    weightModifier: (ctx) => {
      let w = ctx.chemistry < 55 ? 1.8 : 1;
      // A former pro player's locker room trust means fewer players go looking elsewhere.
      if (ctx.coachBackground === "FORMER_PRO_PLAYER") w *= 0.7;
      return w;
    },
    generate: (rng, ctx) => {
      const p = pickWeightedPlayer(rng, ctx.players, true)!;
      return {
        type: "TRANSFER_REQUEST",
        title: `${p.firstName} ${p.lastName} is unhappy`,
        description: `${p.firstName} ${p.lastName} has come to you frustrated about their role and is considering the transfer portal.`,
        playerId: p.id,
        options: [
          {
            id: "promise",
            label: "Promise a bigger role",
            description: "Commit to more minutes. Keeps them, but could rattle the rest of the rotation.",
            effects: { chemistryDelta: -3, playerCharacterDelta: 4 },
          },
          {
            id: "talk",
            label: "Have an honest conversation",
            description: "No promises, just clear the air. Moderate chance it works.",
            effects: { playerCharacterDelta: rng() < 0.5 ? 6 : -2 },
          },
          {
            id: "let_go",
            label: "Let them enter the portal",
            description: "Wish them well and open a scholarship spot.",
            effects: { removePlayer: true, chemistryDelta: 2 },
          },
        ],
      };
    },
  },
  {
    type: "CHEMISTRY_CONFLICT",
    phase: "IN_SEASON",
    baseWeight: 5,
    weightModifier: (ctx) => {
      let w = ctx.chemistry < 50 ? 2 : 0.6;
      if (ctx.coachArchetype === "DISCIPLINARIAN") w *= 0.6;
      if (ctx.coachBackground === "FORMER_PRO_PLAYER") w *= 0.6;
      return w;
    },
    generate: (rng, ctx) => {
      const p = pickWeightedPlayer(rng, ctx.players, true)!;
      return {
        type: "CHEMISTRY_CONFLICT",
        title: "Locker room tension",
        description: `Words were exchanged after practice, and ${p.firstName} ${p.lastName} was at the center of it. The team is watching how you respond.`,
        playerId: p.id,
        options: [
          {
            id: "discipline",
            label: "Discipline the player",
            description: "Extra conditioning, sends a message about standards.",
            effects: { chemistryDelta: 4, playerCharacterDelta: -3 },
          },
          {
            id: "ignore",
            label: "Let it blow over",
            description: "Trust the team to sort it out themselves.",
            effects: { chemistryDelta: rng() < 0.5 ? 2 : -5 },
          },
        ],
      };
    },
  },
  {
    type: "BOOSTER_DEMAND",
    phase: "ANY",
    baseWeight: 4,
    weightModifier: () => 1,
    generate: () => ({
      type: "BOOSTER_DEMAND",
      title: "Booster pressure",
      description: "A major NIL booster is pushing you to give their favorite recruit more minutes than the rotation calls for.",
      playerId: null,
      options: [
        {
          id: "comply",
          label: "Go along with it",
          description: "Keeps the money flowing, but the locker room notices.",
          effects: { nilBudgetDelta: 50000, chemistryDelta: -4 },
        },
        {
          id: "refuse",
          label: "Coach your team, not the boosters",
          description: "Protects the locker room, but the budget takes a hit.",
          effects: { nilBudgetDelta: -30000, chemistryDelta: 3 },
        },
      ],
    }),
  },
  {
    type: "OVERSEAS_DEPARTURE",
    phase: "OFFSEASON",
    baseWeight: 4,
    weightModifier: (ctx) => (ctx.players.some((p) => p.countryOfOrigin) ? 1 : 0),
    generate: (rng, ctx) => {
      const eligible = ctx.players.filter((p) => p.countryOfOrigin);
      // Better players draw bigger, harder-to-refuse pro offers.
      const weights = eligible.map((p) => ({ item: p, weight: Math.max(1, p.scoring) }));
      const total = weights.reduce((s, w) => s + w.weight, 0);
      let r = rng() * total;
      let p = weights[0]?.item;
      for (const w of weights) {
        r -= w.weight;
        if (r <= 0) { p = w.item; break; }
      }
      return {
        type: "OVERSEAS_DEPARTURE",
        title: `${p.firstName} ${p.lastName} has a pro offer back home`,
        description: `A club in ${p.countryOfOrigin} has offered ${p.firstName} ${p.lastName} a paid professional contract. They're considering leaving school to take it.`,
        playerId: p.id,
        options: [
          {
            id: "let_go",
            label: "Let them chase it",
            description: "Wish them well and open the roster spot — some opportunities don't wait.",
            effects: { removePlayer: true, chemistryDelta: 1 },
          },
          {
            id: "convince",
            label: "Make the case to stay",
            description: "Sell them on their future here. Might work, might not — and pushing too hard can sour things either way.",
            effects: { playerCharacterDelta: rng() < 0.45 ? 5 : -4 },
          },
        ],
      };
    },
  },
  {
    type: "ACADEMIC_ISSUE",
    phase: "OFFSEASON",
    baseWeight: 3,
    weightModifier: () => 1,
    generate: (rng, ctx) => {
      const p = pickWeightedPlayer(rng, ctx.players, true)!;
      return {
        type: "ACADEMIC_ISSUE",
        title: `${p.firstName} ${p.lastName} struggling in the classroom`,
        description: `Academic advisors flagged ${p.firstName} ${p.lastName} as at risk of losing eligibility.`,
        playerId: p.id,
        options: [
          {
            id: "study_hall",
            label: "Mandate study hall",
            description: "Cuts into free time, but keeps them eligible and builds discipline.",
            effects: { playerCharacterDelta: 5 },
          },
          {
            id: "ignore",
            label: "Leave it to them",
            description: "Risk losing them for a stretch of the season.",
            effects: { injuryWeeks: rng() < 0.3 ? 3 : 0 },
          },
        ],
      };
    },
  },
  {
    type: "ARREST",
    phase: "ANY",
    baseWeight: 2,
    weightModifier: (ctx) => {
      const riskiest = Math.min(...ctx.players.map((p) => p.disciplineRating));
      let w = riskiest < 35 ? 2.4 : riskiest < 55 ? 1.3 : riskiest < 75 ? 0.5 : 0.15;
      // A Disciplinarian's accountability culture makes off-court incidents rarer.
      if (ctx.coachArchetype === "DISCIPLINARIAN") w *= 0.5;
      return w;
    },
    generate: (rng, ctx) => {
      const p = pickWeightedByLowDiscipline(rng, ctx.players)!;
      return {
        type: "ARREST",
        title: `${p.firstName} ${p.lastName} arrested`,
        description: `${p.firstName} ${p.lastName} was arrested overnight on a misdemeanor charge after an off-campus incident. It's already circulating on social media and local news has picked it up. The administration is waiting on you to decide how the program responds.`,
        playerId: p.id,
        options: [
          {
            id: "suspend_indefinite",
            label: "Suspend indefinitely pending the investigation",
            description: "Hold them out until the legal process resolves. Costs you the player for a while, but shows standards and mostly protects your program's reputation.",
            effects: { suspensionDays: 21, chemistryDelta: 3, prestigeDelta: 1, hotSeatDelta: -2, legalityDelta: -3 },
          },
          {
            id: "suspend_games",
            label: "Suspend a few games",
            description: "A short, defined suspension while things play out — a middle-ground response that still costs you some program reputation.",
            effects: { suspensionDays: 7, chemistryDelta: 1, legalityDelta: -6 },
          },
          {
            id: "stand_by",
            label: "Stand by the player, no suspension",
            description: "Keep them available. Protects your roster, but the optics are bad — this is the option that hurts your program's legality reputation most.",
            effects: { hotSeatDelta: 5, prestigeDelta: -3, chemistryDelta: -4, legalityDelta: -14 },
          },
          {
            id: "dismiss",
            label: "Dismiss them from the team",
            description: "Cut ties entirely. Opens a scholarship spot, sends a clear message, and actually boosts your program's reputation for accountability — but you lose the player for good.",
            effects: { removePlayer: true, chemistryDelta: 3, prestigeDelta: 2, hotSeatDelta: -3, legalityDelta: 3 },
          },
        ],
      };
    },
  },
];

// Kept deliberately low-frequency: this returns an event on roughly 1 in 6-10
// eligible ticks, not every time, per the "not overpowering" design goal.
export function maybeGenerateEvent(rng: () => number, ctx: EventContext): GeneratedEvent | null {
  const applicable = TEMPLATES.filter((t) => t.phase === "ANY" || t.phase === ctx.phase);
  const weighted = applicable.map((t) => ({ template: t, weight: t.baseWeight * t.weightModifier(ctx) }));
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

  const fireChance = 0.12; // per tick
  if (rng() > fireChance) return null;
  if (ctx.players.length === 0) return null;

  let r = rng() * totalWeight;
  for (const w of weighted) {
    r -= w.weight;
    if (r <= 0) return w.template.generate(rng, ctx);
  }
  return null;
}

export function applyChemistryClamp(value: number): number {
  return clamp(value, 0, 100);
}
