import pg from 'pg';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  const schema = await pool.query(`
    SELECT
      to_regclass('public.daily_logs') IS NOT NULL AS "hasDailyLogs",
      EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'daily_logs'
           AND column_name = 'activity_type'
      ) AS "hasActivityType"
  `);

  const state = schema.rows[0];
  if (!state?.hasDailyLogs || !state?.hasActivityType) {
    throw new Error('Production database is missing daily activity schema');
  }

  await pool.query('BEGIN');
  await pool.query("SET LOCAL lock_timeout = '5s'");
  await pool.query("SET LOCAL statement_timeout = '30s'");

  // Replit derives production migrations from the development schema, so a newly
  // added non-null enum column receives its default on legacy rows. Repair only
  // that compatibility mismatch; current COMPETITION rows remain untouched.
  const repaired = await pool.query(`
    UPDATE "daily_logs"
       SET "activity_type" = CASE
         WHEN "practiced" THEN 'PRACTICE'::"DailyActivityType"
         ELSE 'REST'::"DailyActivityType"
       END
     WHERE ("practiced" AND "activity_type" = 'REST'::"DailyActivityType")
        OR (NOT "practiced" AND "activity_type" <> 'REST'::"DailyActivityType")
  `);

  await pool.query('COMMIT');
  console.log(`Daily activity compatibility check complete (${repaired.rowCount ?? 0} repaired).`);
} catch (error) {
  await pool.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await pool.end();
}
