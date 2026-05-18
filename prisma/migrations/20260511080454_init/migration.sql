-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "preferredName" TEXT,
    "email" TEXT NOT NULL,
    "preferredLang" TEXT NOT NULL DEFAULT 'en',
    "role" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "managerId" TEXT,
    "hiredAt" DATETIME NOT NULL,
    "gender" TEXT,
    "nationality" TEXT,
    CONSTRAINT "Person_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Person_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "Cycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "status" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "createdAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "qaScore" REAL,
    "deadlineMet" BOOLEAN,
    "projectId" TEXT,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "roleOnTask" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL,
    CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Collaboration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "personAId" TEXT NOT NULL,
    "personBId" TEXT NOT NULL,
    "interactionStrength" REAL NOT NULL,
    "evidenceCount" INTEGER NOT NULL,
    "sharedProjects" TEXT NOT NULL,
    CONSTRAINT "Collaboration_personAId_fkey" FOREIGN KEY ("personAId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Collaboration_personBId_fkey" FOREIGN KEY ("personBId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LivePulse" (
    "personId" TEXT NOT NULL PRIMARY KEY,
    "liveScore" REAL NOT NULL,
    "delta24h" REAL NOT NULL DEFAULT 0,
    "delta7d" REAL NOT NULL DEFAULT 0,
    "recomputedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CycleScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "managerEval" REAL NOT NULL,
    "crossFunctionalEval" REAL NOT NULL,
    "selfAppraisal" REAL NOT NULL,
    "achievementPoints" REAL NOT NULL,
    "selfAwarenessMultiplier" REAL NOT NULL DEFAULT 0,
    "totalScore" REAL NOT NULL,
    "calibrationConfidence" INTEGER NOT NULL,
    "componentEvidence" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL,
    "lockedAt" DATETIME,
    "signedOffBy" TEXT,
    CONSTRAINT "CycleScore_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CycleScore_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "proposedPoints" INTEGER NOT NULL,
    "awardedPoints" INTEGER,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "evidenceEvents" TEXT NOT NULL,
    "twinConfidence" REAL NOT NULL DEFAULT 0.7,
    "proposedAt" DATETIME NOT NULL,
    "confirmedAt" DATETIME,
    "managerId" TEXT,
    CONSTRAINT "Achievement_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedbackEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "ratedPersonId" TEXT NOT NULL,
    "raterPersonId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "contextRefId" TEXT,
    "dimension" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "voiceNoteRef" TEXT,
    "weight" REAL NOT NULL DEFAULT 1,
    "vcnVerified" BOOLEAN NOT NULL DEFAULT true,
    "occurredAt" DATETIME NOT NULL,
    CONSTRAINT "FeedbackEvent_ratedPersonId_fkey" FOREIGN KEY ("ratedPersonId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeedbackEvent_raterPersonId_fkey" FOREIGN KEY ("raterPersonId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManagerJustification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "systemScore" REAL NOT NULL,
    "managerScore" REAL NOT NULL,
    "delta" REAL NOT NULL,
    "justification" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManagerJustification_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TwinAdvocateBrief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "topAchievements" TEXT NOT NULL,
    "peerSummary" TEXT NOT NULL,
    "growthSignals" TEXT NOT NULL,
    "flagged" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TwinAdvocateBrief_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TwinAdvocateBrief_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscrepancyFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "systemScore" REAL NOT NULL,
    "managerScore" REAL NOT NULL,
    "delta" REAL NOT NULL,
    "severity" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscrepancyFlag_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BiasPattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "axis" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeRef" TEXT NOT NULL,
    "scopeLabel" TEXT NOT NULL,
    "criterion" TEXT,
    "effectSize" REAL NOT NULL,
    "ciLow" REAL NOT NULL,
    "ciHigh" REAL NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "pValue" REAL NOT NULL,
    "severity" TEXT NOT NULL,
    "explanations" TEXT NOT NULL,
    "recommended" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "hrNote" TEXT,
    CONSTRAINT "BiasPattern_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" TEXT,
    CONSTRAINT "AuditEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");

-- CreateIndex
CREATE INDEX "Person_tenantId_role_idx" ON "Person"("tenantId", "role");

-- CreateIndex
CREATE INDEX "Person_managerId_idx" ON "Person"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "Cycle_tenantId_label_key" ON "Cycle"("tenantId", "label");

-- CreateIndex
CREATE INDEX "Task_tenantId_closedAt_idx" ON "Task"("tenantId", "closedAt");

-- CreateIndex
CREATE INDEX "TaskAssignment_personId_idx" ON "TaskAssignment"("personId");

-- CreateIndex
CREATE INDEX "Collaboration_cycleId_personAId_idx" ON "Collaboration"("cycleId", "personAId");

-- CreateIndex
CREATE UNIQUE INDEX "Collaboration_cycleId_personAId_personBId_key" ON "Collaboration"("cycleId", "personAId", "personBId");

-- CreateIndex
CREATE INDEX "CycleScore_cycleId_totalScore_idx" ON "CycleScore"("cycleId", "totalScore");

-- CreateIndex
CREATE UNIQUE INDEX "CycleScore_cycleId_personId_key" ON "CycleScore"("cycleId", "personId");

-- CreateIndex
CREATE INDEX "Achievement_cycleId_personId_idx" ON "Achievement"("cycleId", "personId");

-- CreateIndex
CREATE INDEX "Achievement_personId_status_idx" ON "Achievement"("personId", "status");

-- CreateIndex
CREATE INDEX "FeedbackEvent_cycleId_ratedPersonId_idx" ON "FeedbackEvent"("cycleId", "ratedPersonId");

-- CreateIndex
CREATE INDEX "ManagerJustification_cycleId_personId_idx" ON "ManagerJustification"("cycleId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "TwinAdvocateBrief_cycleId_personId_key" ON "TwinAdvocateBrief"("cycleId", "personId");

-- CreateIndex
CREATE INDEX "BiasPattern_tenantId_status_idx" ON "BiasPattern"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AuditEntry_tenantId_occurredAt_idx" ON "AuditEntry"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEntry_subjectKind_subjectId_idx" ON "AuditEntry"("subjectKind", "subjectId");
