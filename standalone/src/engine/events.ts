import { clamp } from "./rng";

export interface EventContext {
  teamId: string;
  players: { id: string; firstName: string; lastName: string; characterRating: number; scoring: number }[];
  chemistry: number; // 0-100
  phase: "IN_SEASON" | "OFFSEASON";
  recentWinPct: number;
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
    weightModifier: (ctx) => (ctx.chemistry < 55 ? 1.8 : 1),
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
    weightModifier: (ctx) => (ctx.chemistry < 50 ? 2 : 0.6),
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
