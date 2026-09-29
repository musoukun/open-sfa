-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "wonAt" DATETIME,
    "lostAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "deals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "deals_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_deals" ("createdAt", "customerId", "id", "lostAt", "name", "salesRepId", "status", "updatedAt", "version", "wonAt") SELECT "createdAt", "customerId", "id", "lostAt", "name", "salesRepId", "status", "updatedAt", "version", "wonAt" FROM "deals";
DROP TABLE "deals";
ALTER TABLE "new_deals" RENAME TO "deals";
CREATE INDEX "deals_status_stage_idx" ON "deals"("status", "stage");
CREATE INDEX "deals_salesRepId_idx" ON "deals"("salesRepId");
CREATE INDEX "deals_customerId_idx" ON "deals"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
