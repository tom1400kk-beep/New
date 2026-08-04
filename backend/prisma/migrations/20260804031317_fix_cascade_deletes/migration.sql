-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AssistantCoach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 50,
    "contractYears" INTEGER NOT NULL DEFAULT 2,
    CONSTRAINT "AssistantCoach_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssistantCoach_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AssistantCoach" ("contractYears", "id", "name", "rating", "role", "saveGameId", "teamId") SELECT "contractYears", "id", "name", "rating", "role", "saveGameId", "teamId" FROM "AssistantCoach";
DROP TABLE "AssistantCoach";
ALTER TABLE "new_AssistantCoach" RENAME TO "AssistantCoach";
CREATE INDEX "AssistantCoach_saveGameId_teamId_idx" ON "AssistantCoach"("saveGameId", "teamId");
CREATE TABLE "new_Game" (
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
    "attendance" INTEGER,
    "tournamentId" TEXT,
    "round" INTEGER,
    "bracketSlot" INTEGER,
    CONSTRAINT "Game_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Game_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Game" ("attendance", "awayScore", "awayTeamId", "bracketSlot", "date", "homeScore", "homeTeamId", "id", "isConference", "isPlayed", "round", "saveGameId", "seasonYear", "tournamentId") SELECT "attendance", "awayScore", "awayTeamId", "bracketSlot", "date", "homeScore", "homeTeamId", "id", "isConference", "isPlayed", "round", "saveGameId", "seasonYear", "tournamentId" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE INDEX "Game_saveGameId_seasonYear_idx" ON "Game"("saveGameId", "seasonYear");
CREATE INDEX "Game_homeTeamId_idx" ON "Game"("homeTeamId");
CREATE INDEX "Game_awayTeamId_idx" ON "Game"("awayTeamId");
CREATE TABLE "new_Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "teamId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "classYear" TEXT NOT NULL,
    "heightInches" INTEGER NOT NULL,
    "hometownState" TEXT NOT NULL,
    "hometownCity" TEXT NOT NULL DEFAULT '',
    "countryOfOrigin" TEXT,
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
    "disciplineRating" INTEGER NOT NULL DEFAULT 65,
    "chemistryImpact" INTEGER NOT NULL DEFAULT 0,
    "eligibilityYearsLeft" INTEGER NOT NULL DEFAULT 4,
    "inTransferPortal" BOOLEAN NOT NULL DEFAULT false,
    "previousSchool" TEXT,
    "prioritiesJson" TEXT NOT NULL DEFAULT '{}',
    "isInjured" BOOLEAN NOT NULL DEFAULT false,
    "injuryWeeksLeft" INTEGER NOT NULL DEFAULT 0,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspensionDaysLeft" INTEGER NOT NULL DEFAULT 0,
    "onScholarship" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Player_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("athleticism", "basketballIq", "characterRating", "chemistryImpact", "classYear", "countryOfOrigin", "defense", "disciplineRating", "eligibilityYearsLeft", "finishing", "firstName", "heightInches", "hometownCity", "hometownState", "id", "inTransferPortal", "injuryWeeksLeft", "isInjured", "isSuspended", "lastName", "onScholarship", "origin", "playmaking", "position", "potential", "previousSchool", "prioritiesJson", "rebounding", "saveGameId", "scoring", "stamina", "suspensionDaysLeft", "teamId", "threePoint") SELECT "athleticism", "basketballIq", "characterRating", "chemistryImpact", "classYear", "countryOfOrigin", "defense", "disciplineRating", "eligibilityYearsLeft", "finishing", "firstName", "heightInches", "hometownCity", "hometownState", "id", "inTransferPortal", "injuryWeeksLeft", "isInjured", "isSuspended", "lastName", "onScholarship", "origin", "playmaking", "position", "potential", "previousSchool", "prioritiesJson", "rebounding", "saveGameId", "scoring", "stamina", "suspensionDaysLeft", "teamId", "threePoint" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE INDEX "Player_saveGameId_teamId_idx" ON "Player"("saveGameId", "teamId");
CREATE INDEX "Player_saveGameId_inTransferPortal_idx" ON "Player"("saveGameId", "inTransferPortal");
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "prestige" INTEGER NOT NULL DEFAULT 50,
    "nilBudget" INTEGER NOT NULL DEFAULT 100000,
    "facilitiesRating" INTEGER NOT NULL DEFAULT 50,
    "internationalScoutingRating" INTEGER NOT NULL DEFAULT 30,
    "academicReputation" INTEGER NOT NULL DEFAULT 55,
    "baseSalary" INTEGER NOT NULL DEFAULT 300000,
    "venueCapacity" INTEGER NOT NULL DEFAULT 5000,
    "arenaUpgradeRequestedThisSeason" BOOLEAN NOT NULL DEFAULT false,
    "isPlayerControlled" BOOLEAN NOT NULL DEFAULT false,
    "headCoachId" TEXT,
    "athleticDirectorId" TEXT,
    CONSTRAINT "Team_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_headCoachId_fkey" FOREIGN KEY ("headCoachId") REFERENCES "Coach" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Team_athleticDirectorId_fkey" FOREIGN KEY ("athleticDirectorId") REFERENCES "AthleticDirector" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("academicReputation", "arenaUpgradeRequestedThisSeason", "athleticDirectorId", "baseSalary", "conferenceId", "division", "facilitiesRating", "headCoachId", "id", "internationalScoutingRating", "isPlayerControlled", "name", "nilBudget", "prestige", "saveGameId", "state", "venueCapacity") SELECT "academicReputation", "arenaUpgradeRequestedThisSeason", "athleticDirectorId", "baseSalary", "conferenceId", "division", "facilitiesRating", "headCoachId", "id", "internationalScoutingRating", "isPlayerControlled", "name", "nilBudget", "prestige", "saveGameId", "state", "venueCapacity" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_headCoachId_key" ON "Team"("headCoachId");
CREATE UNIQUE INDEX "Team_athleticDirectorId_key" ON "Team"("athleticDirectorId");
CREATE INDEX "Team_saveGameId_division_idx" ON "Team"("saveGameId", "division");
CREATE INDEX "Team_conferenceId_idx" ON "Team"("conferenceId");
CREATE TABLE "new_Tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "conferenceId" TEXT,
    CONSTRAINT "Tournament_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Tournament_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Tournament" ("conferenceId", "division", "id", "saveGameId", "seasonYear", "type") SELECT "conferenceId", "division", "id", "saveGameId", "seasonYear", "type" FROM "Tournament";
DROP TABLE "Tournament";
ALTER TABLE "new_Tournament" RENAME TO "Tournament";
CREATE INDEX "Tournament_saveGameId_seasonYear_type_idx" ON "Tournament"("saveGameId", "seasonYear", "type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
