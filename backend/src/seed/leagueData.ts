import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Division } from "../types";

const DATA_DIR = path.join(__dirname, "..", "data");

export interface RawMember {
  school: string;
  state: string;
  prestigeTier: number; // 1-5
}

export interface RawConference {
  name: string;
  abbreviation: string;
  members: RawMember[];
}

export interface RawLeagueFile {
  conferences: RawConference[];
}

const FILE_BY_DIVISION: Record<Division, string> = {
  D1: "d1_conferences.json",
  D2: "d2_conferences.json",
  D3: "d3_conferences.json",
};

export function loadLeagueData(division: Division): RawLeagueFile {
  const filePath = path.join(DATA_DIR, FILE_BY_DIVISION[division]);
  if (!existsSync(filePath)) {
    throw new Error(`No league data seeded yet for ${division} (expected ${filePath})`);
  }
  const data: RawLeagueFile = JSON.parse(readFileSync(filePath, "utf-8"));
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
          `Duplicate school in ${FILE_BY_DIVISION[division]}: "${member.school}" appears in both "${prior}" and "${conf.name}"`
        );
      }
      seenIn.set(member.school, conf.name);
    }
  }
}

export function divisionDataAvailable(division: Division): boolean {
  return existsSync(path.join(DATA_DIR, FILE_BY_DIVISION[division]));
}

// Map a 1-5 scouting-style prestige tier onto our 1-100 internal prestige scale.
export function prestigeTierToScore(tier: number): number {
  const table: Record<number, number> = { 5: 92, 4: 78, 3: 60, 2: 42, 1: 25 };
  return table[tier] ?? 50;
}
