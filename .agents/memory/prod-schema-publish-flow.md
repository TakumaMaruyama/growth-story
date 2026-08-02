---
name: Prod schema via Publish flow
description: How production schema changes actually land for this Prisma + Replit-managed Postgres app
---
- Production schema changes are applied only by Replit's Publish flow (dev→prod schema diff at publish time). The agent's prod DB access is read-only; never script prod migrations.
- **Why:** Publish diffs actual schemas, so prod's `_prisma_migrations` table is NOT updated with dev migration rows — verify prod schema by checking columns/tables/constraints in information_schema/pg_constraint, not migration names.
- Publish cannot carry data backfills inside migrations. Pattern that worked: Phase A drops a validated CHECK + repairs rows via a temporary startup script in `start`; Phase B re-adds the constraint `NOT VALID` then `VALIDATE` and restores plain `next start`.
- **How to apply:** for any future migration that needs a data backfill on existing prod rows, use the two-phase publish pattern; confirm prod mismatch count is 0 before Phase B.
