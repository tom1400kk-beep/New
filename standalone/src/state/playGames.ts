import { simulateGame, type SimTeam, type SimPlayer } from "../engine/simulate";
import { computeAttendance } from "../engine/attendance";
import { homeCourtBonus } from "../engine/atmosphere";
import { sortedPair } from "../engine/rivalry";
import { mulberry32 } from "../engine/rng";
import type { Division } from "../types";
import { newId, type WorldState } from "./types";

export function playGames(state: WorldState, gameIds: string[]): void {
  if (gameIds.length === 0) return;
  const gameIdSet = new Set(gameIds);
  const games = state.games.filter((g) => gameIdSet.has(g.id));

  const teamIds = new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId]));
  const teamById = new Map(state.teams.filter((t) => teamIds.has(t.id)).map((t) => [t.id, t]));
  const coachById = new Map(state.coaches.map((c) => [c.id, c]));

  const playersByTeam = new Map<string, SimPlayer[]>();
  for (const p of state.players) {
    if (!p.teamId || !teamIds.has(p.teamId)) continue;
    if (!playersByTeam.has(p.teamId)) playersByTeam.set(p.teamId, []);
    playersByTeam.get(p.teamId)!.push({
      id: p.id, position: p.position, scoring: p.scoring, threePoint: p.threePoint, finishing: p.finishing,
      playmaking: p.playmaking, rebounding: p.rebounding, defense: p.defense, athleticism: p.athleticism,
      basketballIq: p.basketballIq, characterRating: p.characterRating, isInjured: p.isInjured,
      isSuspended: p.isSuspended,
    });
  }

  function filmStudyBonus(coach: { background: string | null } | undefined): number {
    return coach?.background === "ANALYTICS_COORDINATOR" ? 3 : 0;
  }

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
  const activeRivalries = state.rivalries.filter((r) => r.active && teamIds.has(r.teamAId) && teamIds.has(r.teamBId));
  const rivalryByPair = new Map(activeRivalries.map((r) => [`${r.teamAId}|${r.teamBId}`, r]));

  for (const g of games) {
    const homeTeam = teamById.get(g.homeTeamId);
    const awayTeam = teamById.get(g.awayTeamId);
    if (!homeTeam || !awayTeam) continue;
    const homeCoach = coachById.get(homeTeam.headCoachId);
    const awayCoach = coachById.get(awayTeam.headCoachId);
    const [pairA, pairB] = sortedPair(homeTeam.id, awayTeam.id);
    const rivalry = rivalryByPair.get(`${pairA}|${pairB}`);

    // A rocking home crowd is a genuine edge — the more atmosphere a program
    // has built, the tougher its building is to play in.
    const crowdBonus = homeCourtBonus(homeCoach?.campusAtmosphere ?? 40);
    const home: SimTeam = {
      id: homeTeam.id, players: playersByTeam.get(homeTeam.id) ?? [],
      offenseSkill: (homeCoach?.offenseSkill ?? 50) + filmStudyBonus(homeCoach) + crowdBonus,
      defenseSkill: (homeCoach?.defenseSkill ?? 50) + filmStudyBonus(homeCoach) + crowdBonus,
    };
    const away: SimTeam = {
      id: awayTeam.id, players: playersByTeam.get(awayTeam.id) ?? [],
      offenseSkill: (awayCoach?.offenseSkill ?? 50) + filmStudyBonus(awayCoach),
      defenseSkill: (awayCoach?.defenseSkill ?? 50) + filmStudyBonus(awayCoach),
    };

    const result = simulateGame(home, away);
    g.homeScore = result.homeScore;
    g.awayScore = result.awayScore;
    g.isPlayed = true;
    g.attendance = computeAttendance(rng, {
      capacity: homeTeam.venueCapacity,
      division: homeTeam.division as Division,
      homePrestige: homeTeam.prestige,
      awayPrestige: awayTeam.prestige,
      localPerception: homeCoach?.localPerception ?? 50,
      nationalPerception: homeCoach?.nationalPerception ?? 20,
      isConference: g.isConference,
      isTournament: g.tournamentId !== null,
      isRivalry: !!rivalry,
      rivalryIntensity: rivalry?.intensity,
    });

    for (const b of result.homeBox) state.stats.push({ id: newId(), gameId: g.id, ...b });
    for (const b of result.awayBox) state.stats.push({ id: newId(), gameId: g.id, ...b });
  }
}
