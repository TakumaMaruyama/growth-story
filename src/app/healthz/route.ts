import { Pool } from 'pg';
import { jsonResponse } from '@/lib/request';

export const dynamic = 'force-dynamic';

interface ErrorIdentity {
  name: string | null;
  code: string | null;
}

function identifyError(value: unknown): ErrorIdentity {
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return {
      name: value.name || null,
      code: typeof code === 'string' ? code : null,
    };
  }
  return { name: null, code: null };
}

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  const databaseUrlPresent = Boolean(databaseUrl);

  if (!databaseUrl) {
    return jsonResponse({ databaseUrlPresent, ok: false, error: null, cause: null }, 500);
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const result = await pool.query(
      `SELECT
         1 AS ok,
         current_setting('transaction_read_only') AS read_only,
         has_table_privilege(current_user, 'public.users', 'SELECT,INSERT') AS users_rw,
         has_table_privilege(current_user, 'public.rate_limit_events', 'SELECT,INSERT,DELETE') AS rate_limit_rw`,
    );
    const row = result.rows[0] ?? {};
    return jsonResponse({
      databaseUrlPresent,
      ok: row.ok === 1,
      readOnly: row.read_only ?? null,
      usersRw: row.users_rw ?? null,
      rateLimitRw: row.rate_limit_rw ?? null,
    });
  } catch (error) {
    const err = identifyError(error);
    const cause = identifyError(error instanceof Error ? error.cause : undefined);
    return jsonResponse({ databaseUrlPresent, ok: false, error: err, cause }, 500);
  } finally {
    await pool.end().catch(() => undefined);
  }
}
