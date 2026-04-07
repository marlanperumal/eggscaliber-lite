from pydantic_settings import BaseSettings, SettingsConfigDict


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

    auth_mode: str = "dev"
    dev_jwt_secret: str = "dev-secret-change-in-production"

    sentry_dsn: str | None = None
    environment: str = "development"


settings = Settings()
