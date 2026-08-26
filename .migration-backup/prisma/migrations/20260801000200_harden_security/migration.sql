BEGIN;

ALTER TABLE "daily_logs"
    ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "rate_limit_events" (
    "id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_audit_events" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rate_limit_events_key_hash_created_at_idx"
    ON "rate_limit_events"("key_hash", "created_at");
CREATE INDEX "rate_limit_events_created_at_idx"
    ON "rate_limit_events"("created_at");
CREATE INDEX "admin_audit_events_actor_id_created_at_idx"
    ON "admin_audit_events"("actor_id", "created_at" DESC);
CREATE INDEX "admin_audit_events_target_user_id_created_at_idx"
    ON "admin_audit_events"("target_user_id", "created_at" DESC);

ALTER TABLE "admin_audit_events"
    ADD CONSTRAINT "admin_audit_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_audit_events"
    ADD CONSTRAINT "admin_audit_events_target_user_id_fkey"
    FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- NOT VALID avoids blocking this release if historical rows predate API
-- validation. PostgreSQL still enforces each constraint for new writes.
ALTER TABLE "daily_logs"
    ADD CONSTRAINT "daily_logs_score_check"
    CHECK ("score" BETWEEN 1 AND 10) NOT VALID;
ALTER TABLE "daily_logs"
    ADD CONSTRAINT "daily_logs_revision_check"
    CHECK ("revision" >= 1) NOT VALID;
ALTER TABLE "daily_logs"
    ADD CONSTRAINT "daily_logs_text_length_check"
    CHECK (
        ("good_text" IS NULL OR char_length("good_text") <= 2000)
        AND ("improve_text" IS NULL OR char_length("improve_text") <= 2000)
        AND ("tomorrow_text" IS NULL OR char_length("tomorrow_text") <= 2000)
    ) NOT VALID;
ALTER TABLE "story_answers"
    ADD CONSTRAINT "story_answers_question_no_check"
    CHECK ("question_no" BETWEEN 1 AND 15) NOT VALID;
ALTER TABLE "story_answers"
    ADD CONSTRAINT "story_answers_text_length_check"
    CHECK (char_length("answer_text") <= 4000) NOT VALID;
ALTER TABLE "story_versions"
    ADD CONSTRAINT "story_versions_note_length_check"
    CHECK ("note" IS NULL OR char_length("note") <= 200) NOT VALID;

COMMIT;
