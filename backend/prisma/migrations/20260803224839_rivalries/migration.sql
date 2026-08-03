-- CreateTable
CREATE TABLE "Rivalry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "intensity" INTEGER NOT NULL DEFAULT 0,
    "postseasonMeetings" INTEGER NOT NULL DEFAULT 0,
    "origin" TEXT NOT NULL DEFAULT 'TRADITIONAL',
    "establishedYear" INTEGER NOT NULL,
    CONSTRAINT "Rivalry_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Rivalry_saveGameId_idx" ON "Rivalry"("saveGameId");

-- CreateIndex
CREATE UNIQUE INDEX "Rivalry_saveGameId_teamAId_teamBId_key" ON "Rivalry"("saveGameId", "teamAId", "teamBId");
