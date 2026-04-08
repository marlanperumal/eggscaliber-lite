# Alembic — Database Migrations

This project uses Alembic with SQLModel. All migrations live in `apps/api/migrations/`.

## Commands

```bash
just db-migrate                    # upgrade to head (dev DB)
just db-migration "add users table" # autogenerate new migration
just test-api                      # runs 3 migration tests (required before committing)
```

## Adding a New Model

1. Create a SQLModel class with `table=True` in `apps/api/src/`
2. Import it in `apps/api/migrations/env.py` (follow the existing pattern)
3. Run `just db-migration "describe the change"`
4. **Review the generated file** — never commit without reading it
5. Run `just test-api` — all 3 migration tests must pass

```python
# migrations/env.py — import new models here so autogenerate detects them
from src.models.dataset import Dataset  # add imports like this
target_metadata = SQLModel.metadata
```

## Autogenerate: What It Detects

**Reliably detected:**
- Table additions and removals
- Column additions and removals
- Nullable changes
- Index and unique constraint changes
- Foreign key changes

**NOT detected — requires manual migration:**
- Table renames (shows as drop + add)
- Column renames (shows as drop + add)
- Anonymously named constraints
- CHECK, EXCLUDE constraints
- Sequence additions/removals

## Writing Migrations

Always implement both `upgrade()` and `downgrade()`. The downgrade is tested in CI:

```python
def upgrade() -> None:
    op.create_table(
        "dataset",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

def downgrade() -> None:
    op.drop_table("dataset")
```

## Naming Constraints Explicitly

Always name constraints explicitly — anonymous names prevent autogenerate from detecting changes:

```python
# In SQLModel
class Dataset(SQLModel, table=True):
    name: str = Field(
        sa_column=Column(String, unique=True, name="uq_dataset_name")
    )
```

## Column/Table Renames

Autogenerate can't detect renames — write manually:

```python
def upgrade() -> None:
    op.alter_column("dataset", "old_name", new_column_name="new_name")

def downgrade() -> None:
    op.alter_column("dataset", "new_name", new_column_name="old_name")
```

## pgvector Columns

For vector columns, autogenerate may not handle custom types. Add manually if needed:

```python
from pgvector.sqlalchemy import Vector

def upgrade() -> None:
    op.add_column("dataset", sa.Column("embedding", Vector(1536), nullable=True))

def downgrade() -> None:
    op.drop_column("dataset", "embedding")
```

## Migration Tests (Required)

Three tests run in CI and locally via `just test-api`:

1. `test_single_migration_head` — no branching history
2. `test_no_pending_model_changes` — all model changes have a migration
3. `test_migration_upgrade_downgrade_cycle` — full up→down→up on the migrations test DB

All three must pass before committing any migration.

## Gotchas

- Autogenerate is not intended to be perfect — **always review** generated migrations
- `alembic check` returns a non-zero exit code if there are pending model changes (useful in CI)
- Type changes are detected by default since Alembic v1.12.0 (`compare_type=True`)
- Server default comparison is unreliable — don't rely on autogenerate for server defaults
- Never commit a migration with only `pass` in `downgrade()` unless the operation is genuinely irreversible (e.g., dropping data)
