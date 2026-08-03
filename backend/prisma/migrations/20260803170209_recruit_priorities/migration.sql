-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Prospect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "hometownState" TEXT NOT NULL,
    "countryOfOrigin" TEXT,
    "source" TEXT NOT NULL,
    "starRating" INTEGER NOT NULL,
    "prioritiesJson" TEXT NOT NULL DEFAULT '{}',
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
INSERT INTO "new_Prospect" ("athleticism", "basketballIq", "characterRating", "committedTeamId", "countryOfOrigin", "defense", "finishing", "firstName", "graduationYear", "hometownState", "id", "lastName", "playmaking", "position", "potential", "rebounding", "saveGameId", "scoring", "scoutingNoise", "signed", "source", "starRating", "threePoint") SELECT "athleticism", "basketballIq", "characterRating", "committedTeamId", "countryOfOrigin", "defense", "finishing", "firstName", "graduationYear", "hometownState", "id", "lastName", "playmaking", "position", "potential", "rebounding", "saveGameId", "scoring", "scoutingNoise", "signed", "source", "starRating", "threePoint" FROM "Prospect";
DROP TABLE "Prospect";
ALTER TABLE "new_Prospect" RENAME TO "Prospect";
CREATE INDEX "Prospect_saveGameId_signed_graduationYear_idx" ON "Prospect"("saveGameId", "signed", "graduationYear");
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
    "isPlayerControlled" BOOLEAN NOT NULL DEFAULT false,
    "headCoachId" TEXT,
    CONSTRAINT "Team_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Team_headCoachId_fkey" FOREIGN KEY ("headCoachId") REFERENCES "Coach" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("conferenceId", "division", "facilitiesRating", "headCoachId", "id", "internationalScoutingRating", "isPlayerControlled", "name", "nilBudget", "prestige", "saveGameId", "state") SELECT "conferenceId", "division", "facilitiesRating", "headCoachId", "id", "internationalScoutingRating", "isPlayerControlled", "name", "nilBudget", "prestige", "saveGameId", "state" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_headCoachId_key" ON "Team"("headCoachId");
CREATE INDEX "Team_saveGameId_division_idx" ON "Team"("saveGameId", "division");
CREATE INDEX "Team_conferenceId_idx" ON "Team"("conferenceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
