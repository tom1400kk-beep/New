// Plain in-memory mirror of the original Prisma schema — one save's whole
// world lives in a single WorldState object, persisted to IndexedDB as-is
// (structured clone supports Date natively, so no serialization needed).

export interface SaveGameRow {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  currentDate: Date;
  currentSeasonYear: number;
  currentPhase: string;
  coachTeamId: string | null;
}

export interface ConferenceRow {
  id: string;
  name: string;
  abbreviation: string;
  division: string;
}

export interface TeamRow {
  id: string;
  name: string;
  state: string;
  division: string;
  conferenceId: string;
  prestige: number;
  nilBudget: number;
  facilitiesRating: number;
  internationalScoutingRating: number;
  academicReputation: number;
  isPlayerControlled: boolean;
  headCoachId: string;
}

export interface CoachRow {
  id: string;
  name: string;
  isPlayerControlled: boolean;
  reputation: number;
  hotSeatLevel: number;
  offenseSkill: number;
  defenseSkill: number;
  recruitingSkill: number;
  developmentSkill: number;
  careerWins: number;
  careerLosses: number;
  yearsAtCurrentJob: number;
}

export interface AssistantCoachRow {
  id: string;
  teamId: string | null;
  name: string;
  role: string;
  rating: number;
  contractYears: number;
}

export interface PlayerRow {
  id: string;
  teamId: string | null;
  firstName: string;
  lastName: string;
  position: string;
  classYear: string;
  heightInches: number;
  hometownState: string;
  countryOfOrigin: string | null;
  origin: string;
  scoring: number;
  threePoint: number;
  finishing: number;
  playmaking: number;
  rebounding: number;
  defense: number;
  athleticism: number;
  basketballIq: number;
  stamina: number;
  potential: number;
  characterRating: number;
  chemistryImpact: number;
  eligibilityYearsLeft: number;
  inTransferPortal: boolean;
  isInjured: boolean;
  injuryWeeksLeft: number;
}

export interface ProspectRow {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  hometownState: string;
  countryOfOrigin: string | null;
  source: string;
  starRating: number;
  scoring: number;
  threePoint: number;
  finishing: number;
  playmaking: number;
  rebounding: number;
  defense: number;
  athleticism: number;
  basketballIq: number;
  potential: number;
  characterRating: number;
  scoutingNoise: number;
  graduationYear: number;
  signed: boolean;
  committedTeamId: string | null;
  prioritiesJson: string;
}

export interface RecruitInterestRow {
  id: string;
  prospectId: string;
  teamId: string;
  interestLevel: number;
  pointsInvested: number;
  offered: boolean;
  visitCompleted: boolean;
}

export interface SeasonRow {
  id: string;
  year: number;
}

export interface GameRow {
  id: string;
  seasonYear: number;
  date: Date;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  isPlayed: boolean;
  isConference: boolean;
  tournamentId: string | null;
  round: number | null;
  bracketSlot: number | null;
}

export interface PlayerGameStatRow {
  id: string;
  gameId: string;
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

export interface TournamentRow {
  id: string;
  seasonYear: number;
  type: string;
  division: string;
  conferenceId: string | null;
}

export interface GameEventRow {
  id: string;
  seasonYear: number;
  date: Date;
  type: string;
  title: string;
  description: string;
  teamId: string | null;
  playerId: string | null;
  status: string;
  optionsJson: string;
  chosenOptionId: string | null;
}

export interface WorldState {
  save: SaveGameRow;
  conferences: ConferenceRow[];
  teams: TeamRow[];
  coaches: CoachRow[];
  assistants: AssistantCoachRow[];
  players: PlayerRow[];
  prospects: ProspectRow[];
  interests: RecruitInterestRow[];
  seasons: SeasonRow[];
  games: GameRow[];
  stats: PlayerGameStatRow[];
  tournaments: TournamentRow[];
  events: GameEventRow[];
}

export function newId(): string {
  return crypto.randomUUID();
}
