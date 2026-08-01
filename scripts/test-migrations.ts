import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (
    process.env.ALLOW_INTEGRATION_DB_TESTS !== '1'
    || !databaseUrl
    || !new URL(databaseUrl).pathname.endsWith('_test')
) {
    throw new Error(
        'Refusing to test migrations without ALLOW_INTEGRATION_DB_TESTS=1 and a *_test database',
    );
}
const integrationDatabaseUrl = databaseUrl;

const migrationDatabase = `swim_story_migration_${randomUUID().slice(0, 8)}_test`;
const quotedMigrationDatabase = `"${migrationDatabase}"`;
const maintenanceUrl = new URL(integrationDatabaseUrl);
maintenanceUrl.pathname = '/postgres';
maintenanceUrl.search = '';

const maintenancePool = new Pool({ connectionString: maintenanceUrl.toString(), max: 1 });
let migrationPool: Pool | null = null;
let databaseCreated = false;

async function applyMigration(pool: Pool, directory: string) {
    const sql = await readFile(
        path.join(process.cwd(), 'prisma', 'migrations', directory, 'migration.sql'),
        'utf8',
    );
    await pool.query(sql);
}

function postgresErrorCode(error: unknown): string | null {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && typeof error.code === 'string'
        ? error.code
        : null;
}

async function main() {
    await maintenancePool.query(`CREATE DATABASE ${quotedMigrationDatabase}`);
    databaseCreated = true;

    const targetUrl = new URL(integrationDatabaseUrl);
    targetUrl.pathname = `/${migrationDatabase}`;
    targetUrl.search = '';
    migrationPool = new Pool({ connectionString: targetUrl.toString(), max: 1 });

    await applyMigration(migrationPool, '20260213011004_init');

    const userId = randomUUID();
    await migrationPool.query(
        `INSERT INTO "users"
            ("id", "login_id", "display_name", "password_hash", "updated_at")
         VALUES ($1, $2, 'Migration test', 'not-used', CURRENT_TIMESTAMP)`,
        [userId, `migration_${randomUUID()}`],
    );
    await migrationPool.query(
        `INSERT INTO "sessions" ("id", "user_id", "token", "expires_at")
         VALUES ($1, $2, 'legacy-plaintext-token', CURRENT_TIMESTAMP + INTERVAL '1 day')`,
        [randomUUID(), userId],
    );
    await migrationPool.query(
        `INSERT INTO "daily_logs"
            ("id", "user_id", "log_date", "score", "updated_at")
         VALUES ($1, $2, DATE '2026-07-31', 7, CURRENT_TIMESTAMP)`,
        [randomUUID(), userId],
    );
    await migrationPool.query(
        `INSERT INTO "growth_profiles"
            ("id", "user_id", "sex", "birth_date", "father_height_cm", "mother_height_cm", "updated_at")
         VALUES ($1, $2, 'MALE', DATE '2012-04-05', 178.5, 164.25, CURRENT_TIMESTAMP)`,
        [randomUUID(), userId],
    );
    await migrationPool.query(
        `INSERT INTO "growth_measurements"
            ("id", "user_id", "measured_on", "height_cm", "weight_kg", "sitting_height_cm")
         VALUES ($1, $2, DATE '2026-07-31', 170.25, 58.5, 91.75)`,
        [randomUUID(), userId],
    );

    await applyMigration(migrationPool, '20260801000000_hash_session_tokens');
    await applyMigration(migrationPool, '20260801000100_remove_growth_features');
    await applyMigration(migrationPool, '20260801000200_harden_security');
    await applyMigration(migrationPool, '20260801000300_competition_goals');

    await migrationPool.query(
        `INSERT INTO "competition_goals"
            ("id", "user_id", "goal_type", "title", "target_date", "updated_at")
         VALUES ($1, $2, 'NEXT_MEET', 'First next meet', NULL, CURRENT_TIMESTAMP)`,
        [randomUUID(), userId],
    );
    await assert.rejects(
        migrationPool.query(
            `INSERT INTO "competition_goals"
                ("id", "user_id", "goal_type", "title", "updated_at")
             VALUES ($1, $2, 'NEXT_MEET', 'Duplicate next meet', CURRENT_TIMESTAMP)`,
            [randomUUID(), userId],
        ),
        (error: unknown) => postgresErrorCode(error) === '23505',
    );
    await assert.rejects(
        migrationPool.query(
            `INSERT INTO "competition_goals"
                ("id", "user_id", "goal_type", "title", "updated_at")
             VALUES ($1, $2, 'ANNUAL', 'Missing target year', CURRENT_TIMESTAMP)`,
            [randomUUID(), userId],
        ),
        (error: unknown) => postgresErrorCode(error) === '23514',
    );
    await assert.rejects(
        migrationPool.query(
            `INSERT INTO "competition_goals"
                ("id", "user_id", "goal_type", "title", "target_date", "updated_at")
             VALUES ($1, $2, 'ANNUAL', 'Invalid target year', DATE '2026-08-01', CURRENT_TIMESTAMP)`,
            [randomUUID(), userId],
        ),
        (error: unknown) => postgresErrorCode(error) === '23514',
    );

    const archivedProfile = await migrationPool.query<{
        sex: string;
        father_height_cm: number;
        mother_height_cm: number;
    }>(
        `SELECT "sex"::text, "father_height_cm", "mother_height_cm"
           FROM "archive"."archived_growth_profiles"
          WHERE "user_id" = $1`,
        [userId],
    );
    assert.deepEqual(archivedProfile.rows, [{
        sex: 'MALE',
        father_height_cm: 178.5,
        mother_height_cm: 164.25,
    }]);

    const archivedMeasurement = await migrationPool.query<{
        height_cm: number;
        weight_kg: number;
        sitting_height_cm: number;
    }>(
        `SELECT "height_cm", "weight_kg", "sitting_height_cm"
           FROM "archive"."archived_growth_measurements"
          WHERE "user_id" = $1`,
        [userId],
    );
    assert.deepEqual(archivedMeasurement.rows, [{
        height_cm: 170.25,
        weight_kg: 58.5,
        sitting_height_cm: 91.75,
    }]);

    const invariants = await migrationPool.query<{
        sessions: number;
        revision: number;
        competitionGoals: number;
        active_growth_tables: number;
    }>(
        `SELECT
            (SELECT count(*)::integer FROM "sessions") AS "sessions",
            (SELECT "revision" FROM "daily_logs" WHERE "user_id" = $1) AS "revision",
            (SELECT count(*)::integer FROM "competition_goals" WHERE "user_id" = $1) AS "competitionGoals",
            (SELECT count(*)::integer
               FROM information_schema.tables
              WHERE table_schema = 'public'
                AND table_name IN ('growth_profiles', 'growth_measurements')) AS "active_growth_tables"`,
        [userId],
    );
    assert.deepEqual(invariants.rows, [{
        sessions: 0,
        revision: 1,
        competitionGoals: 1,
        active_growth_tables: 0,
    }]);

    await assert.rejects(
        migrationPool.query('DELETE FROM "users" WHERE "id" = $1', [userId]),
        (error: unknown) => postgresErrorCode(error) === '23503',
    );
    const retainedRows = await migrationPool.query<{ count: number }>(
        `SELECT (
            (SELECT count(*) FROM "archive"."archived_growth_profiles" WHERE "user_id" = $1)
            + (SELECT count(*) FROM "archive"."archived_growth_measurements" WHERE "user_id" = $1)
         )::integer AS "count"`,
        [userId],
    );
    assert.equal(retainedRows.rows[0]?.count, 2);

    console.log('Migration preservation test passed.');
}

main()
    .finally(async () => {
        await migrationPool?.end();
        if (databaseCreated) {
            await maintenancePool.query(`DROP DATABASE ${quotedMigrationDatabase} WITH (FORCE)`);
        }
        await maintenancePool.end();
    })
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
