from fastmcp import FastMCP

from src.mcp_external.auth import PATAuthMiddleware
from src.mcp_external.tools import analyse, browse

external_mcp = FastMCP(name="Eggscaliber External")
browse.register(external_mcp)
analyse.register(external_mcp)

external_mcp_app = external_mcp.http_app(path="/")
external_mcp_app.add_middleware(PATAuthMiddleware)
