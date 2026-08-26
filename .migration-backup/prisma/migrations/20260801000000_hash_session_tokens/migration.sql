-- Existing values are bearer tokens, so invalidate them before switching to
-- one-way hashes. This intentionally signs every user out once on deployment.
BEGIN;

DELETE FROM "sessions";
DROP INDEX "sessions_token_idx";
ALTER TABLE "sessions" RENAME COLUMN "token" TO "token_hash";
ALTER INDEX "sessions_token_key" RENAME TO "sessions_token_hash_key";
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

COMMIT;
