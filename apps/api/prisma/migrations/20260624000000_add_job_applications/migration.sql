DO $$
BEGIN
    CREATE TYPE "ApplicationStatus" AS ENUM (
        NEW,
        SAVED,
        APPLIED,
        INTERVIEW,
        OFFER,
        REJECTED
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "job_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "source" TEXT,
    "title" TEXT,
    "company" TEXT,
    "location" TEXT,
    "jobUrl" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT NEW,
    "recruiterName" TEXT,
    "recruiterEmail" TEXT,
    "followUpNotes" TEXT,
    "appliedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_applications_userId_externalJobId_key"
ON "job_applications"("userId", "externalJobId");

DO $$
BEGIN
    ALTER TABLE "job_applications"
    ADD CONSTRAINT "job_applications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
