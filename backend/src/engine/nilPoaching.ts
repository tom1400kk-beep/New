// A rival program's NIL collective goes after one of your rostered players
// mid-season — match their offer to keep him, or he transfers out immediately
// to whichever school made it. Distinct from the transfer portal: this is
// unsolicited tampering aimed at a player who hasn't entered the portal.

import { clamp } from "./rng";
import { overall, type SimPlayer } from "./simulate";
import type { GeneratedEvent } from "./events";

export interface NILRivalCandidate {
  teamId: string;
  teamName: string;
  prestige: number;
  nilBudget: number;
}

export interface NILPoachingContext {
  players: (SimPlayer & { firstName: string; lastName: string; onScholarship: boolean })[];
  rivals: NILRivalCandidate[];
}

// Rare enough that it reads as a real scare, not a weekly nuisance — this is
// checked only after the general event pool and media interview both miss
// for the day, so the effective frequency is lower still.
const BASE_FIRE_CHANCE = 0.05;

function weightedPick<T>(rng: () => number, items: { item: T; weight: number }[]): T | null {
  const total = items.reduce((s, w) => s + w.weight, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const w of items) {
    r -= w.weight;
    if (r <= 0) return w.item;
  }
  return items[items.length - 1].item;
}

export function maybeGenerateNILPoachingEvent(rng: () => number, ctx: NILPoachingContext): GeneratedEvent | null {
  const eligible = ctx.players.filter((p) => p.onScholarship && !p.isInjured && !p.isSuspended);
  if (eligible.length === 0 || ctx.rivals.length === 0) return null;
  if (rng() > BASE_FIRE_CHANCE) return null;

  // Best players draw the offers — a bench walk-on-adjacent guy isn't getting
  // tampered with.
  const playerWeights = eligible.map((p) => ({ item: p, weight: Math.max(1, overall(p) - 25) ** 1.5 }));
  const player = weightedPick(rng, playerWeights);
  if (!player) return null;

  // Richer, more prestigious programs do the poaching.
  const rivalWeights = ctx.rivals.map((r) => ({ item: r, weight: Math.max(1, r.nilBudget) * Math.max(1, r.prestige) }));
  const rival = weightedPick(rng, rivalWeights);
  if (!rival) return null;

  const quality = overall(player);
  const rawOffer = rival.nilBudget * (0.06 + (quality / 100) * 0.14) * (0.75 + rng() * 0.5);
  const offerAmount = Math.round(clamp(rawOffer, 5000, 350000) / 500) * 500;
  const formatted = `$${offerAmount.toLocaleString()}`;

  return {
    type: "NIL_POACHING",
    title: `${player.firstName} ${player.lastName} has an NIL offer from ${rival.teamName}`,
    description: `${rival.teamName}'s NIL collective has offered ${player.firstName} ${player.lastName} ${formatted} to transfer there. Match it to keep him, or he walks.`,
    playerId: player.id,
    options: [
      {
        id: "match",
        label: `Match the offer (${formatted})`,
        description: "Pay up to keep him in the program — pulls straight from your NIL budget.",
        effects: { nilBudgetDelta: -offerAmount, playerCharacterDelta: 3 },
      },
      {
        id: "let_go",
        label: "Let him go",
        description: `${player.firstName} ${player.lastName} transfers to ${rival.teamName} immediately.`,
        effects: { transferToTeamId: rival.teamId, chemistryDelta: -1 },
      },
    ],
  };
}
