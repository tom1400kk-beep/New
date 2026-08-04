import d1 from "../data/d1_conferences.json";
import d2 from "../data/d2_conferences.json";
import d3 from "../data/d3_conferences.json";
import type { Division } from "../types";

export interface RawMember {
  school: string;
  state: string;
  prestigeTier: number;
}

export interface RawConference {
  name: string;
  abbreviation: string;
  members: RawMember[];
}

export interface RawLeagueFile {
  conferences: RawConference[];
}

const FILES: Record<Division, RawLeagueFile> = {
  D1: d1 as RawLeagueFile,
  D2: d2 as RawLeagueFile,
  D3: d3 as RawLeagueFile,
};

export function loadLeagueData(division: Division): RawLeagueFile {
  const data = FILES[division];
  assertNoDuplicateSchools(division, data);
  return data;
}

// A school listed under two conferences would spawn two separate programs for the
// same real-world team once world creation runs — catch that at load time, not in-game.
function assertNoDuplicateSchools(division: Division, data: RawLeagueFile): void {
  const seenIn = new Map<string, string>();
  for (const conf of data.conferences) {
    for (const member of conf.members) {
      const prior = seenIn.get(member.school);
      if (prior) {
        throw new Error(
          `Duplicate school in ${division} league data: "${member.school}" appears in both "${prior}" and "${conf.name}"`
        );
      }
      seenIn.set(member.school, conf.name);
    }
  }
}

export function prestigeTierToScore(tier: number): number {
  const table: Record<number, number> = { 5: 92, 4: 78, 3: 60, 2: 42, 1: 25 };
  return table[tier] ?? 50;
}
