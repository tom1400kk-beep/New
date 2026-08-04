import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { PRESEASON_EVENTS } from "../engine/preseasonEvents";
import { assignTeamsToPreseasonEvents, type PreseasonTeamCandidate } from "../engine/preseasonAssignment";
import { buildBracket8FirstRound, buildBracket4FirstRound, buildPoolGames, type MTESeed } from "../engine/preseasonBracket";

const DAY_MS = 24 * 60 * 60 * 1000;
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

// Builds this season's slate of preseason multi-team events: assigns D1
// teams to fields, creates each event's Tournament row, and seeds its
// opening games (full pool slate for pool-play events; round 1 only for
// bracket events, since later rounds depend on who wins). Returns how many
// of those games count against each participating team's non-conference
// target, so the caller can size the rest of their non-conference slate
// around it instead of double-booking.
export interface PreseasonGenerationResult {
  gamesUsedByTeam: Map<string, number>;
  datesUsedByTeam: Map<string, Date[]>;
}

export async function generatePreseasonTournaments(
  saveGameId: string,
  seasonYear: number,
  d1Teams: PreseasonTeamCandidate[],
  nonConfWindowStart: Date,
  rng: () => number,
): Promise<PreseasonGenerationResult> {
  const gamesUsedByTeam = new Map<string, number>();
  const datesUsedByTeam = new Map<string, Date[]>();
  const trackDate = (teamId: string, date: Date) => {
    if (!datesUsedByTeam.has(teamId)) datesUsedByTeam.set(teamId, []);
    datesUsedByTeam.get(teamId)!.push(date);
  };
  const fields = assignTeamsToPreseasonEvents(rng, d1Teams);

  for (const event of PRESEASON_EVENTS) {
    const field = fields.get(event.key) ?? [];
    if (field.length < 2) continue;

    const tournamentId = randomUUID();
    await prisma.tournament.create({
      data: {
        id: tournamentId, saveGameId, seasonYear, type: "PRESEASON_INVITATIONAL",
        name: `${event.name} — ${event.location}`, division: "D1", conferenceId: null,
      },
    });

    for (const teamId of field) {
      gamesUsedByTeam.set(teamId, (gamesUsedByTeam.get(teamId) ?? 0) + event.gamesPerTeam);
    }

    const seeds: MTESeed[] = field.map((teamId, i) => ({ teamId, seed: i + 1 }));
    const baseDate = addDays(nonConfWindowStart, event.startOffsetDays);

    if (event.format === "BRACKET8" || event.format === "BRACKET4") {
      const round1 = event.format === "BRACKET8" ? buildBracket8FirstRound(seeds) : buildBracket4FirstRound(seeds);
      await prisma.game.createMany({
        data: round1.map((m) => ({
          id: randomUUID(), saveGameId, seasonYear, date: baseDate,
          homeTeamId: m.teamA, awayTeamId: m.teamB, isConference: false, isPlayed: false,
          tournamentId, round: 1, bracketSlot: m.slot,
        })),
      });
      // Later rounds' exact matchups aren't known yet (they depend on who
      // wins), but the whole field has the following 1-2 days committed
      // regardless of outcome — reserve them now so the non-conference
      // generator never books a plain game on top of them.
      const extraDays = event.format === "BRACKET8" ? [1, 2] : [1];
      for (const teamId of field) {
        trackDate(teamId, baseDate);
        for (const offset of extraDays) trackDate(teamId, addDays(baseDate, offset));
      }
    } else {
      const poolCount = event.format === "POOL8" ? 2 : 4;
      const poolGames = buildPoolGames(seeds, poolCount);
      await prisma.game.createMany({
        data: poolGames.map((g) => ({
          id: randomUUID(), saveGameId, seasonYear, date: addDays(baseDate, g.round),
          homeTeamId: g.teamA, awayTeamId: g.teamB, isConference: false, isPlayed: false,
          tournamentId, round: g.round + 1, bracketSlot: g.poolIndex,
        })),
      });
      for (const g of poolGames) {
        const date = addDays(baseDate, g.round);
        trackDate(g.teamA, date);
        trackDate(g.teamB, date);
      }
    }
  }

  return { gamesUsedByTeam, datesUsedByTeam };
}

// Called once per day: advances any in-progress bracket-format preseason
// event whose current round just finished (pool-play events never need
// this — their whole slate is generated up front).
export async function advancePreseasonBracketRounds(saveGameId: string, seasonYear: number, nextRoundDate: Date): Promise<void> {
  const { buildBracket8SecondRound, buildBracket8ThirdRound, buildBracket4SecondRound } = await import("../engine/preseasonBracket");

  const tournaments = await prisma.tournament.findMany({
    where: { saveGameId, seasonYear, type: "PRESEASON_INVITATIONAL" },
    include: { games: true },
  });

  for (const t of tournaments) {
    const fieldSize = new Set(t.games.flatMap((g) => [g.homeTeamId, g.awayTeamId])).size;
    if (fieldSize !== 8 && fieldSize !== 4) continue; // pool-play events have no rounds to advance

    const rounds = new Map<number, typeof t.games>();
    for (const g of t.games) {
      const r = g.round ?? 1;
      if (!rounds.has(r)) rounds.set(r, []);
      rounds.get(r)!.push(g);
    }
    const currentRound = Math.max(...[...rounds.keys()], 0);
    const currentGames = rounds.get(currentRound) ?? [];
    if (currentGames.length === 0 || !currentGames.every((g) => g.isPlayed)) continue;

    const maxRound = fieldSize === 8 ? 3 : 2;
    if (currentRound >= maxRound) continue;

    const results = currentGames.map((g) => ({
      slot: g.bracketSlot ?? 0,
      winnerTeamId: (g.homeScore ?? 0) > (g.awayScore ?? 0) ? g.homeTeamId : g.awayTeamId,
      loserTeamId: (g.homeScore ?? 0) > (g.awayScore ?? 0) ? g.awayTeamId : g.homeTeamId,
    }));

    const nextMatchups = fieldSize === 8
      ? (currentRound === 1 ? buildBracket8SecondRound(results) : buildBracket8ThirdRound(results))
      : buildBracket4SecondRound(results);

    if (nextMatchups.length > 0) {
      await prisma.game.createMany({
        data: nextMatchups.map((m) => ({
          id: randomUUID(), saveGameId, seasonYear, date: nextRoundDate,
          homeTeamId: m.teamA, awayTeamId: m.teamB, isConference: false, isPlayed: false,
          tournamentId: t.id, round: currentRound + 1, bracketSlot: m.slot,
        })),
      });
    }
  }
}
