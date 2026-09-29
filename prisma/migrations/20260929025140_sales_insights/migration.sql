-- CreateTable
CREATE TABLE "deal_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dealId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT,
    "changedById" TEXT NOT NULL,
    "changedByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deal_events_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_comments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "meetingId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_comments_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meeting_notes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_customers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyName" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "memo" TEXT,
    "matchKey" TEXT NOT NULL,
    "industry" TEXT NOT NULL DEFAULT '',
    "archivedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_customers" ("archivedAt", "companyName", "contactName", "createdAt", "department", "email", "id", "matchKey", "memo", "phone", "updatedAt", "version") SELECT "archivedAt", "companyName", "contactName", "createdAt", "department", "email", "id", "matchKey", "memo", "phone", "updatedAt", "version" FROM "customers";
DROP TABLE "customers";
ALTER TABLE "new_customers" RENAME TO "customers";
CREATE UNIQUE INDEX "customers_matchKey_key" ON "customers"("matchKey");
CREATE TABLE "new_deals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "salesRepId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "stage" TEXT NOT NULL DEFAULT 'plan',
    "stageChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedAmount" INTEGER,
    "expectedCloseMonth" TEXT,
    "source" TEXT NOT NULL DEFAULT '',
    "lostReason" TEXT,
    "lostNote" TEXT NOT NULL DEFAULT '',
    "wonAt" DATETIME,
    "lostAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "deals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "deals_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_deals" ("createdAt", "customerId", "expectedAmount", "expectedCloseMonth", "id", "lostAt", "name", "salesRepId", "stage", "stageChangedAt", "status", "updatedAt", "version", "wonAt") SELECT "createdAt", "customerId", "expectedAmount", "expectedCloseMonth", "id", "lostAt", "name", "salesRepId", "stage", "stageChangedAt", "status", "updatedAt", "version", "wonAt" FROM "deals";
DROP TABLE "deals";
ALTER TABLE "new_deals" RENAME TO "deals";
CREATE INDEX "deals_status_stage_idx" ON "deals"("status", "stage");
CREATE INDEX "deals_salesRepId_idx" ON "deals"("salesRepId");
CREATE INDEX "deals_customerId_idx" ON "deals"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "deal_events_dealId_idx" ON "deal_events"("dealId");

-- CreateIndex
CREATE INDEX "deal_events_createdAt_idx" ON "deal_events"("createdAt");

-- CreateIndex
CREATE INDEX "meeting_comments_meetingId_idx" ON "meeting_comments"("meetingId");

-- 既存の案件にも「動き」の最初の記録を入れる（作成・受注・失注の日時から）
INSERT INTO "deal_events" ("dealId", "kind", "fromStage", "toStage", "changedById", "changedByName", "createdAt")
SELECT "id", 'created', NULL, 'plan', '', '（移行時の記録）', "createdAt" FROM "deals";
INSERT INTO "deal_events" ("dealId", "kind", "fromStage", "toStage", "changedById", "changedByName", "createdAt")
SELECT "id", 'won', "stage", NULL, '', '（移行時の記録）', "wonAt" FROM "deals" WHERE "status" = 'won' AND "wonAt" IS NOT NULL;
INSERT INTO "deal_events" ("dealId", "kind", "fromStage", "toStage", "changedById", "changedByName", "createdAt")
SELECT "id", 'lost', "stage", NULL, '', '（移行時の記録）', "lostAt" FROM "deals" WHERE "status" = 'lost' AND "lostAt" IS NOT NULL;