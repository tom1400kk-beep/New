-- AlterTable
ALTER TABLE "Player" ADD COLUMN "countryOfOrigin" TEXT;

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "countryOfOrigin" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "isPlayerControlled" BOOLEAN NOT NULL DEFAULT false,
    "headCoachId" TEXT,
    CONSTRAINT "Team_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Team_headCoachId_fkey" FOREIGN KEY ("headCoachId") REFERENCES "Coach" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("conferenceId", "division", "facilitiesRating", "headCoachId", "id", "isPlayerControlled", "name", "nilBudget", "prestige", "saveGameId", "state") SELECT "conferenceId", "division", "facilitiesRating", "headCoachId", "id", "isPlayerControlled", "name", "nilBudget", "prestige", "saveGameId", "state" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_headCoachId_key" ON "Team"("headCoachId");
CREATE INDEX "Team_saveGameId_division_idx" ON "Team"("saveGameId", "division");
CREATE INDEX "Team_conferenceId_idx" ON "Team"("conferenceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
