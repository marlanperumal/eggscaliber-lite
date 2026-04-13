from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from pydantic_settings import BaseSettings, SettingsConfigDict

# libpq-only params that asyncpg does not understand
_LIBPQ_ONLY = {"channel_binding", "sslmode"}


def _to_asyncpg_url(url: str) -> str:
    """Convert a standard postgresql:// URL to postgresql+asyncpg://, stripping
    libpq-only query params and mapping sslmode=require → ssl=require."""
    parsed = urlparse(url)
    scheme = "postgresql+asyncpg"
    params = parse_qs(parsed.query, keep_blank_values=True)

    ssl_mode = params.pop("sslmode", [None])[0]
    params.pop("channel_binding", None)
    if ssl_mode == "require":
        params["ssl"] = ["require"]

    new_query = urlencode({k: v[0] for k, v in params.items()})
    return urlunparse(parsed._replace(scheme=scheme, query=new_query))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://postgres:postgres@localhost:5432/eggscaliber_dev"
    test_database_url: str = "postgresql://postgres:postgres@localhost:5432/eggscaliber_test"
    migrations_test_database_url: str = (
        "postgresql://postgres:postgres@localhost:5432/eggscaliber_migrations_test"
    )

    @property
    def async_database_url(self) -> str:
        return _to_asyncpg_url(self.database_url)

    @property
    def async_test_database_url(self) -> str:
        return _to_asyncpg_url(self.test_database_url)

    @property
    def async_migrations_test_database_url(self) -> str:
        return _to_asyncpg_url(self.migrations_test_database_url)

    auth_mode: str = "dev"
    dev_jwt_secret: str = "dev-secret-change-in-production"

    sentry_dsn: str | None = None
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
