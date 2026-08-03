-- CreateTable
CREATE TABLE "SaveGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "currentDate" DATETIME NOT NULL,
    "currentSeasonYear" INTEGER NOT NULL,
    "currentPhase" TEXT NOT NULL DEFAULT 'PRESEASON',
    "coachTeamId" TEXT
);

-- CreateTable
CREATE TABLE "Conference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    CONSTRAINT "Conference_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "prestige" INTEGER NOT NULL DEFAULT 50,
    "nilBudget" INTEGER NOT NULL DEFAULT 100000,
    "facilitiesRating" INTEGER NOT NULL DEFAULT 50,
    "isPlayerControlled" BOOLEAN NOT NULL DEFAULT false,
    "headCoachId" TEXT,
    CONSTRAINT "Team_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Team_headCoachId_fkey" FOREIGN KEY ("headCoachId") REFERENCES "Coach" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPlayerControlled" BOOLEAN NOT NULL DEFAULT false,
    "reputation" INTEGER NOT NULL DEFAULT 50,
    "hotSeatLevel" INTEGER NOT NULL DEFAULT 0,
    "offenseSkill" INTEGER NOT NULL DEFAULT 50,
    "defenseSkill" INTEGER NOT NULL DEFAULT 50,
    "recruitingSkill" INTEGER NOT NULL DEFAULT 50,
    "developmentSkill" INTEGER NOT NULL DEFAULT 50,
    "careerWins" INTEGER NOT NULL DEFAULT 0,
    "careerLosses" INTEGER NOT NULL DEFAULT 0,
    "yearsAtCurrentJob" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Coach_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssistantCoach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 50,
    "contractYears" INTEGER NOT NULL DEFAULT 2,
    CONSTRAINT "AssistantCoach_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssistantCoach_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "teamId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "classYear" TEXT NOT NULL,
    "heightInches" INTEGER NOT NULL,
    "hometownState" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'HIGH_SCHOOL',
    "scoring" INTEGER NOT NULL,
    "threePoint" INTEGER NOT NULL,
    "finishing" INTEGER NOT NULL,
    "playmaking" INTEGER NOT NULL,
    "rebounding" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "athleticism" INTEGER NOT NULL,
    "basketballIq" INTEGER NOT NULL,
    "stamina" INTEGER NOT NULL,
    "potential" INTEGER NOT NULL,
    "characterRating" INTEGER NOT NULL,
    "chemistryImpact" INTEGER NOT NULL DEFAULT 0,
    "eligibilityYearsLeft" INTEGER NOT NULL DEFAULT 4,
    "inTransferPortal" BOOLEAN NOT NULL DEFAULT false,
    "isInjured" BOOLEAN NOT NULL DEFAULT false,
    "injuryWeeksLeft" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Player_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "hometownState" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "starRating" INTEGER NOT NULL,
    "scoring" INTEGER NOT NULL,
    "threePoint" INTEGER NOT NULL,
    "finishing" INTEGER NOT NULL,
    "playmaking" INTEGER NOT NULL,
    "rebounding" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "athleticism" INTEGER NOT NULL,
    "basketballIq" INTEGER NOT NULL,
    "potential" INTEGER NOT NULL,
    "characterRating" INTEGER NOT NULL,
    "scoutingNoise" INTEGER NOT NULL DEFAULT 10,
    "graduationYear" INTEGER NOT NULL,
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "committedTeamId" TEXT,
    CONSTRAINT "Prospect_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecruitInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prospectId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "interestLevel" INTEGER NOT NULL DEFAULT 0,
    "pointsInvested" INTEGER NOT NULL DEFAULT 0,
    "offered" BOOLEAN NOT NULL DEFAULT false,
    "visitCompleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RecruitInterest_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecruitInterest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    CONSTRAINT "Season_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "isPlayed" BOOLEAN NOT NULL DEFAULT false,
    "isConference" BOOLEAN NOT NULL DEFAULT false,
    "tournamentId" TEXT,
    "round" INTEGER,
    CONSTRAINT "Game_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Game_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerGameStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "rebounds" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "steals" INTEGER NOT NULL,
    "blocks" INTEGER NOT NULL,
    "turnovers" INTEGER NOT NULL,
    "fgm" INTEGER NOT NULL,
    "fga" INTEGER NOT NULL,
    "threepm" INTEGER NOT NULL,
    "threepa" INTEGER NOT NULL,
    "ftm" INTEGER NOT NULL,
    "fta" INTEGER NOT NULL,
    CONSTRAINT "PlayerGameStat_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerGameStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "conferenceId" TEXT,
    CONSTRAINT "Tournament_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Tournament_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "teamId" TEXT,
    "playerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "optionsJson" TEXT NOT NULL,
    "chosenOptionId" TEXT,
    CONSTRAINT "GameEvent_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Conference_saveGameId_division_idx" ON "Conference"("saveGameId", "division");

-- CreateIndex
CREATE UNIQUE INDEX "Team_headCoachId_key" ON "Team"("headCoachId");

-- CreateIndex
CREATE INDEX "Team_saveGameId_division_idx" ON "Team"("saveGameId", "division");

-- CreateIndex
CREATE INDEX "Team_conferenceId_idx" ON "Team"("conferenceId");

-- CreateIndex
CREATE INDEX "Coach_saveGameId_idx" ON "Coach"("saveGameId");

-- CreateIndex
CREATE INDEX "AssistantCoach_saveGameId_teamId_idx" ON "AssistantCoach"("saveGameId", "teamId");

-- CreateIndex
CREATE INDEX "Player_saveGameId_teamId_idx" ON "Player"("saveGameId", "teamId");

-- CreateIndex
CREATE INDEX "Prospect_saveGameId_signed_graduationYear_idx" ON "Prospect"("saveGameId", "signed", "graduationYear");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitInterest_prospectId_teamId_key" ON "RecruitInterest"("prospectId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_saveGameId_year_key" ON "Season"("saveGameId", "year");

-- CreateIndex
CREATE INDEX "Game_saveGameId_seasonYear_idx" ON "Game"("saveGameId", "seasonYear");

-- CreateIndex
CREATE INDEX "Game_homeTeamId_idx" ON "Game"("homeTeamId");

-- CreateIndex
CREATE INDEX "Game_awayTeamId_idx" ON "Game"("awayTeamId");

-- CreateIndex
CREATE INDEX "PlayerGameStat_gameId_idx" ON "PlayerGameStat"("gameId");

-- CreateIndex
CREATE INDEX "PlayerGameStat_playerId_idx" ON "PlayerGameStat"("playerId");

-- CreateIndex
CREATE INDEX "Tournament_saveGameId_seasonYear_type_idx" ON "Tournament"("saveGameId", "seasonYear", "type");

-- CreateIndex
CREATE INDEX "GameEvent_saveGameId_status_idx" ON "GameEvent"("saveGameId", "status");
