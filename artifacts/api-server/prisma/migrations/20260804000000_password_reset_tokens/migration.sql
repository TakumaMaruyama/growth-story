BEGIN;

CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key"
    ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_created_at_idx"
    ON "password_reset_tokens"("user_id", "created_at" DESC);
CREATE INDEX "password_reset_tokens_expires_at_idx"
    ON "password_reset_tokens"("expires_at");

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_token_hash_check"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$') NOT VALID;
ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_lifetime_check"
    CHECK (
        "expires_at" > "created_at"
        AND "expires_at" <= "created_at" + INTERVAL '2 days'
    ) NOT VALID;
ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_state_check"
    CHECK (
        NOT ("used_at" IS NOT NULL AND "revoked_at" IS NOT NULL)
        AND ("used_at" IS NULL OR ("used_at" >= "created_at" AND "used_at" <= "expires_at"))
        AND ("revoked_at" IS NULL OR "revoked_at" >= "created_at")
    ) NOT VALID;

ALTER TABLE "password_reset_tokens"
    VALIDATE CONSTRAINT "password_reset_tokens_token_hash_check";
ALTER TABLE "password_reset_tokens"
    VALIDATE CONSTRAINT "password_reset_tokens_lifetime_check";
ALTER TABLE "password_reset_tokens"
    VALIDATE CONSTRAINT "password_reset_tokens_state_check";

COMMIT;
