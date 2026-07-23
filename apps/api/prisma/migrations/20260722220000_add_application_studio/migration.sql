-- CreateEnum
CREATE TYPE "ResumeFamily" AS ENUM ('SOFTWARE', 'IT_SUPPORT', 'SYSTEMS_ANALYST', 'GENERAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CandidateDocumentKind" AS ENUM ('MASTER_RESUME', 'TAILORED_RESUME', 'COVER_LETTER', 'JOB_DESCRIPTION', 'MATCH_REPORT', 'RECRUITER_OUTREACH', 'APPLICATION_ANSWERS', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscoveryOrigin" AS ENUM ('AI_JOB_HUNTER', 'CHATGPT_WORK', 'BOTH', 'MANUAL');

-- CreateEnum
CREATE TYPE "JobVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED_OPEN', 'UNCERTAIN', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "JobUrlProvenance" AS ENUM ('EMPLOYER_ATS', 'EMPLOYER_CAREERS', 'AGGREGATOR_DETAIL', 'REDIRECT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ApplicationPackageStatus" AS ENUM ('NEEDS_REVIEW', 'READY_FOR_WORK', 'GENERATING', 'READY_FOR_REVIEW', 'APPROVED', 'APPLIED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobContactType" AS ENUM ('RECRUITER', 'HIRING_MANAGER', 'TEAM_MEMBER', 'ALUMNI', 'GENERAL');

-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('EMAIL', 'LINKEDIN', 'OTHER');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'REPLIED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "candidate_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" "CandidateDocumentKind" NOT NULL,
    "resumeFamily" "ResumeFamily",
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "isMaster" BOOLEAN NOT NULL DEFAULT false,
    "libraryFileId" TEXT,
    "libraryPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_packages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "canonicalJobKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "jobUrl" TEXT NOT NULL,
    "applicationUrl" TEXT,
    "canonicalEmployerUrl" TEXT,
    "sourceNativeId" TEXT,
    "requisitionId" TEXT,
    "urlProvenance" "JobUrlProvenance" NOT NULL DEFAULT 'UNKNOWN',
    "applicationUrlVerifiedAt" TIMESTAMP(3),
    "discoveredBy" "DiscoveryOrigin" NOT NULL DEFAULT 'AI_JOB_HUNTER',
    "verificationStatus" "JobVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationEvidence" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3),
    "fitScore" INTEGER,
    "freshnessScore" INTEGER,
    "scoringPolicyVersion" TEXT,
    "scoreBreakdown" JSONB,
    "hardBlockers" JSONB,
    "matchEvidence" JSONB,
    "roleFamily" "ResumeFamily" NOT NULL DEFAULT 'GENERAL',
    "status" "ApplicationPackageStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "workNotes" TEXT,
    "libraryFolderId" TEXT,
    "libraryPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "application_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_source_observations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "sourceNativeId" TEXT,
    "requisitionId" TEXT,
    "detailUrl" TEXT NOT NULL,
    "applicationUrl" TEXT,
    "urlProvenance" "JobUrlProvenance" NOT NULL DEFAULT 'UNKNOWN',
    "applicationUrlVerifiedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_source_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_package_documents" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "purpose" "CandidateDocumentKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_package_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "contactType" "JobContactType" NOT NULL DEFAULT 'GENERAL',
    "profileUrl" TEXT,
    "verifiedEmail" TEXT,
    "emailVerificationUrl" TEXT,
    "verificationConfidence" INTEGER,
    "recommendedOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" "OutreachChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedBy" TEXT NOT NULL DEFAULT 'CHATGPT_WORK',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outreach_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidate_documents_userId_kind_isMaster_idx" ON "candidate_documents"("userId", "kind", "isMaster");
CREATE INDEX "candidate_documents_userId_resumeFamily_idx" ON "candidate_documents"("userId", "resumeFamily");
CREATE UNIQUE INDEX "application_packages_userId_source_externalJobId_key" ON "application_packages"("userId", "source", "externalJobId");
CREATE UNIQUE INDEX "application_packages_userId_canonicalJobKey_key" ON "application_packages"("userId", "canonicalJobKey");
CREATE INDEX "application_packages_userId_status_updatedAt_idx" ON "application_packages"("userId", "status", "updatedAt");
CREATE INDEX "application_packages_userId_verificationStatus_fitScore_idx" ON "application_packages"("userId", "verificationStatus", "fitScore");
CREATE UNIQUE INDEX "application_package_documents_packageId_documentId_key" ON "application_package_documents"("packageId", "documentId");
CREATE INDEX "application_package_documents_packageId_purpose_idx" ON "application_package_documents"("packageId", "purpose");
CREATE INDEX "job_contacts_userId_packageId_recommendedOrder_idx" ON "job_contacts"("userId", "packageId", "recommendedOrder");
CREATE INDEX "outreach_drafts_userId_packageId_status_idx" ON "outreach_drafts"("userId", "packageId", "status");
CREATE UNIQUE INDEX "job_source_observations_userId_source_externalJobId_key" ON "job_source_observations"("userId", "source", "externalJobId");
CREATE INDEX "job_source_observations_packageId_lastSeenAt_idx" ON "job_source_observations"("packageId", "lastSeenAt");
CREATE INDEX "job_source_observations_userId_requisitionId_idx" ON "job_source_observations"("userId", "requisitionId");

-- AddForeignKey
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_packages" ADD CONSTRAINT "application_packages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_package_documents" ADD CONSTRAINT "application_package_documents_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "application_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_package_documents" ADD CONSTRAINT "application_package_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "candidate_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_contacts" ADD CONSTRAINT "job_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_contacts" ADD CONSTRAINT "job_contacts_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "application_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "application_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "job_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_source_observations" ADD CONSTRAINT "job_source_observations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_source_observations" ADD CONSTRAINT "job_source_observations_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "application_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
