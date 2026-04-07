# Testing Standards

## Core Principles

**Integration-first.** Tests run against the real `eggscaliber_test` Postgres database — same container, different DB name. Never use SQLite. No dialect mismatch, full pgvector support.

**Test real behaviour.** Tests should catch real bugs. Do not write tests that only assert values you set up, or that verify internal functions were called.

**No unnecessary mocking.** Only mock at true external boundaries:
- External HTTP APIs (third-party services)
- Clerk authentication (in tests, use `AUTH_MODE=dev` and a dev JWT)
- Cloudflare R2 (use a test bucket or skip storage assertions in unit tests)

Never mock: the database, internal services, repositories.

## Transaction Rollback Isolation

Every test runs inside a transaction that is rolled back on teardown. This means:
- No test data leaks between tests
- Tests can run in parallel safely
- No `DELETE FROM` teardown needed

The fixtures in `apps/api/tests/conftest.py` implement this pattern. Use them — do not create your own engine/session fixtures.

## Fixture Scopes

| Fixture | Scope | Purpose |
| --- | --- | --- |
| `engine` | session | one engine for the whole test run |
| `db` | function | transaction-wrapped session, rolled back after each test |
| `client` | function | TestClient with `get_session` overridden to use `db` |

## Migration Tests

Three tests in `tests/test_migrations.py` run as part of every test suite:

1. `test_single_migration_head` — linear history, no branches
2. `test_no_pending_model_changes` — all model changes have a migration
3. `test_migration_upgrade_downgrade_cycle` — full cycle on dedicated migrations DB

These run in CI before any other tests (migrations are applied to `eggscaliber_test` first).

## Naming Conventions

```python
def test_<thing>_<condition>_<expected_outcome>():
    ...

# Examples:
def test_create_dataset_with_duplicate_name_raises_409(): ...
def test_health_returns_ok(): ...
def test_cross_tab_with_no_data_returns_empty_table(): ...
```

## Test Data

Use fixtures for frequently reused test data. Define them in `conftest.py` with `scope="function"` so they are rolled back with the transaction.

```python
@pytest.fixture
def sample_dataset(db):
    dataset = Dataset(name="test-dataset", description="For testing")
    db.add(dataset)
    db.flush()  # assigns ID without committing
    return dataset
```
