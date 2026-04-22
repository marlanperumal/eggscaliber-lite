import sentry_sdk
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastmcp import FastMCP
from fastmcp.server.providers.openapi import MCPType, RouteMap
from fastmcp.utilities.lifespan import combine_lifespans

from src.auth import get_current_user
from src.config import settings
from src.database import lifespan as db_lifespan
from src.errors import DomainError
from src.models.error import ErrorResponse
from src.routes import (
    admin as admin_router,
)
from src.routes import (
    ai,
    analytics,
    collections,
    datasets,
    groups,
    health,
    packages,
    scope,
    sentry,
    tokens,
    uploads,
    webhooks,
)
from src.routes import (
    org as org_router,
)

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
    )

app = FastAPI(title="Eggscaliber-Lite API", version="0.1.0", lifespan=db_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    detail = exc.code.replace("_", " ").capitalize()
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(status=exc.status_code, code=exc.code, detail=detail).model_dump(),
    )


app.include_router(admin_router.router, prefix="/api/v1")
app.include_router(org_router.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(health.router, prefix="/api/v1")
app.include_router(sentry.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(packages.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(scope.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(collections.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(datasets.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(analytics.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(ai.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(uploads.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(groups.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(tokens.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])

mcp = FastMCP.from_fastapi(
    app,
    name="Eggscaliber",
    route_maps=[
        RouteMap(tags={"packages"}, mcp_type=MCPType.TOOL),
        RouteMap(tags={"scope"}, mcp_type=MCPType.TOOL),
        RouteMap(tags={"collections"}, mcp_type=MCPType.TOOL),
        RouteMap(tags={"datasets"}, mcp_type=MCPType.TOOL),
        RouteMap(tags={"analytics"}, mcp_type=MCPType.TOOL),
        RouteMap(mcp_type=MCPType.EXCLUDE),
    ],
)
mcp_app = mcp.http_app(path="/")
app.router.lifespan_context = combine_lifespans(db_lifespan, mcp_app.lifespan)
app.mount("/mcp", mcp_app)
