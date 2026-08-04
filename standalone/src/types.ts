export type Division = "D1" | "D2" | "D3";
export type SeasonPhase =
  | "PRESEASON"
  | "REGULAR_SEASON"
  | "CONFERENCE_TOURNAMENT"
  | "SELECTION"
  | "NCAA_TOURNAMENT"
  | "NIT"
  | "OFFSEASON";
export type AssistantRole = "RECRUITING" | "PLAYER_DEVELOPMENT" | "OFFENSE" | "DEFENSE";
export type PositionType = "PG" | "SG" | "SF" | "PF" | "C";
export type ClassYear = "FR" | "SO" | "JR" | "SR" | "GR";
export type PlayerOrigin = "HIGH_SCHOOL" | "JUCO" | "TRANSFER_PORTAL" | "INTERNATIONAL";
export type ProspectSource = "HIGH_SCHOOL" | "JUCO" | "INTERNATIONAL";
export type TournamentType =
  | "CONFERENCE_TOURNAMENT"
  | "NCAA_TOURNAMENT"
  | "NIT"
  | "D2_NATIONAL"
  | "D3_NATIONAL";
export type EventStatus = "PENDING" | "RESOLVED";

// Division-specific roster / scholarship rules — this is where D1 vs D2 vs D3
// realism actually lives (scholarships, roster caps), not just smaller numbers.
export const DIVISION_RULES: Record<
  Division,
  { scholarshipLimit: number; rosterCap: number; hasScholarships: boolean; hasNil: boolean }
> = {
  D1: { scholarshipLimit: 13, rosterCap: 15, hasScholarships: true, hasNil: true },
  D2: { scholarshipLimit: 10, rosterCap: 20, hasScholarships: true, hasNil: false },
  D3: { scholarshipLimit: 0, rosterCap: 20, hasScholarships: false, hasNil: false },
};
