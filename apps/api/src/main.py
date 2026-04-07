import sentry_sdk
from fastapi import FastAPI

from src.config import settings
from src.routes import health

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
    )

app = FastAPI(title="Eggscaliber-Lite API", version="0.1.0")

app.include_router(health.router, prefix="/api/v1")
