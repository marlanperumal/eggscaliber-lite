import pytest
from src.config import _to_asyncpg_url


@pytest.mark.parametrize(
    "input_url, expected",
    [
        (
            "postgresql://user:pass@ep-xyz.neon.tech/dbname?sslmode=require",
            "postgresql+asyncpg://user:pass@ep-xyz.neon.tech/dbname?ssl=require",
        ),
        (
            "postgres://user:pass@ep-xyz.neon.tech/dbname?sslmode=require",
            "postgresql+asyncpg://user:pass@ep-xyz.neon.tech/dbname?ssl=require",
        ),
        (
            "postgresql://postgres:postgres@localhost:5432/eggscaliber_dev",
            "postgresql+asyncpg://postgres:postgres@localhost:5432/eggscaliber_dev",
        ),
        (
            "postgresql://user:pass@ep-xyz.neon.tech/dbname?sslmode=require&channel_binding=require",
            "postgresql+asyncpg://user:pass@ep-xyz.neon.tech/dbname?ssl=require",
        ),
        (
            "postgresql://user:pass@ep-xyz.neon.tech/dbname?channel_binding=require&sslmode=require",
            "postgresql+asyncpg://user:pass@ep-xyz.neon.tech/dbname?ssl=require",
        ),
    ],
    ids=[
        "neon-postgresql",
        "neon-postgres",
        "local-no-ssl",
        "channel-binding-after",
        "channel-binding-before",
    ],
)
def test_to_asyncpg_url(input_url, expected):
    assert _to_asyncpg_url(input_url) == expected
