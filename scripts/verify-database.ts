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
        'registration_invites',
        'guardian_consents',
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

    const userColumns = await pool.query<{
        column_name: string;
        is_nullable: string;
        column_default: string | null;
        udt_name: string;
    }>(
        `SELECT column_name, is_nullable, column_default, udt_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users'`,
    );
    const userColumnMap = new Map(userColumns.rows.map((row) => [row.column_name, row]));
    const membershipStatusColumn = userColumnMap.get('membership_status');
    if (!membershipStatusColumn) throw new Error('users.membership_status is missing');
    if (membershipStatusColumn.is_nullable !== 'NO') {
        throw new Error('users.membership_status must be required');
    }
    if (membershipStatusColumn.udt_name !== 'MembershipStatus') {
        throw new Error('users.membership_status has an invalid type');
    }
    if (!membershipStatusColumn.column_default?.includes('ACTIVE')) {
        throw new Error('users.membership_status ACTIVE default is missing');
    }
    const withdrawnAtColumn = userColumnMap.get('withdrawn_at');
    if (!withdrawnAtColumn) throw new Error('users.withdrawn_at is missing');
    if (withdrawnAtColumn.is_nullable !== 'YES') {
        throw new Error('users.withdrawn_at must be nullable');
    }
    for (const nameColumn of ['family_name', 'given_name']) {
        const column = userColumnMap.get(nameColumn);
        if (!column) throw new Error(`users.${nameColumn} is missing`);
        if (column.is_nullable !== 'YES') {
            throw new Error(`users.${nameColumn} must remain nullable for legacy members`);
        }
    }

    const membershipStatusEnum = await pool.query<{ enumlabel: string }>(
        `SELECT e.enumlabel
           FROM pg_type t
           JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'MembershipStatus'
          ORDER BY e.enumsortorder`,
    );
    if (membershipStatusEnum.rows.map((row) => row.enumlabel).join(',') !== 'ACTIVE,WITHDRAWN') {
        throw new Error('MembershipStatus enum is missing or invalid');
    }

    const registrationInviteColumns = await pool.query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'registration_invites'`,
    );
    const registrationInviteColumnNames = new Set(
        registrationInviteColumns.rows.map((row) => row.column_name),
    );
    const requiredRegistrationInviteColumns = [
        'id',
        'token_hash',
        'athlete_name',
        'created_by_id',
        'used_by_user_id',
        'expires_at',
        'used_at',
        'revoked_at',
        'created_at',
    ];
    for (const column of requiredRegistrationInviteColumns) {
        if (!registrationInviteColumnNames.has(column)) {
            throw new Error(`registration_invites.${column} is missing`);
        }
    }

    const guardianConsentColumns = await pool.query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'guardian_consents'`,
    );
    const guardianConsentColumnNames = new Set(
        guardianConsentColumns.rows.map((row) => row.column_name),
    );
    const requiredGuardianConsentColumns = [
        'id',
        'user_id',
        'guardian_name',
        'guardian_relationship',
        'notice_version',
        'accepted_at',
    ];
    for (const column of requiredGuardianConsentColumns) {
        if (!guardianConsentColumnNames.has(column)) {
            throw new Error(`guardian_consents.${column} is missing`);
        }
    }

    const dailyColumns = await pool.query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'daily_logs'`,
    );
    if (!dailyColumns.rows.some((row) => row.column_name === 'revision')) {
        throw new Error('daily_logs.revision is missing');
    }
    const dailyColumnNames = new Set(dailyColumns.rows.map((row) => row.column_name));
    if (!dailyColumnNames.has('activity_type')) {
        throw new Error('daily_logs.activity_type is missing');
    }
    if (!dailyColumnNames.has('practiced')) {
        throw new Error('daily_logs.practiced compatibility column is missing');
    }

    const activityEnum = await pool.query<{ enumlabel: string }>(
        `SELECT e.enumlabel
           FROM pg_type t
           JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'DailyActivityType'
          ORDER BY e.enumsortorder`,
    );
    if (activityEnum.rows.map((row) => row.enumlabel).join(',') !== 'PRACTICE,COMPETITION,REST') {
        throw new Error('DailyActivityType enum is missing or invalid');
    }

    const activitySyncTrigger = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM pg_trigger
          WHERE tgname = 'daily_logs_sync_activity_type_from_practiced'
            AND NOT tgisinternal`,
    );
    if (activitySyncTrigger.rows[0]?.count !== '1') {
        throw new Error('Daily activity compatibility trigger is missing');
    }

    const requiredConstraints = [
        'daily_logs_score_check',
        'daily_logs_revision_check',
        'daily_logs_text_length_check',
        'daily_logs_activity_practiced_check',
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
        'users_membership_status_check',
        'users_real_name_pair_check',
        'registration_invites_token_hash_check',
        'registration_invites_athlete_name_check',
        'registration_invites_state_check',
        'guardian_consents_text_length_check',
        'registration_invites_created_by_id_fkey',
        'registration_invites_used_by_user_id_fkey',
        'guardian_consents_user_id_fkey',
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

    const requiredValidatedConstraints = [
        'users_membership_status_check',
        'users_real_name_pair_check',
        'registration_invites_token_hash_check',
        'registration_invites_athlete_name_check',
        'registration_invites_state_check',
        'guardian_consents_text_length_check',
    ];
    const validatedConstraints = await pool.query<{ conname: string; convalidated: boolean }>(
        `SELECT conname, convalidated
           FROM pg_constraint
          WHERE conname = ANY($1::text[])`,
        [requiredValidatedConstraints],
    );
    const validationMap = new Map(
        validatedConstraints.rows.map((row) => [row.conname, row.convalidated]),
    );
    for (const constraint of requiredValidatedConstraints) {
        if (validationMap.get(constraint) !== true) {
            throw new Error(`Database constraint is not validated: ${constraint}`);
        }
    }

    const requiredIndexes = new Map<string, boolean>([
        ['registration_invites_token_hash_key', true],
        ['registration_invites_used_by_user_id_key', true],
        ['registration_invites_created_at_idx', false],
        ['registration_invites_expires_at_idx', false],
        ['guardian_consents_user_id_key', true],
        ['guardian_consents_accepted_at_idx', false],
    ]);
    const indexes = await pool.query<{ index_name: string; is_unique: boolean }>(
        `SELECT index_class.relname AS "index_name", index_data.indisunique AS "is_unique"
           FROM pg_index index_data
           JOIN pg_class index_class ON index_class.oid = index_data.indexrelid
           JOIN pg_namespace index_namespace ON index_namespace.oid = index_class.relnamespace
          WHERE index_namespace.nspname = 'public'
            AND index_class.relname = ANY($1::text[])`,
        [[...requiredIndexes.keys()]],
    );
    const indexMap = new Map(indexes.rows.map((row) => [row.index_name, row.is_unique]));
    for (const [indexName, shouldBeUnique] of requiredIndexes) {
        if (!indexMap.has(indexName)) throw new Error(`Database index is missing: ${indexName}`);
        if (indexMap.get(indexName) !== shouldBeUnique) {
            throw new Error(`Database index uniqueness is invalid: ${indexName}`);
        }
    }

    const legacySingletonGoalIndex = await pool.query<{ index_name: string | null }>(
        'SELECT to_regclass($1)::text AS index_name',
        ['public.competition_goals_one_active_singleton_per_user_key'],
    );
    if (legacySingletonGoalIndex.rows[0]?.index_name) {
        throw new Error('Legacy competition goal singleton index still exists');
    }

    console.log('Database schema verified.');
}

main()
    .finally(() => pool.end())
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
