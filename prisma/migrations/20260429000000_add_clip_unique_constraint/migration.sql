-- AddUniqueConstraint
CREATE UNIQUE INDEX IF NOT EXISTS "Clip_jobId_wasabiKey_key" ON "Clip"("jobId", "wasabiKey");
