"""Class 6 - An MCP client: discover and use the ops-tools server over stdio.

The client launches the server as a subprocess, performs the MCP handshake, lists what the
server offers and calls a tool - exactly what an agent host does before handing the tool
schemas to its LLM.

Run:  python -m classes.class06_memory_mcp.mcp_client
"""
from __future__ import annotations

import asyncio
import json
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from common import ROOT

SERVER = StdioServerParameters(command=sys.executable,
                               args=["-m", "classes.class06_memory_mcp.mcp_server"], cwd=str(ROOT))


async def main() -> None:
    async with stdio_client(SERVER) as (read, write):
        async with ClientSession(read, write) as session:
            info = await session.initialize()
            print(f"connected to MCP server: {info.serverInfo.name}\n")

            tools = await session.list_tools()
            print("tools:")
            for t in tools.tools:
                print(f"  - {t.name}: {t.description.splitlines()[0]}")

            resources = await session.list_resources()
            templates = await session.list_resource_templates()
            print("resources:", [str(r.uri) for r in resources.resources],
                  "templates:", [t.uriTemplate for t in templates.resourceTemplates])
            prompts = await session.list_prompts()
            print("prompts:", [p.name for p in prompts.prompts], "\n")

            # These schemas are what you would pass to the LLM as function definitions.
            schema = {t.name: t.inputSchema for t in tools.tools}
            print("input schema for get_metric:", json.dumps(schema["get_metric"])[:200], "…\n")

            res = await session.call_tool("get_metric", {"service": "payments-svc", "metric": "error_rate_pct"})
            print("call get_metric ->", res.content[0].text[:200])
            res = await session.call_tool("search_logs", {"service": "payments-svc", "limit": 1})
            print("call search_logs ->", res.content[0].text[:200])

            rb = await session.read_resource("runbook://db-connection-pool-exhaustion")
            print("\nread runbook ->", rb.contents[0].text.splitlines()[4])

            p = await session.get_prompt("incident_triage", {"service": "payments-svc", "symptom": "5xx spike"})
            print("prompt ->", p.messages[0].content.text[:120], "…")


if __name__ == "__main__":
    asyncio.run(main())
