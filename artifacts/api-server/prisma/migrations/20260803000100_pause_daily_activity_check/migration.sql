-- Replit generates production migrations from schema differences and cannot
-- carry the data backfill in the original migration into an existing database.
-- Temporarily remove this validated check so the runtime compatibility repair
-- can align legacy rows before it is restored in the following release.
ALTER TABLE "daily_logs"
DROP CONSTRAINT IF EXISTS "daily_logs_activity_practiced_check";
