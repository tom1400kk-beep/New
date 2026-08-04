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
    "hometownCity" TEXT NOT NULL DEFAULT '',
    "countryOfOrigin" TEXT,
    "source" TEXT NOT NULL,
    "starRating" INTEGER NOT NULL,
    "prioritiesJson" TEXT NOT NULL DEFAULT '{}',
    "playedEYBL" BOOLEAN NOT NULL DEFAULT false,
    "eyblTeam" TEXT,
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
INSERT INTO "new_Prospect" ("athleticism", "basketballIq", "characterRating", "committedTeamId", "countryOfOrigin", "defense", "disciplineRating", "finishing", "firstName", "graduationYear", "hometownCity", "hometownState", "id", "lastName", "playmaking", "position", "potential", "prioritiesJson", "rebounding", "saveGameId", "scoring", "scoutingNoise", "signed", "source", "starRating", "threePoint") SELECT "athleticism", "basketballIq", "characterRating", "committedTeamId", "countryOfOrigin", "defense", "disciplineRating", "finishing", "firstName", "graduationYear", "hometownCity", "hometownState", "id", "lastName", "playmaking", "position", "potential", "prioritiesJson", "rebounding", "saveGameId", "scoring", "scoutingNoise", "signed", "source", "starRating", "threePoint" FROM "Prospect";
DROP TABLE "Prospect";
ALTER TABLE "new_Prospect" RENAME TO "Prospect";
CREATE INDEX "Prospect_saveGameId_signed_graduationYear_idx" ON "Prospect"("saveGameId", "signed", "graduationYear");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
