ALTER TABLE "application_packages"
ADD COLUMN "missedByAutomation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "automationMissReason" TEXT,
ADD COLUMN "automationMissNotes" TEXT,
ADD COLUMN "automationReviewedAt" TIMESTAMP(3),
ADD COLUMN "alertedAt" TIMESTAMP(3);

CREATE INDEX "application_packages_userId_discoveredBy_missedByAutomation_idx"
ON "application_packages"("userId", "discoveredBy", "missedByAutomation");
