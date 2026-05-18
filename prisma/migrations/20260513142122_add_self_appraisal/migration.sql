-- CreateTable
CREATE TABLE "SelfAppraisal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "transcriptRef" TEXT NOT NULL,
    "scoredCriteria" TEXT NOT NULL,
    "selfAwarenessMult" REAL NOT NULL DEFAULT 0,
    "reflectionBriefRef" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SelfAppraisal_cycleId_personId_key" ON "SelfAppraisal"("cycleId", "personId");
