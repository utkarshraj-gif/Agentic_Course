"""Class 6 - An MCP server that exposes the AIOps tools, runbooks and a prompt.

Model Context Protocol (MCP) standardises how agents discover and call tools, read resources
and fetch prompt templates - any MCP client (Claude Desktop, Cursor, LangGraph via
langchain-mcp-adapters, your own agent) can use this server without custom glue.

Run standalone (stdio):   python -m classes.class06_memory_mcp.mcp_server
Run over HTTP:            python -m classes.class06_memory_mcp.mcp_server --http   (port 8765)
"""
from __future__ import annotations

import sys
from typing import Literal

from mcp.server.fastmcp import FastMCP

from common import DATA
from classes.class05_tool_engineering import ops_tools as ops

mcp = FastMCP("ops-tools", port=8765, log_level="WARNING")

Service = Literal["checkout-api", "payments-svc", "inventory-svc", "postgres-payments",
                  "redis-cache", "batch-worker"]


# ----------------------------------------------------------------------------- tools (read-only)
@mcp.tool()
def get_metric(service: Service, metric: str) -> dict:
    """Summary of one metric for a service over the last hour: baseline, current, change point."""
    out = ops.get_metric.fn(service=service, metric=metric)
    out.pop("series", None)
    return out


@mcp.tool()
def search_logs(service: Service, level: Literal["ERROR", "WARN", "INFO"] = "ERROR",
                contains: str = "", limit: int = 5) -> dict:
    """Deduplicated recent log messages for a service, filtered by level and substring."""
    return ops.search_logs.fn(service=service, level=level, contains=contains, limit=limit)


@mcp.tool()
def get_recent_deploys(service: Service) -> dict:
    """Recent deployments for a service with change summaries, newest first."""
    return ops.get_recent_deploys.fn(service=service)

# Note: rollback_deployment is deliberately NOT exposed. Write actions stay behind the
# approval gate in the agent host - MCP servers should expose the least privilege needed.


# ----------------------------------------------------------------------------- resources
@mcp.resource("runbook://index")
def runbook_index() -> str:
    """List of available runbook ids."""
    return "\n".join(p.stem for p in sorted((DATA / "aiops" / "runbooks").glob("*.md")))


@mcp.resource("runbook://{runbook_id}")
def runbook(runbook_id: str) -> str:
    """Full text of one runbook."""
    path = DATA / "aiops" / "runbooks" / f"{runbook_id}.md"
    if not path.exists():
        raise ValueError(f"no runbook '{runbook_id}'")
    return path.read_text()


# ----------------------------------------------------------------------------- prompts
@mcp.prompt()
def incident_triage(service: str, symptom: str) -> str:
    """Standard triage prompt used by every on-call agent."""
    return (f"Incident on {service}: {symptom}.\n"
            "1) Check error rate and latency. 2) Search ERROR logs. 3) Check deploys in the last 24h. "
            "4) Name the most likely root cause with evidence. 5) Recommend a runbook. Do not execute writes.")


if __name__ == "__main__":
    mcp.run(transport="streamable-http" if "--http" in sys.argv else "stdio")
