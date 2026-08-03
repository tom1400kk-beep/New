import { simulateGame, type SimTeam, type SimPlayer } from "../engine/simulate";
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

  for (const g of games) {
    const homeTeam = teamById.get(g.homeTeamId);
    const awayTeam = teamById.get(g.awayTeamId);
    if (!homeTeam || !awayTeam) continue;
    const homeCoach = coachById.get(homeTeam.headCoachId);
    const awayCoach = coachById.get(awayTeam.headCoachId);

    const home: SimTeam = {
      id: homeTeam.id, players: playersByTeam.get(homeTeam.id) ?? [],
      offenseSkill: (homeCoach?.offenseSkill ?? 50) + filmStudyBonus(homeCoach),
      defenseSkill: (homeCoach?.defenseSkill ?? 50) + filmStudyBonus(homeCoach),
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

    for (const b of result.homeBox) state.stats.push({ id: newId(), gameId: g.id, ...b });
    for (const b of result.awayBox) state.stats.push({ id: newId(), gameId: g.id, ...b });
  }
}
