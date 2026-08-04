-- AlterTable
ALTER TABLE "Team" ADD COLUMN "internationalTourCountry" TEXT;
ALTER TABLE "Team" ADD COLUMN "internationalTourSeasonYear" INTEGER;

-- CreateTable
CREATE TABLE "InternationalTour" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "country" TEXT NOT NULL,
    "gamesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternationalTour_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InternationalTour_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InternationalTour_saveGameId_idx" ON "InternationalTour"("saveGameId");

-- CreateIndex
CREATE INDEX "InternationalTour_teamId_idx" ON "InternationalTour"("teamId");
