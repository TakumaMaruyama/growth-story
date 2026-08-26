-- Phase A repaired legacy production rows before this constraint returns.
-- NOT VALID keeps the add step non-blocking; VALIDATE then proves every
-- existing row is aligned before this release is promoted.
ALTER TABLE "daily_logs"
ADD CONSTRAINT "daily_logs_activity_practiced_check"
CHECK ("practiced" = ("activity_type" <> 'REST'::"DailyActivityType"))
NOT VALID;

ALTER TABLE "daily_logs"
VALIDATE CONSTRAINT "daily_logs_activity_practiced_check";
