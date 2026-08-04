-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
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
    "internationalTourCountry" TEXT,
    "internationalTourSeasonYear" INTEGER,
    "headCoachId" TEXT,
    "athleticDirectorId" TEXT,
    CONSTRAINT "Team_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_headCoachId_fkey" FOREIGN KEY ("headCoachId") REFERENCES "Coach" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Team_athleticDirectorId_fkey" FOREIGN KEY ("athleticDirectorId") REFERENCES "AthleticDirector" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("academicReputation", "arenaUpgradeRequestedThisSeason", "athleticDirectorId", "baseSalary", "conferenceId", "division", "facilitiesRating", "headCoachId", "id", "internationalScoutingRating", "internationalTourCountry", "internationalTourSeasonYear", "isPlayerControlled", "name", "nilBudget", "prestige", "saveGameId", "state", "venueCapacity") SELECT "academicReputation", "arenaUpgradeRequestedThisSeason", "athleticDirectorId", "baseSalary", "conferenceId", "division", "facilitiesRating", "headCoachId", "id", "internationalScoutingRating", "internationalTourCountry", "internationalTourSeasonYear", "isPlayerControlled", "name", "nilBudget", "prestige", "saveGameId", "state", "venueCapacity" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_headCoachId_key" ON "Team"("headCoachId");
CREATE UNIQUE INDEX "Team_athleticDirectorId_key" ON "Team"("athleticDirectorId");
CREATE INDEX "Team_saveGameId_division_idx" ON "Team"("saveGameId", "division");
CREATE INDEX "Team_conferenceId_idx" ON "Team"("conferenceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
