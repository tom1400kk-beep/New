/*
  Warnings:

  - Added the required column `teamId` to the `PlayerGameStat` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlayerGameStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
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
INSERT INTO "new_PlayerGameStat" ("assists", "blocks", "fga", "fgm", "fta", "ftm", "gameId", "id", "minutes", "playerId", "points", "rebounds", "steals", "threepa", "threepm", "turnovers") SELECT "assists", "blocks", "fga", "fgm", "fta", "ftm", "gameId", "id", "minutes", "playerId", "points", "rebounds", "steals", "threepa", "threepm", "turnovers" FROM "PlayerGameStat";
DROP TABLE "PlayerGameStat";
ALTER TABLE "new_PlayerGameStat" RENAME TO "PlayerGameStat";
CREATE INDEX "PlayerGameStat_gameId_idx" ON "PlayerGameStat"("gameId");
CREATE INDEX "PlayerGameStat_playerId_idx" ON "PlayerGameStat"("playerId");
CREATE INDEX "PlayerGameStat_gameId_teamId_idx" ON "PlayerGameStat"("gameId", "teamId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
