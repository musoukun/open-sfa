-- CreateTable
CREATE TABLE "customers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyName" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "memo" TEXT,
    "matchKey" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "deals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "salesRepId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "wonAt" DATETIME,
    "lostAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "deals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "deals_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deal_contracts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dealId" INTEGER NOT NULL,
    "contractType" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "sourceQuoteId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "deal_contracts_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quoteNumber" TEXT,
    "dealId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "validUntil" TEXT,
    "taxRate" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "tax" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "quotes_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quoteId" INTEGER NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "assigneeId" INTEGER,
    CONSTRAINT "quote_lines_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "quote_lines_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "members" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quote_status_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quoteId" INTEGER NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedByName" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quote_status_history_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dealId" INTEGER NOT NULL,
    "meetingDate" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_notes_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" DATETIME
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_matchKey_key" ON "customers"("matchKey");

-- CreateIndex
CREATE INDEX "deals_salesRepId_idx" ON "deals"("salesRepId");

-- CreateIndex
CREATE INDEX "deals_customerId_idx" ON "deals"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_contracts_dealId_key" ON "deal_contracts"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_quoteNumber_key" ON "quotes"("quoteNumber");

-- CreateIndex
CREATE INDEX "quotes_dealId_idx" ON "quotes"("dealId");

-- CreateIndex
CREATE INDEX "quote_lines_quoteId_idx" ON "quote_lines"("quoteId");

-- CreateIndex
CREATE INDEX "quote_status_history_quoteId_idx" ON "quote_status_history"("quoteId");

-- CreateIndex
CREATE INDEX "meeting_notes_dealId_idx" ON "meeting_notes"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");
