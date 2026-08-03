import { clamp } from "./rng";
import type { Division } from "../types";
import type { EventOption, GeneratedEvent } from "./events";

export type MediaCategory = "ROUTINE_WIN" | "ROUTINE_LOSS" | "UPSET_WIN" | "BLOWOUT_LOSS" | "WIN_STREAK" | "LOSS_STREAK" | "SCANDAL";

export interface MediaContext {
  opponentName: string;
  teamPrestige: number;
  division: Division;
  opponentPrestige: number;
  result: "WIN" | "LOSS";
  margin: number; // team score minus opponent score — negative on a loss
  winStreak: number; // consecutive wins ending with today's game (0 if today was a loss)
  lossStreak: number; // consecutive losses ending with today's game (0 if today was a win)
  isTournament: boolean;
  legalityReputation: number;
}

// How big a program's media footprint is — blue-bloods get chased down after
// every game, mid-majors sometimes, small D2/D3 programs almost never except
// when something genuinely newsworthy happens. Mirrors the same "market size
// follows prestige" logic as salaryForTeam/nilBudgetForTeam.
function baseInterviewChance(prestige: number, division: Division): number {
  if (division === "D1") return clamp(prestige / 120 + 0.1, 0.15, 0.92);
  if (division === "D2") return clamp(prestige / 300 + 0.03, 0.03, 0.35);
  return clamp(prestige / 600 + 0.01, 0.01, 0.15);
}

const NEWSWORTHY_BONUS: Record<MediaCategory, number> = {
  ROUTINE_WIN: 0,
  ROUTINE_LOSS: 0,
  UPSET_WIN: 0.4,
  BLOWOUT_LOSS: 0.3,
  WIN_STREAK: 0.35,
  LOSS_STREAK: 0.3,
  SCANDAL: 0, // scandal uses its own roll below, not the newsworthy-bonus path
};

function classify(ctx: MediaContext): MediaCategory {
  if (ctx.result === "WIN" && ctx.opponentPrestige - ctx.teamPrestige >= 15) return "UPSET_WIN";
  if (ctx.result === "LOSS" && ctx.margin <= -20) return "BLOWOUT_LOSS";
  if (ctx.result === "WIN" && ctx.winStreak >= 5) return "WIN_STREAK";
  if (ctx.result === "LOSS" && ctx.lossStreak >= 3) return "LOSS_STREAK";
  return ctx.result === "WIN" ? "ROUTINE_WIN" : "ROUTINE_LOSS";
}

function opt(id: string, label: string, description: string, effects: EventOption["effects"]): EventOption {
  return { id, label, description, effects };
}

function generateForCategory(category: MediaCategory, ctx: MediaContext): GeneratedEvent {
  const opp = ctx.opponentName;
  switch (category) {
    case "UPSET_WIN":
      return {
        type: "MEDIA_UPSET_WIN",
        title: `Upset alert: beat ${opp}`,
        description: `Nobody expected that. Beating a program like ${opp} is getting picked up well beyond the local papers.`,
        playerId: null,
        options: [
          opt("bold", "\"We can play with anybody\"", "Send a message to the rest of the country.", { nationalPerceptionDelta: 8, localPerceptionDelta: 5, teamPerceptionDelta: 2, hotSeatDelta: 2 }),
          opt("humble", "\"Our guys just executed the plan\"", "Keep the attention on the team, not the moment.", { teamPerceptionDelta: 6, nationalPerceptionDelta: 5, localPerceptionDelta: 3 }),
        ],
      };
    case "BLOWOUT_LOSS":
      return {
        type: "MEDIA_BLOWOUT_LOSS",
        title: `Rough night against ${opp}`,
        description: `That result is going to draw questions well past the box score.`,
        playerId: null,
        options: [
          opt("own_it", "Own it completely", "No excuses — tell them it's on you.", { teamPerceptionDelta: 3, adRelationshipDelta: 3, nationalPerceptionDelta: -2, localPerceptionDelta: -1, hotSeatDelta: 1 }),
          opt("defend", "Defend the players publicly", "Shield the team from the criticism.", { teamPerceptionDelta: 6, adRelationshipDelta: -2, nationalPerceptionDelta: -4, hotSeatDelta: 3 }),
          opt("terse", "Keep it short, no excuses", "Give a clipped answer and move on.", { nationalPerceptionDelta: -1, localPerceptionDelta: 1, teamPerceptionDelta: -2 }),
        ],
      };
    case "WIN_STREAK":
      return {
        type: "MEDIA_WIN_STREAK",
        title: `${ctx.winStreak}-game winning streak`,
        description: `The streak has national media paying attention now. What's the message?`,
        playerId: null,
        options: [
          opt("guarantee", "\"This team can make a run\"", "Raise expectations publicly.", { nationalPerceptionDelta: 7, localPerceptionDelta: 5, hotSeatDelta: 3 }),
          opt("business_as_usual", "Stay businesslike", "Downplay it, keep the room even-keeled.", { teamPerceptionDelta: 5, nationalPerceptionDelta: 4, localPerceptionDelta: 2 }),
        ],
      };
    case "LOSS_STREAK":
      return {
        type: "MEDIA_LOSS_STREAK",
        title: `${ctx.lossStreak} losses in a row`,
        description: `Reporters are asking pointed questions about the direction of the program — some are asking about your job security directly.`,
        playerId: null,
        options: [
          opt("confident", "\"We'll turn it around\"", "Project calm confidence.", { localPerceptionDelta: 2, hotSeatDelta: -1, adRelationshipDelta: 1 }),
          opt("honest", "Be honest about the struggle", "Admit the team isn't good enough right now.", { teamPerceptionDelta: 3, nationalPerceptionDelta: -2, hotSeatDelta: 2 }),
          opt("refuse", "Refuse to discuss job security", "Shut the line of questioning down.", { adRelationshipDelta: -3, nationalPerceptionDelta: -3, localPerceptionDelta: -2 }),
        ],
      };
    case "ROUTINE_WIN":
      return {
        type: "MEDIA_ROUTINE_WIN",
        title: `Postgame: beat ${opp}`,
        description: ctx.isTournament
          ? `You advanced with a win over ${opp}. Reporters are waiting by the locker room.`
          : `You picked up a win over ${opp}. A reporter wants a quick reaction.`,
        playerId: null,
        options: [
          opt("credit_players", "Credit the players", "Put the spotlight on the guys who did the work.", { teamPerceptionDelta: 3, localPerceptionDelta: 2, adRelationshipDelta: 1 }),
          opt("credit_system", "Talk up the gameplan", "Point to the strategy and preparation.", { nationalPerceptionDelta: 3, teamPerceptionDelta: -1 }),
          opt("keep_it_short", "Stay brief, one game at a time", "Give the safe, unremarkable answer.", { localPerceptionDelta: 1, adRelationshipDelta: 1 }),
        ],
      };
    case "ROUTINE_LOSS":
    default:
      return {
        type: "MEDIA_ROUTINE_LOSS",
        title: `Postgame: fell to ${opp}`,
        description: ctx.isTournament
          ? `The season took a hit tonight against ${opp}. Reporters want to know what went wrong.`
          : `A tough one tonight against ${opp}. Reporters want to know what went wrong.`,
        playerId: null,
        options: [
          opt("responsibility", "Take responsibility", "Own it publicly instead of pointing fingers.", { teamPerceptionDelta: 4, localPerceptionDelta: 1, nationalPerceptionDelta: 1, adRelationshipDelta: 2 }),
          opt("effort", "Call out the effort", "Publicly challenge the team to play harder.", { teamPerceptionDelta: -5, localPerceptionDelta: 2, hotSeatDelta: 1 }),
          opt("deflect", "Point to injuries and the schedule", "Explain away the loss.", { nationalPerceptionDelta: -3, adRelationshipDelta: -2 }),
        ],
      };
  }
}

function generateScandal(): GeneratedEvent {
  return {
    type: "MEDIA_SCANDAL",
    title: "Reporters ask about the program's off-court issues",
    description: "A recent incident involving the program has reporters asking harder questions than usual — this one isn't about basketball.",
    playerId: null,
    options: [
      opt("accountability", "Emphasize accountability", "Talk about standards and consequences.", { adRelationshipDelta: 3, nationalPerceptionDelta: 2, localPerceptionDelta: 1 }),
      opt("defend_program", "Defend the program's culture", "Push back on the narrative.", { nationalPerceptionDelta: -3, teamPerceptionDelta: 3, adRelationshipDelta: -2 }),
      opt("no_comment", "\"No comment\"", "Decline to engage.", { nationalPerceptionDelta: -4, localPerceptionDelta: -2 }),
    ],
  };
}

// Media attention fades without a fresh story — national and local buzz
// drift back toward baseline each offseason if nothing kept them elevated
// (or depressed). Locker-room trust is stickier, since it's earned/lost
// through actual coaching rather than news cycles, so it drifts much slower.
export function driftPerception(current: number, baseline: number, rate: number): number {
  return Math.round(current + (baseline - current) * rate);
}

// Only ever called on a day the coach's team actually played — media shows up
// after games, not on off days. Scandal coverage is checked first and, if it
// fires, replaces the normal postgame write-up entirely for that day.
export function maybeGenerateMediaInterview(rng: () => number, ctx: MediaContext): GeneratedEvent | null {
  const scandalChance = ctx.legalityReputation < 70 ? (70 - ctx.legalityReputation) / 300 : 0;
  if (rng() < scandalChance) return generateScandal();

  const category = classify(ctx);
  let chance = baseInterviewChance(ctx.teamPrestige, ctx.division) + NEWSWORTHY_BONUS[category];
  if (ctx.isTournament) chance += 0.25;
  chance = clamp(chance, 0, 0.97);
  if (rng() > chance) return null;

  return generateForCategory(category, ctx);
}
