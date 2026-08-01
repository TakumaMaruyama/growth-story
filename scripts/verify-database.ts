import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
    const requiredTables = [
        'users',
        'sessions',
        'daily_logs',
        'competition_goals',
        'story_versions',
        'story_answers',
        'rate_limit_events',
        'admin_audit_events',
    ];
    const archivedTables = ['archived_growth_profiles', 'archived_growth_measurements'];
    const removedTables = ['growth_profiles', 'growth_measurements'];

    for (const table of requiredTables) {
        const result = await pool.query<{ table_name: string | null }>(
            'SELECT to_regclass($1)::text AS table_name',
            [`public.${table}`],
        );
        if (!result.rows[0]?.table_name) throw new Error(`Required table is missing: ${table}`);
    }

    for (const table of archivedTables) {
        const result = await pool.query<{ table_name: string | null }>(
            'SELECT to_regclass($1)::text AS table_name',
            [`archive.${table}`],
        );
        if (!result.rows[0]?.table_name) throw new Error(`Archived table is missing: ${table}`);
    }

    for (const table of removedTables) {
        const result = await pool.query<{ table_name: string | null }>(
            'SELECT to_regclass($1)::text AS table_name',
            [`public.${table}`],
        );
        if (result.rows[0]?.table_name) throw new Error(`Removed table still exists: ${table}`);
    }

    const removedEnum = await pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM pg_type WHERE typname = $1',
        ['Sex'],
    );
    if (removedEnum.rows[0]?.count !== '0') throw new Error('Active enum still exists: Sex');

    const archivedEnum = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = $1 AND n.nspname = 'archive'`,
        ['ArchivedGrowthSex'],
    );
    if (archivedEnum.rows[0]?.count !== '1') throw new Error('Archived enum is missing: ArchivedGrowthSex');

    const sessionColumns = await pool.query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'sessions'`,
    );
    const sessionColumnNames = new Set(sessionColumns.rows.map((row) => row.column_name));
    if (!sessionColumnNames.has('token_hash')) throw new Error('sessions.token_hash is missing');
    if (sessionColumnNames.has('token')) throw new Error('Plaintext sessions.token still exists');

    const dailyColumns = await pool.query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'daily_logs'`,
    );
    if (!dailyColumns.rows.some((row) => row.column_name === 'revision')) {
        throw new Error('daily_logs.revision is missing');
    }

    const requiredConstraints = [
        'daily_logs_score_check',
        'daily_logs_revision_check',
        'daily_logs_text_length_check',
        'story_answers_question_no_check',
        'story_answers_text_length_check',
        'story_versions_note_length_check',
        'competition_goals_revision_check',
        'competition_goals_title_length_check',
        'competition_goals_details_length_check',
        'competition_goals_target_date_check',
        'competition_goals_required_date_check',
        'competition_goals_annual_year_check',
        'competition_goals_active_archive_check',
    ];
    const constraints = await pool.query<{ conname: string }>(
        `SELECT conname
           FROM pg_constraint
          WHERE conname = ANY($1::text[])`,
        [requiredConstraints],
    );
    const constraintNames = new Set(constraints.rows.map((row) => row.conname));
    for (const constraint of requiredConstraints) {
        if (!constraintNames.has(constraint)) throw new Error(`Database constraint is missing: ${constraint}`);
    }

    const singletonGoalIndex = await pool.query<{ index_name: string | null }>(
        'SELECT to_regclass($1)::text AS index_name',
        ['public.competition_goals_one_active_singleton_per_user_key'],
    );
    if (!singletonGoalIndex.rows[0]?.index_name) {
        throw new Error('Competition goal singleton index is missing');
    }

    console.log('Database schema verified.');
}

main()
    .finally(() => pool.end())
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
