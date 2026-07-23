-- CreateTable
CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "location" TEXT,
    "category" TEXT,
    "workMode" TEXT,
    "minimumMatchScore" INTEGER NOT NULL DEFAULT 0,
    "companies" JSONB,
    "sources" JSONB,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_search_alerts" (
    "id" TEXT NOT NULL,
    "savedSearchId" TEXT NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    CONSTRAINT "saved_search_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_searches_userId_enabled_idx" ON "saved_searches"("userId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "saved_search_alerts_savedSearchId_externalJobId_key" ON "saved_search_alerts"("savedSearchId", "externalJobId");

-- CreateIndex
CREATE INDEX "saved_search_alerts_savedSearchId_matchedAt_idx" ON "saved_search_alerts"("savedSearchId", "matchedAt");

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_search_alerts" ADD CONSTRAINT "saved_search_alerts_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "saved_searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
