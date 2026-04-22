from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request

from src.auth import CurrentUser, _get_accessible_package_ids
from src.database import SessionLocal
from src.services import dataset_service, package_service


def _user() -> CurrentUser:
    return get_http_request().state.current_user


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    async def list_packages() -> list[dict]:
        """List all packages (top-level data groupings) the current user is entitled to access."""
        user = _user()
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            pkgs = await package_service.list_packages(session, accessible_ids)
        return [p.model_dump() for p in pkgs]

    @mcp.tool()
    async def list_collections(package_id: int) -> list[dict]:
        """List all survey collections within a package. Pass the package_id from list_packages."""
        user = _user()
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            pkg = await package_service.get_with_collections(session, package_id, accessible_ids)
        return [c.model_dump() for c in pkg.collections]

    @mcp.tool()
    async def list_datasets(collection_id: int) -> list[dict]:
        """List all datasets within a collection. Pass the collection_id from list_collections."""
        user = _user()
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            page = await dataset_service.list_datasets(
                session, collection_id=collection_id, accessible_ids=accessible_ids
            )
        return [item.model_dump() for item in page.items]

    @mcp.tool()
    async def describe_dataset(dataset_id: int) -> dict:
        """Get metadata for a dataset: title, field count, date range. Use before running analytics."""
        user = _user()
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            ds = await dataset_service.get_with_fields(session, dataset_id, accessible_ids)
        return ds.model_dump()
