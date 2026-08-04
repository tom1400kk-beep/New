import type { Division } from "../types";
import { randInt } from "./rng";

export interface ScheduleTeam {
  id: string;
  conferenceId: string;
}

export interface ScheduledGame {
  homeTeamId: string;
  awayTeamId: string;
  isConference: boolean;
  date: Date;
}

const TARGET_GAMES: Record<Division, { total: number; conferenceTarget: number }> = {
  D1: { total: 30, conferenceTarget: 18 },
  D2: { total: 26, conferenceTarget: 18 },
  D3: { total: 25, conferenceTarget: 16 },
};

interface Pairing {
  a: string;
  b: string;
  conference: boolean;
}

function roundRobinPairs(teamIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]]);
    }
  }
  return pairs;
}

function buildConferencePairings(teams: ScheduleTeam[], conferenceTarget: number, rng: () => number): Pairing[] {
  const byConf = new Map<string, string[]>();
  for (const t of teams) {
    if (!byConf.has(t.conferenceId)) byConf.set(t.conferenceId, []);
    byConf.get(t.conferenceId)!.push(t.id);
  }

  const pairings: Pairing[] = [];
  for (const [, teamIds] of byConf) {
    if (teamIds.length < 2) continue;
    const single = roundRobinPairs(teamIds);
    const perTeamSingle = teamIds.length - 1;

    // Always play everyone once. Repeat the round robin (extra home/away legs)
    // until each team is near its conference-game target.
    let rounds = [single];
    let perTeamCount = perTeamSingle;
    while (perTeamCount + perTeamSingle <= conferenceTarget + 2) {
      rounds.push(single);
      perTeamCount += perTeamSingle;
    }

    for (const round of rounds) {
      for (const [a, b] of round) {
        pairings.push({ a, b, conference: true });
      }
    }
  }
  return pairings;
}

function buildNonConferencePairings(
  teams: ScheduleTeam[],
  gamesNeededPerTeam: Map<string, number>,
  rng: () => number,
): Pairing[] {
  const pairings: Pairing[] = [];
  const pool = [...teams];
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const remaining = new Map(gamesNeededPerTeam);
  let guard = 0;
  const maxGuard = teams.length * 10;

  while (guard++ < maxGuard) {
    const needy = pool.filter((t) => (remaining.get(t.id) ?? 0) > 0);
    if (needy.length < 2) break;
    const a = needy[Math.floor(rng() * needy.length)];
    let attempts = 0;
    let b = needy[Math.floor(rng() * needy.length)];
    while ((b.id === a.id || b.conferenceId === a.conferenceId) && attempts < 20) {
      b = needy[Math.floor(rng() * needy.length)];
      attempts++;
    }
    if (b.id === a.id) continue;

    pairings.push({ a: a.id, b: b.id, conference: false });
    remaining.set(a.id, (remaining.get(a.id) ?? 0) - 1);
    remaining.set(b.id, (remaining.get(b.id) ?? 0) - 1);
  }

  return pairings;
}

// Greedy date assignment: walk through candidate game days, assign each
// pairing to the earliest day where neither team is already booked.
// `initialBusy` seeds the per-team day-index set so dates already claimed
// elsewhere (e.g. a preseason multi-team event) never get double-booked.
function assignDates(pairings: Pairing[], seasonStart: Date, seasonEnd: Date, rng: () => number, initialBusy?: Map<string, Set<number>>): ScheduledGame[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const days: Date[] = [];
  for (let t = seasonStart.getTime(); t <= seasonEnd.getTime(); t += dayMs) {
    days.push(new Date(t));
  }

  // Shuffle pairing order so scheduling isn't biased by conference generation order.
  const shuffled = [...pairings];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const busy = initialBusy ?? new Map<string, Set<number>>(); // teamId -> set of day indices
  const games: ScheduledGame[] = [];

  for (const pairing of shuffled) {
    const homeFirst = rng() < 0.5;
    const home = homeFirst ? pairing.a : pairing.b;
    const away = homeFirst ? pairing.b : pairing.a;

    if (!busy.has(home)) busy.set(home, new Set());
    if (!busy.has(away)) busy.set(away, new Set());

    // start from a random offset so games spread across the season rather than clumping early
    const startIdx = Math.floor(rng() * days.length);
    let placed = false;
    for (let offset = 0; offset < days.length && !placed; offset++) {
      const idx = (startIdx + offset) % days.length;
      if (!busy.get(home)!.has(idx) && !busy.get(away)!.has(idx)) {
        busy.get(home)!.add(idx);
        busy.get(away)!.add(idx);
        // block the following day too so nobody plays back-to-back-to-back excessively
        games.push({ homeTeamId: home, awayTeamId: away, isConference: pairing.conference, date: days[idx] });
        placed = true;
      }
    }
    if (!placed) {
      // season is full for both teams — assign to a random day anyway rather than dropping the game
      const idx = Math.floor(rng() * days.length);
      games.push({ homeTeamId: home, awayTeamId: away, isConference: pairing.conference, date: days[idx] });
    }
  }

  return games.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export interface PreseasonScheduleInfo {
  gamesUsedByTeam: Map<string, number>; // non-conference games already spoken for by an MTE
  datesUsedByTeam: Map<string, Date[]>; // exact dates those games landed on
}

export function generateSeasonSchedule(
  teams: ScheduleTeam[],
  division: Division,
  seasonYear: number,
  rng: () => number,
  preseason?: PreseasonScheduleInfo,
): ScheduledGame[] {
  const { total, conferenceTarget } = TARGET_GAMES[division];

  const confPairings = buildConferencePairings(teams, conferenceTarget, rng);

  const confCountPerTeam = new Map<string, number>();
  for (const t of teams) confCountPerTeam.set(t.id, 0);
  for (const p of confPairings) {
    confCountPerTeam.set(p.a, (confCountPerTeam.get(p.a) ?? 0) + 1);
    confCountPerTeam.set(p.b, (confCountPerTeam.get(p.b) ?? 0) + 1);
  }

  const nonConfNeeded = new Map<string, number>();
  for (const t of teams) {
    const played = confCountPerTeam.get(t.id) ?? 0;
    const preseasonGames = preseason?.gamesUsedByTeam.get(t.id) ?? 0;
    nonConfNeeded.set(t.id, Math.max(0, total - played - preseasonGames));
  }

  const nonConfPairings = buildNonConferencePairings(teams, nonConfNeeded, rng);

  // Mirrors the real college calendar: non-conference play happens first
  // (November into late December), then conference play takes over for the
  // rest of the season, rather than the two interleaving randomly.
  const seasonStart = new Date(Date.UTC(seasonYear, 10, 4)); // Nov 4
  const nonConfEnd = new Date(Date.UTC(seasonYear, 11, 30)); // Dec 30
  const confStart = new Date(Date.UTC(seasonYear, 11, 31)); // Dec 31
  const seasonEnd = new Date(Date.UTC(seasonYear + 1, 1, 28)); // Feb 28

  let nonConfBusy: Map<string, Set<number>> | undefined;
  if (preseason) {
    const dayMs = 24 * 60 * 60 * 1000;
    nonConfBusy = new Map();
    for (const [teamId, dates] of preseason.datesUsedByTeam) {
      const set = new Set<number>();
      for (const d of dates) {
        const idx = Math.round((d.getTime() - seasonStart.getTime()) / dayMs);
        if (idx >= 0) set.add(idx);
      }
      nonConfBusy.set(teamId, set);
    }
  }

  const nonConfGames = assignDates(nonConfPairings, seasonStart, nonConfEnd, rng, nonConfBusy);
  const confGames = assignDates(confPairings, confStart, seasonEnd, rng);

  return [...nonConfGames, ...confGames].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function randomSeasonRng(seedBase: number) {
  return () => {
    seedBase = (seedBase * 9301 + 49297) % 233280;
    return seedBase / 233280;
  };
}

export const _internal = { randInt };
