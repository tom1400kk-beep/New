import { clamp } from "./rng";

export function computeTeamChemistry(players: { characterRating: number }[]): number {
  if (players.length === 0) return 60;
  const avg = players.reduce((s, p) => s + p.characterRating, 0) / players.length;
  const min = Math.min(...players.map((p) => p.characterRating));
  let chemistry = avg;
  if (min < 30) chemistry -= (30 - min) * 0.5;
  return clamp(chemistry, 10, 100);
}
