-- CreateTable
CREATE TABLE "AthleticDirector" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "patience" INTEGER NOT NULL DEFAULT 50,
    "winFocus" INTEGER NOT NULL DEFAULT 50,
    "integrityStandard" INTEGER NOT NULL DEFAULT 50,
    "loyalty" INTEGER NOT NULL DEFAULT 50,
    "yearsAtCurrentJob" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AthleticDirector_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Coach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saveGameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPlayerControlled" BOOLEAN NOT NULL DEFAULT false,
    "reputation" INTEGER NOT NULL DEFAULT 50,
    "hotSeatLevel" INTEGER NOT NULL DEFAULT 0,
    "offenseSkill" INTEGER NOT NULL DEFAULT 50,
    "defenseSkill" INTEGER NOT NULL DEFAULT 50,
    "recruitingSkill" INTEGER NOT NULL DEFAULT 50,
    "developmentSkill" INTEGER NOT NULL DEFAULT 50,
    "archetype" TEXT NOT NULL DEFAULT 'PROGRAM_BUILDER',
    "background" TEXT,
    "playedCollege" BOOLEAN NOT NULL DEFAULT false,
    "collegeTeamName" TEXT,
    "collegeState" TEXT,
    "proPath" TEXT NOT NULL DEFAULT 'NONE',
    "proCountry" TEXT,
    "legalityReputation" INTEGER NOT NULL DEFAULT 75,
    "hometownState" TEXT,
    "pipelineStatesJson" TEXT NOT NULL DEFAULT '{}',
    "adRelationshipsJson" TEXT NOT NULL DEFAULT '{}',
    "careerWins" INTEGER NOT NULL DEFAULT 0,
    "careerLosses" INTEGER NOT NULL DEFAULT 0,
    "yearsAtCurrentJob" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Coach_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Coach" ("archetype", "background", "careerLosses", "careerWins", "collegeState", "collegeTeamName", "defenseSkill", "developmentSkill", "hometownState", "hotSeatLevel", "id", "isPlayerControlled", "legalityReputation", "name", "offenseSkill", "pipelineStatesJson", "playedCollege", "proCountry", "proPath", "recruitingSkill", "reputation", "saveGameId", "yearsAtCurrentJob") SELECT "archetype", "background", "careerLosses", "careerWins", "collegeState", "collegeTeamName", "defenseSkill", "developmentSkill", "hometownState", "hotSeatLevel", "id", "isPlayerControlled", "legalityReputation", "name", "offenseSkill", "pipelineStatesJson", "playedCollege", "proCountry", "proPath", "recruitingSkill", "reputation", "saveGameId", "yearsAtCurrentJob" FROM "Coach";
DROP TABLE "Coach";
ALTER TABLE "new_Coach" RENAME TO "Coach";
CREATE INDEX "Coach_saveGameId_idx" ON "Coach"("saveGameId");
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
    "athleticDirectorId" TEXT,
    CONSTRAINT "Team_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Team_headCoachId_fkey" FOREIGN KEY ("headCoachId") REFERENCES "Coach" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Team_athleticDirectorId_fkey" FOREIGN KEY ("athleticDirectorId") REFERENCES "AthleticDirector" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("academicReputation", "conferenceId", "division", "facilitiesRating", "headCoachId", "id", "internationalScoutingRating", "isPlayerControlled", "name", "nilBudget", "prestige", "saveGameId", "state") SELECT "academicReputation", "conferenceId", "division", "facilitiesRating", "headCoachId", "id", "internationalScoutingRating", "isPlayerControlled", "name", "nilBudget", "prestige", "saveGameId", "state" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_headCoachId_key" ON "Team"("headCoachId");
CREATE UNIQUE INDEX "Team_athleticDirectorId_key" ON "Team"("athleticDirectorId");
CREATE INDEX "Team_saveGameId_division_idx" ON "Team"("saveGameId", "division");
CREATE INDEX "Team_conferenceId_idx" ON "Team"("conferenceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AthleticDirector_saveGameId_idx" ON "AthleticDirector"("saveGameId");
