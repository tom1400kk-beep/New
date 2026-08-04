// Real-world D1 non-conference multi-team events (MTEs) — the early-season
// showcase tournaments that dominate the November/December schedule.
// Restricted to D1 (matches reality: these are exclusively high-major/mid-major
// invite events, never D2/D3). "prestigeTier" drives which caliber of program
// gets invited: MAJOR events skew toward blue-bloods and top-25 types, MID
// toward solid at-large/mid-major names, SMALL toward mid/low-majors.

export type PreseasonFormat = "BRACKET8" | "BRACKET4" | "POOL8" | "POOL16";
export type PreseasonTier = "MAJOR" | "MID" | "SMALL";

export interface PreseasonEventDef {
  key: string;
  name: string;
  location: string; // city, state/country — flavor text
  format: PreseasonFormat;
  fieldSize: number;
  gamesPerTeam: number;
  tier: PreseasonTier;
  // Days into the non-conference window (0 = season's non-conference start)
  // this event's first-round games are played — most cluster around
  // Thanksgiving week, a few sit at their real-world late-December slot.
  startOffsetDays: number;
}

export const PRESEASON_EVENTS: PreseasonEventDef[] = [
  { key: "MAUI", name: "Maui Invitational", location: "Lahaina, HI", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MAJOR", startOffsetDays: 16 },
  { key: "BATTLE4ATLANTIS", name: "Battle 4 Atlantis", location: "Nassau, Bahamas", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MAJOR", startOffsetDays: 16 },
  { key: "NIT_TIPOFF", name: "NIT Season Tip-Off", location: "New York, NY", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MAJOR", startOffsetDays: 16 },
  { key: "PLAYERS_ERA", name: "Players Era Festival", location: "Las Vegas, NV", format: "POOL16", fieldSize: 16, gamesPerTeam: 3, tier: "MAJOR", startOffsetDays: 15 },
  { key: "GREAT_ALASKA", name: "Great Alaska Shootout", location: "Anchorage, AK", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MID", startOffsetDays: 12 },
  { key: "CHARLESTON_CLASSIC", name: "Charleston Classic", location: "Charleston, SC", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MID", startOffsetDays: 16 },
  { key: "LEGENDS_CLASSIC", name: "Legends Classic", location: "Brooklyn, NY", format: "BRACKET4", fieldSize: 4, gamesPerTeam: 2, tier: "MID", startOffsetDays: 16 },
  { key: "CANCUN_CHALLENGE", name: "Cancun Challenge", location: "Cancun, Mexico", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MID", startOffsetDays: 16 },
  { key: "DIAMOND_HEAD", name: "Diamond Head Classic", location: "Honolulu, HI", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MID", startOffsetDays: 49 },
  { key: "PARADISE_JAM", name: "Paradise Jam", location: "US Virgin Islands", format: "POOL8", fieldSize: 8, gamesPerTeam: 3, tier: "MID", startOffsetDays: 16 },
  { key: "ESPN_EVENTS_INV", name: "ESPN Events Invitational", location: "Orlando, FL", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MID", startOffsetDays: 16 },
  { key: "FORT_MYERS_TIPOFF", name: "Fort Myers Tip-Off", location: "Fort Myers, FL", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MID", startOffsetDays: 16 },
  { key: "RADY_INVITATIONAL", name: "Rady Children's Invitational", location: "San Diego, CA", format: "BRACKET4", fieldSize: 4, gamesPerTeam: 2, tier: "SMALL", startOffsetDays: 16 },
  { key: "MAIN_EVENT", name: "Continental Tire Main Event", location: "Sioux Falls, SD", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MID", startOffsetDays: 16 },
  { key: "EMPIRE_CLASSIC", name: "Empire Classic", location: "New York, NY", format: "BRACKET4", fieldSize: 4, gamesPerTeam: 2, tier: "MID", startOffsetDays: 16 },
  { key: "GULF_COAST_SHOWCASE", name: "Gulf Coast Showcase", location: "Estero, FL", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "SMALL", startOffsetDays: 16 },
  { key: "BAHA_MAR", name: "Baha Mar Hoops Nassau Championship", location: "Nassau, Bahamas", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MID", startOffsetDays: 16 },
  { key: "HOF_TIPOFF", name: "Hall of Fame Tip-Off", location: "Uncasville, CT", format: "BRACKET4", fieldSize: 4, gamesPerTeam: 2, tier: "MID", startOffsetDays: 9 },
  { key: "VEGAS_SHOWDOWN", name: "Vegas Showdown", location: "Las Vegas, NV", format: "BRACKET4", fieldSize: 4, gamesPerTeam: 2, tier: "SMALL", startOffsetDays: 9 },
  { key: "ACRISURE_HOLIDAY_INV", name: "Acrisure Holiday Invitational", location: "Las Vegas, NV", format: "BRACKET4", fieldSize: 4, gamesPerTeam: 2, tier: "MID", startOffsetDays: 54 },
  { key: "CAYMAN_CLASSIC", name: "Cayman Islands Classic", location: "Grand Cayman, Cayman Islands", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "SMALL", startOffsetDays: 16 },
  { key: "MYRTLE_BEACH_INV", name: "Myrtle Beach Invitational", location: "Myrtle Beach, SC", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "SMALL", startOffsetDays: 16 },
  { key: "VANCOUVER_SHOWCASE", name: "Vancouver Showcase", location: "Vancouver, BC, Canada", format: "BRACKET4", fieldSize: 4, gamesPerTeam: 2, tier: "SMALL", startOffsetDays: 9 },
  { key: "WOODEN_LEGACY", name: "Wooden Legacy", location: "Anaheim, CA", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "MID", startOffsetDays: 16 },
  { key: "SUNSHINE_SLAM", name: "Sunshine Slam", location: "Kissimmee, FL", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "SMALL", startOffsetDays: 16 },
  { key: "CROSSOVER_CLASSIC", name: "Bad Boy Mowers Crossover Classic", location: "Sioux Falls, SD", format: "BRACKET4", fieldSize: 4, gamesPerTeam: 2, tier: "SMALL", startOffsetDays: 9 },
  { key: "JAMAICA_CLASSIC", name: "Jamaica Classic", location: "Montego Bay, Jamaica", format: "BRACKET4", fieldSize: 4, gamesPerTeam: 2, tier: "SMALL", startOffsetDays: 16 },
  { key: "SAN_JUAN_SHOOTOUT", name: "San Juan Shootout", location: "San Juan, Puerto Rico", format: "BRACKET8", fieldSize: 8, gamesPerTeam: 3, tier: "SMALL", startOffsetDays: 16 },
  { key: "ASHEVILLE_CHAMPIONSHIP", name: "Asheville Championship", location: "Asheville, NC", format: "BRACKET4", fieldSize: 4, gamesPerTeam: 2, tier: "SMALL", startOffsetDays: 16 },
  { key: "OCEAN_STATE_CLASSIC", name: "Ocean State Classic", location: "Providence, RI", format: "BRACKET4", fieldSize: 4, gamesPerTeam: 2, tier: "SMALL", startOffsetDays: 9 },
];
