BEGIN;

CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');

ALTER TABLE "users"
    ADD COLUMN "membership_status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "withdrawn_at" TIMESTAMP(3);

CREATE TABLE "registration_invites" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "athlete_name" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "used_by_user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guardian_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guardian_name" TEXT NOT NULL,
    "guardian_relationship" TEXT NOT NULL,
    "notice_version" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registration_invites_token_hash_key"
    ON "registration_invites"("token_hash");
CREATE UNIQUE INDEX "registration_invites_used_by_user_id_key"
    ON "registration_invites"("used_by_user_id");
CREATE INDEX "registration_invites_created_at_idx"
    ON "registration_invites"("created_at" DESC);
CREATE INDEX "registration_invites_expires_at_idx"
    ON "registration_invites"("expires_at");
CREATE UNIQUE INDEX "guardian_consents_user_id_key"
    ON "guardian_consents"("user_id");
CREATE INDEX "guardian_consents_accepted_at_idx"
    ON "guardian_consents"("accepted_at" DESC);

ALTER TABLE "registration_invites"
    ADD CONSTRAINT "registration_invites_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_invites"
    ADD CONSTRAINT "registration_invites_used_by_user_id_fkey"
    FOREIGN KEY ("used_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guardian_consents"
    ADD CONSTRAINT "guardian_consents_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"
    ADD CONSTRAINT "users_membership_status_check"
    CHECK (
        ("membership_status" = 'ACTIVE' AND "withdrawn_at" IS NULL)
        OR ("membership_status" = 'WITHDRAWN' AND "withdrawn_at" IS NOT NULL)
    ) NOT VALID;
ALTER TABLE "registration_invites"
    ADD CONSTRAINT "registration_invites_token_hash_check"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$') NOT VALID;
ALTER TABLE "registration_invites"
    ADD CONSTRAINT "registration_invites_athlete_name_check"
    CHECK (char_length("athlete_name") BETWEEN 1 AND 80) NOT VALID;
ALTER TABLE "registration_invites"
    ADD CONSTRAINT "registration_invites_state_check"
    CHECK (
        ("used_at" IS NULL AND "used_by_user_id" IS NULL)
        OR ("used_at" IS NOT NULL AND "used_by_user_id" IS NOT NULL)
    ) NOT VALID;
ALTER TABLE "guardian_consents"
    ADD CONSTRAINT "guardian_consents_text_length_check"
    CHECK (
        char_length("guardian_name") BETWEEN 1 AND 80
        AND char_length("guardian_relationship") BETWEEN 1 AND 40
        AND char_length("notice_version") BETWEEN 1 AND 80
    ) NOT VALID;

ALTER TABLE "users"
    VALIDATE CONSTRAINT "users_membership_status_check";
ALTER TABLE "registration_invites"
    VALIDATE CONSTRAINT "registration_invites_token_hash_check";
ALTER TABLE "registration_invites"
    VALIDATE CONSTRAINT "registration_invites_athlete_name_check";
ALTER TABLE "registration_invites"
    VALIDATE CONSTRAINT "registration_invites_state_check";
ALTER TABLE "guardian_consents"
    VALIDATE CONSTRAINT "guardian_consents_text_length_check";

COMMIT;
