ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "activeResumeFamily" "ResumeFamily";

ALTER TABLE "candidate_documents"
ADD COLUMN IF NOT EXISTS "textCiphertext" BYTEA,
ADD COLUMN IF NOT EXISTS "textIv" BYTEA,
ADD COLUMN IF NOT EXISTS "textAuthTag" BYTEA,
ADD COLUMN IF NOT EXISTS "textSha256" TEXT,
ADD COLUMN IF NOT EXISTS "textLength" INTEGER,
ADD COLUMN IF NOT EXISTS "textExtractedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "textExtractionError" TEXT;

CREATE INDEX IF NOT EXISTS "candidate_documents_userId_resumeFamily_isMaster_idx"
ON "candidate_documents"("userId", "resumeFamily", "isMaster");
