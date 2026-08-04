// Procedurally generates D2/D3 in-season multi-team events each save — unlike
// D1's ~30 real named MTEs (a fixed curated list), there's no realistic way to
// hand-compile the ~150 events these two divisions actually host each year, so
// the shells themselves (format, size, timing, hosting) are generated fresh
// per save from the target distribution, then filled with real teams under a
// travel-realism constraint (participants cluster by region — these programs
// don't fly cross-country for a non-conference game) and a hard rule that no
// two teams sharing a conference are ever placed in the same field.

import { weightedPick } from "./rng";
import { regionForState, regionsInTravelRange, type TravelRegion } from "./travelRegions";

export type InSeasonFormat = "BRACKET4" | "CLASSIC4" | "CHALLENGE2" | "SHOWCASE6" | "BRACKET8" | "MEGA";
export type EventTiming = "TIP_OFF" | "THANKSGIVING" | "HOLIDAY";

export interface InSeasonCandidateTeam {
  id: string;
  name: string;
  state: string;
  prestige: number;
  conferenceId: string;
}

export interface InSeasonEventResult {
  format: InSeasonFormat;
  timing: EventTiming;
  teamIds: string[]; // CLASSIC4: [a1, a2, b1, b2] — sideA = [0,1], sideB = [2,3]
  hostTeamId: string | null; // null = neutral/destination site
  name: string;
  location: string;
  startOffsetDays: number;
  gamesPerTeam: number;
}

const GAMES_PER_TEAM: Record<InSeasonFormat, number> = {
  BRACKET4: 2, CLASSIC4: 2, CHALLENGE2: 1, SHOWCASE6: 2, BRACKET8: 3, MEGA: 3,
};

// Bigger/more prestigious formats get first pick of the best available teams,
// same idea as D1's tier-ordered greedy fill.
const FORMAT_PRIORITY: Record<InSeasonFormat, number> = {
  MEGA: 0, BRACKET8: 1, CLASSIC4: 2, BRACKET4: 2, SHOWCASE6: 3, CHALLENGE2: 4,
};

const REGION_LABELS: Record<TravelRegion, string> = {
  NORTHEAST: "Northeast", MID_ATLANTIC: "Mid-Atlantic", SOUTHEAST: "Southeast",
  MIDWEST: "Midwest", SOUTH_CENTRAL: "South Central", MOUNTAIN: "Mountain", PACIFIC: "Pacific",
};

const NAME_SUFFIX: Record<EventTiming, string[]> = {
  TIP_OFF: ["Tip-Off Classic", "Season-Opening Classic", "Tip-Off Showcase", "Opening Weekend Classic"],
  THANKSGIVING: ["Thanksgiving Classic", "Thanksgiving Showcase", "Turkey Tip-Off", "Thanksgiving Challenge"],
  HOLIDAY: ["Holiday Classic", "Holiday Showcase", "Winter Classic", "Holiday Invitational"],
};

// Split a total into exact per-bucket counts matching target percentages as
// closely as integers allow (largest-remainder method) — used where the
// spec's percentages divide the total cleanly and deserve exact adherence.
function exactCounts(total: number, weights: [string, number][]): Map<string, number> {
  const sum = weights.reduce((s, [, w]) => s + w, 0);
  const raw = weights.map(([label, w]) => ({ label, exact: (w / sum) * total }));
  const floors = raw.map((r) => ({ label: r.label, count: Math.floor(r.exact), remainder: r.exact - Math.floor(r.exact) }));
  let assigned = floors.reduce((s, f) => s + f.count, 0);
  const byRemainder = [...floors].sort((a, b) => b.remainder - a.remainder);
  let i = 0;
  while (assigned < total) {
    byRemainder[i % byRemainder.length].count++;
    assigned++;
    i++;
  }
  return new Map(floors.map((f) => [f.label, f.count]));
}

function offsetForTiming(timing: EventTiming, rng: () => number): number {
  if (timing === "TIP_OFF") return 3 + Math.floor(rng() * 10); // Nov 7 - Nov 16
  if (timing === "THANKSGIVING") return 22 + Math.floor(rng() * 6); // Nov 26 - Dec 1
  return 42 + Math.floor(rng() * 9); // Dec 16 - Dec 24, leaves room for multi-day formats before Dec 30
}

interface EventShell { format: InSeasonFormat; size: number; timing: EventTiming; startOffsetDays: number; }

function buildEventShells(division: "D2" | "D3", rng: () => number): EventShell[] {
  const shells: EventShell[] = [];
  if (division === "D2") {
    const sizeCounts = exactCounts(50, [
      ["FOUR", 65], ["CHALLENGE2", 15], ["SHOWCASE6", 10], ["BRACKET8", 8], ["MEGA", 2],
    ]);
    const timingWeights: [EventTiming, number][] = [["TIP_OFF", 45], ["THANKSGIVING", 30], ["HOLIDAY", 30]];
    const pushN = (format: InSeasonFormat, size: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const timing = weightedPick(rng, timingWeights.map(([item, weight]) => ({ item, weight })));
        shells.push({ format, size, timing, startOffsetDays: offsetForTiming(timing, rng) });
      }
    };
    const fourCount = sizeCounts.get("FOUR") ?? 0;
    for (let i = 0; i < fourCount; i++) {
      const format: InSeasonFormat = rng() < 0.5 ? "BRACKET4" : "CLASSIC4";
      const timing = weightedPick(rng, timingWeights.map(([item, weight]) => ({ item, weight })));
      shells.push({ format, size: 4, timing, startOffsetDays: offsetForTiming(timing, rng) });
    }
    pushN("CHALLENGE2", 2, sizeCounts.get("CHALLENGE2") ?? 0);
    pushN("SHOWCASE6", 6, sizeCounts.get("SHOWCASE6") ?? 0);
    pushN("BRACKET8", 8, sizeCounts.get("BRACKET8") ?? 0);
    pushN("MEGA", 12, sizeCounts.get("MEGA") ?? 0);
  } else {
    const timingCounts = exactCounts(100, [["TIP_OFF", 65], ["THANKSGIVING", 15], ["HOLIDAY", 20]]);
    for (const [timing, count] of timingCounts) {
      for (let i = 0; i < count; i++) {
        const format: InSeasonFormat = rng() < 0.5 ? "BRACKET4" : "CLASSIC4";
        shells.push({ format, size: 4, timing: timing as EventTiming, startOffsetDays: offsetForTiming(timing as EventTiming, rng) });
      }
    }
  }
  shells.sort((a, b) => FORMAT_PRIORITY[a.format] - FORMAT_PRIORITY[b.format]);
  return shells;
}

interface WorkingTeam extends InSeasonCandidateTeam {
  eventCount: number;
}

function priorityScore(t: WorkingTeam, rng: () => number): number {
  return -t.eventCount * 1000 + t.prestige + (rng() - 0.5) * 15;
}

function regionCandidates(pool: WorkingTeam[], region: TravelRegion, includeAdjacent: boolean, maxPerTeam: number): WorkingTeam[] {
  const inRange = new Set(includeAdjacent ? regionsInTravelRange(region) : [region]);
  return pool.filter((t) => t.eventCount < maxPerTeam && inRange.has(regionForState(t.state)));
}

// Tries the tightest travel radius first (same region only), widens to
// adjacent regions if the field can't be filled, and only reaches for the
// whole division as a last resort so events stay realistically local unless
// their size genuinely requires casting a wider net.
function fillField<T>(
  region: TravelRegion, pool: WorkingTeam[], attempt: (candidates: WorkingTeam[]) => T | null
): T | null {
  const strict = fillFrom(region, pool, false, attempt);
  if (strict) return strict;
  const adjacent = fillFrom(region, pool, true, attempt);
  if (adjacent) return adjacent;
  return attempt(pool.filter((t) => t.eventCount < MAX_EVENTS_PER_TEAM));
}

function fillFrom<T>(
  region: TravelRegion, pool: WorkingTeam[], includeAdjacent: boolean, attempt: (candidates: WorkingTeam[]) => T | null
): T | null {
  const candidates = regionCandidates(pool, region, includeAdjacent, MAX_EVENTS_PER_TEAM);
  return attempt(candidates);
}

function pickStandardField(size: number, pool: WorkingTeam[], rng: () => number): WorkingTeam[] | null {
  const sorted = [...pool].sort((a, b) => priorityScore(b, rng) - priorityScore(a, rng));
  const picked: WorkingTeam[] = [];
  const usedConferences = new Set<string>();
  for (const t of sorted) {
    if (picked.length >= size) break;
    if (usedConferences.has(t.conferenceId)) continue;
    picked.push(t);
    usedConferences.add(t.conferenceId);
  }
  return picked.length === size ? picked : null;
}

// CLASSIC4: two teams from one conference vs two teams from another — sides
// never play each other, so no conference-mate ever meets a conference-mate.
function pickClassic4Field(pool: WorkingTeam[], rng: () => number): { sideA: WorkingTeam[]; sideB: WorkingTeam[] } | null {
  const byConf = new Map<string, WorkingTeam[]>();
  for (const t of pool) {
    if (!byConf.has(t.conferenceId)) byConf.set(t.conferenceId, []);
    byConf.get(t.conferenceId)!.push(t);
  }
  const confsWithTwo = [...byConf.entries()].filter(([, list]) => list.length >= 2);
  if (confsWithTwo.length < 2) return null;
  confsWithTwo.forEach(([, list]) => list.sort((a, b) => priorityScore(b, rng) - priorityScore(a, rng)));
  confsWithTwo.sort((a, b) => priorityScore(b[1][0], rng) - priorityScore(a[1][0], rng));
  return { sideA: confsWithTwo[0][1].slice(0, 2), sideB: confsWithTwo[1][1].slice(0, 2) };
}

function nameEvent(
  shell: EventShell, field: WorkingTeam[], hostTeam: WorkingTeam | null, region: TravelRegion, rng: () => number
): { name: string; location: string } {
  const suffix = NAME_SUFFIX[shell.timing][Math.floor(rng() * NAME_SUFFIX[shell.timing].length)];
  if (hostTeam) {
    return { name: `${hostTeam.name} ${suffix}`, location: `Hosted by ${hostTeam.name}, ${hostTeam.state}` };
  }
  const repState = field[Math.floor(rng() * field.length)].state;
  return { name: `${REGION_LABELS[region]} ${suffix}`, location: `Neutral site (${repState})` };
}

const MAX_EVENTS_PER_TEAM = 2;

export function generateInSeasonEvents(
  division: "D2" | "D3", teams: InSeasonCandidateTeam[], rng: () => number
): InSeasonEventResult[] {
  const pool: WorkingTeam[] = teams.map((t) => ({ ...t, eventCount: 0 }));
  const shells = buildEventShells(division, rng);
  const results: InSeasonEventResult[] = [];

  for (const shell of shells) {
    const eligible = pool.filter((t) => t.eventCount < MAX_EVENTS_PER_TEAM);
    if (eligible.length === 0) continue;
    const seed = [...eligible].sort((a, b) => priorityScore(b, rng) - priorityScore(a, rng))[0];
    const region = regionForState(seed.state);

    const field = fillField(region, pool, (candidates) => {
      if (shell.format === "CLASSIC4") {
        const sides = pickClassic4Field(candidates, rng);
        return sides ? [...sides.sideA, ...sides.sideB] : null;
      }
      return pickStandardField(shell.size, candidates, rng);
    });
    if (!field) continue; // not enough compatible teams left anywhere — skip this shell

    for (const t of field) t.eventCount++;

    const hostChance = division === "D2" ? 0.7 : 0.92;
    const hostTeam = rng() < hostChance ? [...field].sort((a, b) => b.prestige - a.prestige)[0] : null;
    const { name, location } = nameEvent(shell, field, hostTeam, region, rng);

    results.push({
      format: shell.format, timing: shell.timing,
      teamIds: field.map((t) => t.id),
      hostTeamId: hostTeam?.id ?? null,
      name, location,
      startOffsetDays: shell.startOffsetDays,
      gamesPerTeam: GAMES_PER_TEAM[shell.format],
    });
  }
  return results;
}
