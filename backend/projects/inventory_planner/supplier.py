"""Supplier agent (A2A skill: quote). Owned by 'procurement' - a different team than planning,
which is exactly the situation A2A is designed for.

Scores each eligible supplier on landed cost plus a lateness-risk penalty:
  effective_unit_cost = price * (1 + (1 - on_time_rate) * 0.5)

Serve:  uvicorn projects.inventory_planner.supplier:app --port 8102
"""
from __future__ import annotations

import math
import os

from common.domain import load_inventory_json

from .a2a import AgentCard, Skill, build_app


def quote(sku: str, qty: int) -> dict:
    options = []
    for s in load_inventory_json("suppliers"):
        if sku not in s["skus"]:
            continue
        units = max(qty, s["moq_units"])
        price = s["skus"][sku]
        eff = price * (1 + (1 - s["on_time_rate"]) * 0.5)
        options.append({"supplier_id": s["supplier_id"], "name": s["name"], "unit_price": price,
                        "order_units": units, "lead_time_weeks": s["lead_time_weeks"], "moq_units": s["moq_units"],
                        "on_time_rate": s["on_time_rate"], "effective_unit_cost": round(eff, 3),
                        "total_usd": round(units * price, 2)})
    options.sort(key=lambda o: (o["effective_unit_cost"], o["lead_time_weeks"]))
    return {"sku": sku, "requested_units": qty, "options": options,
            "recommended": options[0] if options else None}


def handle(data: dict, ctx: str, tid: str | None):
    items = data.get("items") or [{"sku": data["sku"], "qty": data.get("qty", 0)}]
    res = {i["sku"]: quote(i["sku"], int(math.ceil(i["qty"]))) for i in items}
    return "completed", {"quotes": res}, f"quoted {len(res)} SKU(s)"


CARD = AgentCard(
    name="Supplier Agent", url=os.getenv("SUPPLIER_URL", "http://localhost:8102"),
    description="Supplier catalogue, pricing, MOQ and lead-time quotes with a reliability-adjusted recommendation.",
    skills=[Skill(id="quote", name="Quote supply", tags=["procurement"],
                  description="Input {items:[{sku, qty}]}. Output ranked supplier options per SKU.",
                  examples=['{"items": [{"sku": "SKU-SYR-220", "qty": 400}]}'])])
app = build_app(CARD, handle, token=os.getenv("A2A_TOKEN"))
