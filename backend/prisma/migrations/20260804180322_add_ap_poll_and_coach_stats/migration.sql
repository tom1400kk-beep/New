-- CreateTable
CREATE TABLE "CoachSeasonRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "confWins" INTEGER NOT NULL,
    "confLosses" INTEGER NOT NULL,
    "madePostseason" BOOLEAN NOT NULL DEFAULT false,
    "postseasonWins" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CoachSeasonRecord_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoachSeasonRecord_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoachSeasonRecord_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PollSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "division" TEXT NOT NULL,
    "weekDate" DATETIME NOT NULL,
    "rankingsJson" TEXT NOT NULL,
    CONSTRAINT "PollSnapshot_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CoachSeasonRecord_saveGameId_coachId_idx" ON "CoachSeasonRecord"("saveGameId", "coachId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachSeasonRecord_coachId_seasonYear_key" ON "CoachSeasonRecord"("coachId", "seasonYear");

-- CreateIndex
CREATE INDEX "PollSnapshot_saveGameId_seasonYear_division_idx" ON "PollSnapshot"("saveGameId", "seasonYear", "division");

-- CreateIndex
CREATE UNIQUE INDEX "PollSnapshot_saveGameId_seasonYear_division_weekDate_key" ON "PollSnapshot"("saveGameId", "seasonYear", "division", "weekDate");
