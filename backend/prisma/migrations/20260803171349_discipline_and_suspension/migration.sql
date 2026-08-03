-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "isInjured" BOOLEAN NOT NULL DEFAULT false,
    "injuryWeeksLeft" INTEGER NOT NULL DEFAULT 0,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspensionDaysLeft" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Player_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("athleticism", "basketballIq", "characterRating", "chemistryImpact", "classYear", "countryOfOrigin", "defense", "eligibilityYearsLeft", "finishing", "firstName", "heightInches", "hometownState", "id", "inTransferPortal", "injuryWeeksLeft", "isInjured", "lastName", "origin", "playmaking", "position", "potential", "rebounding", "saveGameId", "scoring", "stamina", "teamId", "threePoint") SELECT "athleticism", "basketballIq", "characterRating", "chemistryImpact", "classYear", "countryOfOrigin", "defense", "eligibilityYearsLeft", "finishing", "firstName", "heightInches", "hometownState", "id", "inTransferPortal", "injuryWeeksLeft", "isInjured", "lastName", "origin", "playmaking", "position", "potential", "rebounding", "saveGameId", "scoring", "stamina", "teamId", "threePoint" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE INDEX "Player_saveGameId_teamId_idx" ON "Player"("saveGameId", "teamId");
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
    "disciplineRating" INTEGER NOT NULL DEFAULT 65,
    "scoutingNoise" INTEGER NOT NULL DEFAULT 10,
    "graduationYear" INTEGER NOT NULL,
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "committedTeamId" TEXT,
    CONSTRAINT "Prospect_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Prospect" ("athleticism", "basketballIq", "characterRating", "committedTeamId", "countryOfOrigin", "defense", "finishing", "firstName", "graduationYear", "hometownState", "id", "lastName", "playmaking", "position", "potential", "prioritiesJson", "rebounding", "saveGameId", "scoring", "scoutingNoise", "signed", "source", "starRating", "threePoint") SELECT "athleticism", "basketballIq", "characterRating", "committedTeamId", "countryOfOrigin", "defense", "finishing", "firstName", "graduationYear", "hometownState", "id", "lastName", "playmaking", "position", "potential", "prioritiesJson", "rebounding", "saveGameId", "scoring", "scoutingNoise", "signed", "source", "starRating", "threePoint" FROM "Prospect";
DROP TABLE "Prospect";
ALTER TABLE "new_Prospect" RENAME TO "Prospect";
CREATE INDEX "Prospect_saveGameId_signed_graduationYear_idx" ON "Prospect"("saveGameId", "signed", "graduationYear");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
