# Migration Safety Patterns

Supplement to the Alembic setup in `docs/patterns/infrastructure.md`. This guide
covers which schema changes are safe to apply directly and which require a
multi-step strategy to avoid data loss or downtime.

## Reversible vs Irreversible

### Safe — apply in one migration

| Change | Notes |
|--------|-------|
| Add nullable column (`nullable=True` or Python `\| None`) | Default is `NULL`; no data at risk |
| Add index | Non-blocking on Postgres with `CONCURRENTLY` (add manually in migration) |
| Add table | No existing data |
| Rename table | Test `downgrade()` locally — Alembic may not auto-detect renames |
| Increase column width | Safe for text columns |

### Requires multi-step strategy

**Dropping a column** — data is permanently lost on `upgrade()`:
1. Confirm the column is unused in application code (grep across `apps/api/src/`)
2. Document a retention decision in the commit message (e.g. "data archived to S3 before drop" or "column was always NULL")
3. Only then generate the migration

**Adding a NOT NULL column to a non-empty table** — `ALTER TABLE` will fail if existing rows cannot satisfy the constraint:

```
# Step 1: Add nullable column with application-level default
# Step 2: Backfill existing rows (in a separate migration or an op.execute)
# Step 3: Add NOT NULL constraint in a third migration
```

Example (three-migration approach):
```python
# migration 001: add nullable
op.add_column("dataset", sa.Column("slug", sa.String(), nullable=True))

# migration 002: backfill
op.execute("UPDATE dataset SET slug = lower(regexp_replace(name, '[^a-z0-9]+', '-', 'g')) WHERE slug IS NULL")

# migration 003: constrain
op.alter_column("dataset", "slug", nullable=False)
```

**Renaming a column** — requires coordinated deploy (old name in code, migration, new name in code):
1. Add new column, copy data, update code to write both, deploy
2. Migration: drop old column
3. Code update: remove old-column writes

## Migration Checklist

Before every migration commit:

- [ ] `downgrade()` reverses `upgrade()` exactly — tested locally with `just db-reset`
- [ ] If dropping a column: retention decision documented in commit message
- [ ] If adding NOT NULL: backfill migration exists and ran before constraint migration
- [ ] `just test-api` passes (all 3 migration tests green)
- [ ] For tables with > 1 M rows: tested on a production clone or with `CONCURRENTLY`

## Alembic Autogenerate Gaps

Alembic cannot auto-detect these changes — write them manually in the migration:

- Table or column renames (`op.rename_table`, `op.alter_column(new_column_name=...)`)
- `CREATE INDEX CONCURRENTLY` (autogenerate emits a blocking `CREATE INDEX`)
- Partial indexes (`WHERE` clause)
- Custom Postgres types, sequences, or triggers

## Running Migrations

```bash
just db-migration "describe the change"   # generate from model diff
just db-migrate                            # apply pending migrations
just db-reset                              # wipe + remigrate from scratch (dev only)
```

After any migration: `just test-api` to confirm all 3 migration tests pass.
