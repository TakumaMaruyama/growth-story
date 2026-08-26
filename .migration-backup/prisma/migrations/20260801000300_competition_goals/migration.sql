BEGIN;

CREATE TYPE "CompetitionGoalType" AS ENUM ('NEXT_MEET', 'ANNUAL', 'MILESTONE');

CREATE TABLE "competition_goals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "goal_type" "CompetitionGoalType" NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "target_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "competition_goals_user_id_is_active_updated_at_idx"
    ON "competition_goals"("user_id", "is_active", "updated_at" DESC);
CREATE INDEX "competition_goals_user_id_goal_type_is_active_idx"
    ON "competition_goals"("user_id", "goal_type", "is_active");

-- A swimmer can have only one current next-meet goal and one current annual goal.
-- Milestone goals deliberately remain one-to-many.
CREATE UNIQUE INDEX "competition_goals_one_active_singleton_per_user_key"
    ON "competition_goals"("user_id", "goal_type")
    WHERE "is_active" = true AND "goal_type" IN ('NEXT_MEET', 'ANNUAL');

ALTER TABLE "competition_goals"
    ADD CONSTRAINT "competition_goals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competition_goals"
    ADD CONSTRAINT "competition_goals_revision_check"
    CHECK ("revision" >= 1);
ALTER TABLE "competition_goals"
    ADD CONSTRAINT "competition_goals_title_length_check"
    CHECK (char_length("title") BETWEEN 1 AND 120);
ALTER TABLE "competition_goals"
    ADD CONSTRAINT "competition_goals_details_length_check"
    CHECK ("details" IS NULL OR char_length("details") <= 2000);
ALTER TABLE "competition_goals"
    ADD CONSTRAINT "competition_goals_target_date_check"
    CHECK (
        "target_date" IS NULL
        OR "target_date" BETWEEN DATE '1970-01-01' AND DATE '2100-12-31'
    );
ALTER TABLE "competition_goals"
    ADD CONSTRAINT "competition_goals_required_date_check"
    CHECK ("goal_type" = 'NEXT_MEET' OR "target_date" IS NOT NULL);
ALTER TABLE "competition_goals"
    ADD CONSTRAINT "competition_goals_annual_year_check"
    CHECK (
        "goal_type" <> 'ANNUAL'
        OR (
            EXTRACT(MONTH FROM "target_date") = 12
            AND EXTRACT(DAY FROM "target_date") = 31
        )
    );
ALTER TABLE "competition_goals"
    ADD CONSTRAINT "competition_goals_active_archive_check"
    CHECK (
        ("is_active" = true AND "archived_at" IS NULL)
        OR ("is_active" = false AND "archived_at" IS NOT NULL)
    );

COMMIT;
