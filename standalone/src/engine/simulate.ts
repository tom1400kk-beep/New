import { clamp, randInt, randNormal } from "./rng";
import { computeTeamChemistry } from "./chemistry";

export interface SimPlayer {
  id: string;
  position: string;
  scoring: number;
  threePoint: number;
  finishing: number;
  playmaking: number;
  rebounding: number;
  defense: number;
  athleticism: number;
  basketballIq: number;
  characterRating: number;
  isInjured: boolean;
  isSuspended: boolean;
}

export interface SimTeam {
  id: string;
  players: SimPlayer[];
  offenseSkill: number; // coach modifier, 1-100
  defenseSkill: number; // coach modifier, 1-100
  depthChartOrder?: (string | null)[]; // user lineup preference, see engine/depthChart.ts; undefined/all-empty = auto
}

export interface PlayerBoxScore {
  playerId: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  threepm: number;
  threepa: number;
  ftm: number;
  fta: number;
}

export interface GameResult {
  homeScore: number;
  awayScore: number;
  homeBox: PlayerBoxScore[];
  awayBox: PlayerBoxScore[];
}

export function overall(p: SimPlayer): number {
  return (
    p.scoring * 0.2 +
    p.threePoint * 0.12 +
    p.finishing * 0.13 +
    p.playmaking * 0.15 +
    p.rebounding * 0.15 +
    p.defense * 0.15 +
    p.athleticism * 0.1
  );
}

// Top 8-9 available (non-injured) players form the rotation; minutes taper off the bench.
const MINUTES_CURVE = [34, 32, 30, 28, 24, 18, 14, 10, 10];

// depthChartOrder (see engine/depthChart.ts) is an optional user lineup
// preference: named players fill the front of the rotation in that order
// (skipping anyone injured/suspended/unlisted), and any remaining slots up
// to 9 are backfilled with the best available players by overall — exactly
// the auto behavior below, so a partial or empty depth chart degrades
// gracefully rather than fielding fewer than 9 players.
export function buildRotation(players: SimPlayer[], depthChartOrder?: (string | null)[]): { player: SimPlayer; minutes: number }[] {
  const available = players.filter((p) => !p.isInjured && !p.isSuspended);
  const byId = new Map(available.map((p) => [p.id, p]));

  const chosen: SimPlayer[] = [];
  const usedIds = new Set<string>();
  if (depthChartOrder) {
    for (const id of depthChartOrder) {
      if (!id || usedIds.has(id)) continue;
      const p = byId.get(id);
      if (p) {
        chosen.push(p);
        usedIds.add(id);
      }
    }
  }

  const remaining = available.filter((p) => !usedIds.has(p.id)).sort((a, b) => overall(b) - overall(a));
  const rotationSize = Math.min(9, available.length);
  while (chosen.length < rotationSize && remaining.length > 0) {
    chosen.push(remaining.shift()!);
  }

  return chosen.map((player, i) => ({ player, minutes: MINUTES_CURVE[i] ?? 6 }));
}

interface TeamProfile {
  offenseRating: number; // points per 100 possessions contribution
  defenseRating: number;
  chemistry: number; // 0-100
  rotation: { player: SimPlayer; minutes: number }[];
}

function profileTeam(team: SimTeam): TeamProfile {
  const rotation = buildRotation(team.players, team.depthChartOrder);
  const totalMinutes = rotation.reduce((s, r) => s + r.minutes, 0) || 1;

  let offense = 0;
  let defense = 0;
  for (const { player, minutes } of rotation) {
    const w = minutes / totalMinutes;
    offense += w * (player.scoring * 0.35 + player.threePoint * 0.2 + player.finishing * 0.2 + player.playmaking * 0.15 + player.basketballIq * 0.1);
    defense += w * (player.defense * 0.5 + player.athleticism * 0.25 + player.basketballIq * 0.15 + player.rebounding * 0.1);
  }
  const chemistry = computeTeamChemistry(rotation.map((r) => r.player));

  offense += (team.offenseSkill - 50) * 0.1;
  defense += (team.defenseSkill - 50) * 0.1;

  const chemistryMultiplier = 0.92 + (chemistry / 100) * 0.16;
  offense *= chemistryMultiplier;

  return { offenseRating: offense, defenseRating: defense, chemistry, rotation };
}

function pointsPer100(offense: number, defense: number): number {
  return clamp(100 + (offense - defense) / 1.6, 78, 132);
}

function statlineForPlayer(
  player: SimPlayer,
  minutes: number,
  teamPoints: number,
  usageShare: number,
): PlayerBoxScore {
  const points = Math.max(0, Math.round(teamPoints * usageShare + randNormal(Math.random, 0, 2)));

  const threeShare = clamp(0.22 + (player.threePoint - 50) / 200, 0.1, 0.55);
  const ptsFrom3 = Math.round(points * threeShare);
  const threepm = Math.round(ptsFrom3 / 3);
  const threePct = clamp(0.28 + (player.threePoint / 100) * 0.24, 0.24, 0.48);
  const threepa = threepm > 0 ? Math.round(threepm / threePct) : Math.random() < 0.3 ? randInt(Math.random, 0, 2) : 0;

  let remaining = points - threepm * 3;
  const ftShare = clamp(0.16 + player.athleticism / 500, 0.08, 0.3);
  const ftm = Math.max(0, Math.round(remaining * ftShare));
  const ftPct = clamp(0.62 + (player.basketballIq / 100) * 0.28, 0.55, 0.92);
  const fta = ftm > 0 ? Math.round(ftm / ftPct) : 0;

  remaining = Math.max(0, remaining - ftm);
  const fgm2 = Math.round(remaining / 2);
  const fg2Pct = clamp(0.38 + (player.finishing / 100) * 0.24, 0.34, 0.66);
  const fga2 = fgm2 > 0 ? Math.round(fgm2 / fg2Pct) : 0;

  const fgm = fgm2 + threepm;
  const fga = fga2 + threepa;
  // Derive the final point total directly from the box-score components so
  // points always exactly matches makes (2s + 3s + free throws), not the noisy target.
  const finalPoints = threepm * 3 + fgm2 * 2 + ftm;

  const minutesFactor = minutes / 32;
  const isBig = player.rebounding > 55 && player.finishing >= player.threePoint;

  const rebounds = Math.max(0, Math.round((player.rebounding / 100) * minutesFactor * (isBig ? 9.5 : 4.5) + randNormal(Math.random, 0, 1.2)));
  const assists = Math.max(0, Math.round((player.playmaking / 100) * minutesFactor * 5.5 + randNormal(Math.random, 0, 1)));
  const steals = Math.max(0, Math.round((player.defense / 100) * minutesFactor * 2 + randNormal(Math.random, 0, 0.6)));
  const blocks = Math.max(0, Math.round(((player.athleticism + player.defense) / 200) * minutesFactor * (isBig ? 2.6 : 0.5) + randNormal(Math.random, 0, 0.4)));
  const turnovers = Math.max(0, Math.round(usageShare * 14 - (player.playmaking / 100) * 3 + randNormal(Math.random, 0, 0.8)));

  return {
    playerId: player.id,
    minutes: Math.round(minutes),
    points: finalPoints,
    rebounds,
    assists,
    steals,
    blocks,
    turnovers,
    fgm,
    fga: Math.max(fga, fgm),
    threepm,
    threepa: Math.max(threepa, threepm),
    ftm,
    fta: Math.max(fta, ftm),
  };
}

function simulateTeamBox(profile: TeamProfile, teamPoints: number): PlayerBoxScore[] {
  const totalMinutes = profile.rotation.reduce((s, r) => s + r.minutes, 0) || 1;
  const usageRaw = profile.rotation.map(({ player, minutes }) => {
    const weight = (minutes / totalMinutes) * (0.5 + player.scoring / 100);
    return weight;
  });
  const usageTotal = usageRaw.reduce((a, b) => a + b, 0) || 1;

  const box = profile.rotation.map(({ player, minutes }, i) =>
    statlineForPlayer(player, minutes, teamPoints, usageRaw[i] / usageTotal),
  );

  // Reconcile so player points sum to the team total (last player absorbs rounding drift).
  const sum = box.reduce((s, b) => s + b.points, 0);
  const diff = teamPoints - sum;
  if (box.length > 0 && diff !== 0) {
    box[0].points = Math.max(0, box[0].points + diff);
  }

  return box;
}

export function simulateGame(home: SimTeam, away: SimTeam, homeCourtAdvantage = 3): GameResult {
  const homeProfile = profileTeam(home);
  const awayProfile = profileTeam(away);

  const paceBase = randInt(Math.random, 64, 74);

  const homePPP100 = pointsPer100(homeProfile.offenseRating + homeCourtAdvantage, awayProfile.defenseRating);
  const awayPPP100 = pointsPer100(awayProfile.offenseRating, homeProfile.defenseRating + homeCourtAdvantage * 0.4);

  let homeScore = Math.round((homePPP100 / 100) * paceBase + randNormal(Math.random, 0, 4));
  let awayScore = Math.round((awayPPP100 / 100) * paceBase + randNormal(Math.random, 0, 4));

  homeScore = clamp(homeScore, 35, 130);
  awayScore = clamp(awayScore, 35, 130);

  // No ties in basketball — if regulation math ties, simulate a short OT bump.
  if (homeScore === awayScore) {
    if (Math.random() < 0.5) homeScore += randInt(Math.random, 2, 6);
    else awayScore += randInt(Math.random, 2, 6);
  }

  const homeBox = simulateTeamBox(homeProfile, homeScore);
  const awayBox = simulateTeamBox(awayProfile, awayScore);

  return { homeScore, awayScore, homeBox, awayBox };
}
