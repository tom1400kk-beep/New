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
  city: string;
  division: string;
  conferenceId: string;
  prestige: number;
  nilBudget: number;
  facilitiesRating: number;
  internationalScoutingRating: number;
  academicReputation: number;
  baseSalary: number;
  venueCapacity: number;
  arenaUpgradeRequestedThisSeason: boolean;
  isPlayerControlled: boolean;
  headCoachId: string;
  athleticDirectorId: string;
  internationalTourCountry: string | null;
  internationalTourSeasonYear: number | null;
}

export interface InternationalTourRow {
  id: string;
  teamId: string;
  seasonYear: number;
  country: string;
  games: { opponentName: string; teamScore: number; opponentScore: number; win: boolean }[];
  createdAt: Date;
}

export interface AthleticDirectorRow {
  id: string;
  name: string;
  patience: number;
  winFocus: number;
  integrityStandard: number;
  loyalty: number;
  yearsAtCurrentJob: number;
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
  archetype: string;
  background: string | null;
  playedCollege: boolean;
  collegeTeamName: string | null;
  collegeState: string | null;
  proPath: string;
  proCountry: string | null;
  legalityReputation: number;
  hometownState: string | null;
  pipelineStatesJson: string;
  transferPipelineJson: string;
  adRelationshipsJson: string;
  currentSalary: number;
  raiseRequestedThisSeason: boolean;
  teamPerception: number;
  nationalPerception: number;
  localPerception: number;
  campusAtmosphere: number;
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
  hometownCity: string;
  highSchool: string;
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
  disciplineRating: number;
  chemistryImpact: number;
  eligibilityYearsLeft: number;
  inTransferPortal: boolean;
  previousSchool: string | null;
  prioritiesJson: string;
  isInjured: boolean;
  injuryWeeksLeft: number; // despite the name, this actually counts down in days
  injuryType: string | null;
  isSuspended: boolean;
  suspensionDaysLeft: number;
  onScholarship: boolean;
  droppedForDiscipline: boolean;
}

export interface TransferInterestRow {
  id: string;
  playerId: string;
  teamId: string;
  interestLevel: number;
  pointsInvested: number;
  offered: boolean;
}

export interface WalkOnCandidateRow {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  position: string;
  hometownState: string;
  hometownCity: string;
  countryOfOrigin: string | null;
  origin: string;
  source: string; // "LOCAL" | "REACHED_OUT"
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
  disciplineRating: number;
}

export interface ProspectRow {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  hometownState: string;
  hometownCity: string;
  highSchool: string;
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
  disciplineRating: number;
  scoutingNoise: number;
  graduationYear: number;
  signed: boolean;
  committedTeamId: string | null;
  prioritiesJson: string;
  playedEYBL: boolean;
  eyblTeam: string | null;
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
  attendance: number | null;
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
  teamId: string; // which side of the matchup this player represented in this specific game
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
  name: string | null; // human-readable event name/location, set only for PRESEASON_INVITATIONAL
  format: string | null; // InSeasonFormat, set only for D2/D3 PRESEASON_INVITATIONAL rows — disambiguates
                          // formats that share a field size (e.g. CLASSIC4 vs BRACKET4) for round-advancement logic
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

export interface RivalryRow {
  id: string;
  teamAId: string;
  teamBId: string;
  active: boolean;
  intensity: number;
  postseasonMeetings: number;
  origin: string;
  establishedYear: number;
}

// One row per coach per completed season — see backend schema comment on
// CoachSeasonRecord for why careerWins/careerLosses alone can't answer
// "stats per season" or "stats with a certain team".
export interface CoachSeasonRecordRow {
  id: string;
  coachId: string;
  teamId: string;
  seasonYear: number;
  wins: number;
  losses: number;
  confWins: number;
  confLosses: number;
  madePostseason: boolean;
  postseasonWins: number;
}

// A weekly (Monday) snapshot of a division's Top 25 — frozen between updates,
// unlike KenPom/RPI which are always computed live from current games.
export interface PollSnapshotRow {
  id: string;
  seasonYear: number;
  division: string;
  weekDate: Date;
  rankingsJson: string; // JSON array of {rank, teamId, wins, losses, score}
}

export interface WorldState {
  save: SaveGameRow;
  conferences: ConferenceRow[];
  teams: TeamRow[];
  coaches: CoachRow[];
  athleticDirectors: AthleticDirectorRow[];
  assistants: AssistantCoachRow[];
  players: PlayerRow[];
  prospects: ProspectRow[];
  interests: RecruitInterestRow[];
  transferInterests: TransferInterestRow[];
  seasons: SeasonRow[];
  games: GameRow[];
  stats: PlayerGameStatRow[];
  tournaments: TournamentRow[];
  events: GameEventRow[];
  rivalries: RivalryRow[];
  walkOnCandidates: WalkOnCandidateRow[];
  internationalTours: InternationalTourRow[];
  coachSeasonRecords: CoachSeasonRecordRow[];
  pollSnapshots: PollSnapshotRow[];
}

export function newId(): string {
  return crypto.randomUUID();
}
