-- CreateTable
CREATE TABLE "TransferInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "interestLevel" INTEGER NOT NULL DEFAULT 0,
    "pointsInvested" INTEGER NOT NULL DEFAULT 0,
    "offered" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TransferInterest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransferInterest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "transferPipelineJson" TEXT NOT NULL DEFAULT '{}',
    "adRelationshipsJson" TEXT NOT NULL DEFAULT '{}',
    "currentSalary" INTEGER NOT NULL DEFAULT 300000,
    "raiseRequestedThisSeason" BOOLEAN NOT NULL DEFAULT false,
    "teamPerception" INTEGER NOT NULL DEFAULT 65,
    "nationalPerception" INTEGER NOT NULL DEFAULT 20,
    "localPerception" INTEGER NOT NULL DEFAULT 50,
    "campusAtmosphere" INTEGER NOT NULL DEFAULT 40,
    "careerWins" INTEGER NOT NULL DEFAULT 0,
    "careerLosses" INTEGER NOT NULL DEFAULT 0,
    "yearsAtCurrentJob" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Coach_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Coach" ("adRelationshipsJson", "archetype", "background", "campusAtmosphere", "careerLosses", "careerWins", "collegeState", "collegeTeamName", "currentSalary", "defenseSkill", "developmentSkill", "hometownState", "hotSeatLevel", "id", "isPlayerControlled", "legalityReputation", "localPerception", "name", "nationalPerception", "offenseSkill", "pipelineStatesJson", "playedCollege", "proCountry", "proPath", "raiseRequestedThisSeason", "recruitingSkill", "reputation", "saveGameId", "teamPerception", "yearsAtCurrentJob") SELECT "adRelationshipsJson", "archetype", "background", "campusAtmosphere", "careerLosses", "careerWins", "collegeState", "collegeTeamName", "currentSalary", "defenseSkill", "developmentSkill", "hometownState", "hotSeatLevel", "id", "isPlayerControlled", "legalityReputation", "localPerception", "name", "nationalPerception", "offenseSkill", "pipelineStatesJson", "playedCollege", "proCountry", "proPath", "raiseRequestedThisSeason", "recruitingSkill", "reputation", "saveGameId", "teamPerception", "yearsAtCurrentJob" FROM "Coach";
DROP TABLE "Coach";
ALTER TABLE "new_Coach" RENAME TO "Coach";
CREATE INDEX "Coach_saveGameId_idx" ON "Coach"("saveGameId");
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
    "previousSchool" TEXT,
    "prioritiesJson" TEXT NOT NULL DEFAULT '{}',
    "isInjured" BOOLEAN NOT NULL DEFAULT false,
    "injuryWeeksLeft" INTEGER NOT NULL DEFAULT 0,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspensionDaysLeft" INTEGER NOT NULL DEFAULT 0,
    "onScholarship" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Player_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("athleticism", "basketballIq", "characterRating", "chemistryImpact", "classYear", "countryOfOrigin", "defense", "disciplineRating", "eligibilityYearsLeft", "finishing", "firstName", "heightInches", "hometownState", "id", "inTransferPortal", "injuryWeeksLeft", "isInjured", "isSuspended", "lastName", "onScholarship", "origin", "playmaking", "position", "potential", "rebounding", "saveGameId", "scoring", "stamina", "suspensionDaysLeft", "teamId", "threePoint") SELECT "athleticism", "basketballIq", "characterRating", "chemistryImpact", "classYear", "countryOfOrigin", "defense", "disciplineRating", "eligibilityYearsLeft", "finishing", "firstName", "heightInches", "hometownState", "id", "inTransferPortal", "injuryWeeksLeft", "isInjured", "isSuspended", "lastName", "onScholarship", "origin", "playmaking", "position", "potential", "rebounding", "saveGameId", "scoring", "stamina", "suspensionDaysLeft", "teamId", "threePoint" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE INDEX "Player_saveGameId_teamId_idx" ON "Player"("saveGameId", "teamId");
CREATE INDEX "Player_saveGameId_inTransferPortal_idx" ON "Player"("saveGameId", "inTransferPortal");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TransferInterest_playerId_teamId_key" ON "TransferInterest"("playerId", "teamId");
