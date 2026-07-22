CREATE INDEX IF NOT EXISTS "job_applications_userId_status_idx"
ON "job_applications"("userId", "status");
