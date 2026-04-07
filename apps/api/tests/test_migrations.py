import pytest
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
from src.config import settings

ALEMBIC_CFG_PATH = "alembic.ini"


@pytest.fixture(scope="module")
def alembic_config():
    return Config(ALEMBIC_CFG_PATH)


@pytest.fixture(scope="module")
def migrations_engine():
    """Dedicated engine for the upgrade/downgrade cycle test.

    Uses eggscaliber_migrations_test so the cycle does not disrupt the
    main test DB that other tests rely on being at head.
    """
    eng = create_engine(settings.migrations_test_database_url)
    yield eng
    eng.dispose()


def test_single_migration_head(alembic_config):
    """Migration history must be linear — exactly one head (or zero if no migrations exist)."""
    script = ScriptDirectory.from_config(alembic_config)
    heads = script.get_heads()
    assert len(heads) <= 1, (
        f"Expected at most 1 migration head, found {len(heads)}: {heads}. "
        "This usually means two branches were merged without resolving Alembic heads. "
        "Run: alembic merge heads -m 'merge heads'"
    )


def test_no_pending_model_changes(alembic_config):
    """All SQLModel model changes must have a corresponding Alembic migration.

    Assumes the test DB (eggscaliber_test) has already been upgraded to head
    before the test suite runs. CI does this via 'just db-migrate' before pytest.
    """
    try:
        command.check(alembic_config)
    except SystemExit as exc:
        pytest.fail(
            f"Models have changes not reflected in migrations. "
            f"Run 'just db-migration <name>' to generate one. Details: {exc}"
        )


def test_migration_upgrade_downgrade_cycle(alembic_config, migrations_engine):
    """Full upgrade → downgrade → upgrade cycle on the dedicated migrations test DB."""
    # Point alembic at the migrations test DB for this test only
    cycle_config = Config(ALEMBIC_CFG_PATH)
    cycle_config.set_main_option("sqlalchemy.url", settings.migrations_test_database_url)

    command.upgrade(cycle_config, "head")
    command.downgrade(cycle_config, "base")
    command.upgrade(cycle_config, "head")

    # Verify we landed at the expected head
    with migrations_engine.connect() as conn:
        context = MigrationContext.configure(conn)
        current_heads = set(context.get_current_heads())

    script = ScriptDirectory.from_config(cycle_config)
    expected_heads = set(script.get_heads())
    assert current_heads == expected_heads, (
        f"After full cycle, expected heads {expected_heads}, got {current_heads}. "
        "A downgrade() method likely does not reverse its upgrade() correctly."
    )
