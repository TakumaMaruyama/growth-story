-- Add a three-way daily activity classification without removing the legacy
-- practiced flag, so older application instances remain compatible during rollout.
CREATE TYPE "DailyActivityType" AS ENUM ('PRACTICE', 'COMPETITION', 'REST');

ALTER TABLE "daily_logs"
ADD COLUMN "activity_type" "DailyActivityType" NOT NULL DEFAULT 'REST';

UPDATE "daily_logs"
SET "activity_type" = CASE
    WHEN "practiced" THEN 'PRACTICE'::"DailyActivityType"
    ELSE 'REST'::"DailyActivityType"
END;

-- Keep writes from an older app instance in sync while the new version rolls out.
-- New writes that explicitly change activity_type (including COMPETITION) win.
CREATE FUNCTION "sync_daily_log_activity_type_from_practiced"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."activity_type" = 'REST' AND NEW."practiced" THEN
            NEW."activity_type" := 'PRACTICE';
        END IF;
    ELSIF NEW."practiced" IS DISTINCT FROM OLD."practiced"
        AND NEW."activity_type" IS NOT DISTINCT FROM OLD."activity_type" THEN
        NEW."activity_type" := CASE
            WHEN NEW."practiced" THEN 'PRACTICE'::"DailyActivityType"
            ELSE 'REST'::"DailyActivityType"
        END;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "daily_logs_sync_activity_type_from_practiced"
BEFORE INSERT OR UPDATE ON "daily_logs"
FOR EACH ROW
EXECUTE FUNCTION "sync_daily_log_activity_type_from_practiced"();

ALTER TABLE "daily_logs"
ADD CONSTRAINT "daily_logs_activity_practiced_check"
CHECK ("practiced" = ("activity_type" <> 'REST'::"DailyActivityType"));
