---
name: Prod SQL tool quirks
description: How to query the production DB reliably with the executeSql callback (snake_case columns, quoted-identifier failure mode)
---
- DB physical column names are snake_case (Prisma `@map`), e.g. `password_hash`, `login_id`, `family_name` — even though Prisma models use camelCase.
- The `executeSql` runner silently fails on queries containing double-quoted identifiers: output is only `START TRANSACTION / ROLLBACK` with success=true, no result rows. **How to apply:** never use `"camelCase"` quoted identifiers; use the real snake_case column names unquoted. Verify column names via information_schema if unsure.
- `pg_stat_user_tables.n_live_tup` can be stale/zero and can list dropped tables; use `count(*)` and `pg_tables` for truth.
- Besides `public`, prod has an `archive` schema (archived_growth_measurements/profiles) not in the Prisma schema.
