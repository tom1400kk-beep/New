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
    "currentSalary" INTEGER NOT NULL DEFAULT 300000,
    "raiseRequestedThisSeason" BOOLEAN NOT NULL DEFAULT false,
    "teamPerception" INTEGER NOT NULL DEFAULT 65,
    "nationalPerception" INTEGER NOT NULL DEFAULT 20,
    "localPerception" INTEGER NOT NULL DEFAULT 50,
    "careerWins" INTEGER NOT NULL DEFAULT 0,
    "careerLosses" INTEGER NOT NULL DEFAULT 0,
    "yearsAtCurrentJob" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Coach_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Coach" ("adRelationshipsJson", "archetype", "background", "careerLosses", "careerWins", "collegeState", "collegeTeamName", "currentSalary", "defenseSkill", "developmentSkill", "hometownState", "hotSeatLevel", "id", "isPlayerControlled", "legalityReputation", "name", "offenseSkill", "pipelineStatesJson", "playedCollege", "proCountry", "proPath", "raiseRequestedThisSeason", "recruitingSkill", "reputation", "saveGameId", "yearsAtCurrentJob") SELECT "adRelationshipsJson", "archetype", "background", "careerLosses", "careerWins", "collegeState", "collegeTeamName", "currentSalary", "defenseSkill", "developmentSkill", "hometownState", "hotSeatLevel", "id", "isPlayerControlled", "legalityReputation", "name", "offenseSkill", "pipelineStatesJson", "playedCollege", "proCountry", "proPath", "raiseRequestedThisSeason", "recruitingSkill", "reputation", "saveGameId", "yearsAtCurrentJob" FROM "Coach";
DROP TABLE "Coach";
ALTER TABLE "new_Coach" RENAME TO "Coach";
CREATE INDEX "Coach_saveGameId_idx" ON "Coach"("saveGameId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
