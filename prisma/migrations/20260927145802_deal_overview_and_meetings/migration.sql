-- CreateTable
CREATE TABLE "deal_overviews" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dealId" INTEGER NOT NULL,
    "kickoff" TEXT NOT NULL DEFAULT '',
    "problem" TEXT NOT NULL DEFAULT '',
    "goal" TEXT NOT NULL DEFAULT '',
    "futurePlan" TEXT NOT NULL DEFAULT '',
    "phase" TEXT NOT NULL DEFAULT '',
    "users" TEXT NOT NULL DEFAULT '',
    "integrations" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT '',
    "requirements" TEXT NOT NULL DEFAULT '',
    "data" TEXT NOT NULL DEFAULT '',
    "approach" TEXT NOT NULL DEFAULT '',
    "deliverables" TEXT NOT NULL DEFAULT '',
    "assumptions" TEXT NOT NULL DEFAULT '',
    "effort" TEXT NOT NULL DEFAULT '',
    "stakeholders" TEXT NOT NULL DEFAULT '',
    "customerResponsibilities" TEXT NOT NULL DEFAULT '',
    "blockers" TEXT NOT NULL DEFAULT '',
    "openQuestions" TEXT NOT NULL DEFAULT '',
    "cooperationLevel" TEXT,
    "cooperationNote" TEXT NOT NULL DEFAULT '',
    "riskLevel" TEXT,
    "riskNote" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT NOT NULL,
    "updatedByName" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "deal_overviews_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_meeting_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dealId" INTEGER NOT NULL,
    "meetingDate" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "attendees" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "nextPreparations" TEXT NOT NULL DEFAULT '',
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_notes_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_meeting_notes" ("authorId", "authorName", "content", "createdAt", "dealId", "id", "meetingDate") SELECT "authorId", "authorName", "content", "createdAt", "dealId", "id", "meetingDate" FROM "meeting_notes";
DROP TABLE "meeting_notes";
ALTER TABLE "new_meeting_notes" RENAME TO "meeting_notes";
CREATE INDEX "meeting_notes_dealId_idx" ON "meeting_notes"("dealId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "deal_overviews_dealId_key" ON "deal_overviews"("dealId");
