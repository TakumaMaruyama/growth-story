-- Remove the retired feature from the active schema without destroying historical data.
-- Moving the archive outside public also keeps future Prisma migrations from treating it
-- as unmanaged drift. A separate, explicitly approved retention job may purge it later.
BEGIN;

CREATE SCHEMA IF NOT EXISTS "archive";

ALTER TABLE "growth_measurements" RENAME TO "archived_growth_measurements";
ALTER TABLE "growth_profiles" RENAME TO "archived_growth_profiles";
ALTER TYPE "Sex" RENAME TO "ArchivedGrowthSex";

ALTER TABLE "archived_growth_measurements" SET SCHEMA "archive";
ALTER TABLE "archived_growth_profiles" SET SCHEMA "archive";
ALTER TYPE "ArchivedGrowthSex" SET SCHEMA "archive";

ALTER TABLE "archive"."archived_growth_measurements"
    RENAME CONSTRAINT "growth_measurements_pkey" TO "archived_growth_measurements_pkey";
ALTER TABLE "archive"."archived_growth_measurements"
    RENAME CONSTRAINT "growth_measurements_user_id_fkey" TO "archived_growth_measurements_user_id_fkey";
ALTER TABLE "archive"."archived_growth_profiles"
    RENAME CONSTRAINT "growth_profiles_pkey" TO "archived_growth_profiles_pkey";
ALTER TABLE "archive"."archived_growth_profiles"
    RENAME CONSTRAINT "growth_profiles_user_id_fkey" TO "archived_growth_profiles_user_id_fkey";

-- Archived records must not disappear as a side effect of a future account
-- deletion. Any purge or anonymization now requires a separate, explicit step.
ALTER TABLE "archive"."archived_growth_measurements"
    DROP CONSTRAINT "archived_growth_measurements_user_id_fkey";
ALTER TABLE "archive"."archived_growth_measurements"
    ADD CONSTRAINT "archived_growth_measurements_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "archive"."archived_growth_profiles"
    DROP CONSTRAINT "archived_growth_profiles_user_id_fkey";
ALTER TABLE "archive"."archived_growth_profiles"
    ADD CONSTRAINT "archived_growth_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER INDEX "archive"."growth_measurements_user_id_measured_on_idx"
    RENAME TO "archived_growth_measurements_user_id_measured_on_idx";
ALTER INDEX "archive"."growth_measurements_user_id_measured_on_key"
    RENAME TO "archived_growth_measurements_user_id_measured_on_key";
ALTER INDEX "archive"."growth_profiles_user_id_key"
    RENAME TO "archived_growth_profiles_user_id_key";

COMMENT ON TABLE "archive"."archived_growth_measurements" IS
    'Application-inaccessible archive retained after removal of the retired feature.';
COMMENT ON TABLE "archive"."archived_growth_profiles" IS
    'Application-inaccessible archive retained after removal of the retired feature.';

COMMIT;
