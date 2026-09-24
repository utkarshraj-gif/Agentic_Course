"""Start the three A2A agents locally and run a planning cycle as an external client (e.g. the ERP).

Run:  python -m projects.inventory_planner.run            # approves as the supply-chain lead
      python -m projects.inventory_planner.run --reject
"""
from __future__ import annotations

import os
import sys
import threading
import time

import httpx
import uvicorn

PORTS = {"forecaster": 8101, "supplier": 8102, "planner": 8103}


def start_agents(ports: dict = PORTS) -> dict:
    """Run each agent in its own uvicorn server thread (in production: separate containers)."""
    urls = {k: f"http://127.0.0.1:{p}" for k, p in ports.items()}
    os.environ.update(FORECASTER_URL=urls["forecaster"], SUPPLIER_URL=urls["supplier"], PLANNER_URL=urls["planner"])
    from . import forecaster, planner, supplier
    for mod, key in ((forecaster, "forecaster"), (supplier, "supplier"), (planner, "planner")):
        mod.CARD.url = urls[key]
        server = uvicorn.Server(uvicorn.Config(mod.app, host="127.0.0.1", port=ports[key], log_level="warning"))
        threading.Thread(target=server.run, daemon=True).start()
    for u in urls.values():
        for _ in range(100):
            try:
                if httpx.get(f"{u}/health", timeout=0.5).status_code == 200:
                    break
            except httpx.HTTPError:
                time.sleep(0.05)
    return urls


def main() -> None:
    from common.llm import get_llm
    from .a2a import A2AClient, artifact_data

    urls = start_agents()
    erp = A2AClient()
    print(f"LLM mode: {get_llm().mode}\n\nDiscovered agents:")
    for u in urls.values():
        card = erp.discover(u)
        print(f"  {card.name:<18} {card.url:<24} skills={[s.id for s in card.skills]}")

    task = erp.send(urls["planner"], {})
    print(f"\nplanner task state: {task['status']['state']} - {task['status']['message']['parts'][0]['text']}")
    if task["status"]["state"] == "input-required":
        plan = artifact_data(task)["approval_request"]["plan"]
        print(f"\n{'SKU':<13}{'cover(wk)':>10}{'ROP':>7}{'pos':>7}{'order':>7}{'supplier':>15}{'$':>10}  status")
        for l in plan["lines"]:
            sup = l["supplier"]["supplier_id"] if l["supplier"] else "-"
            print(f"{l['sku']:<13}{l['weeks_of_cover']:>10}{l['reorder_point']:>7}{l['position']:>7}"
                  f"{l['order_units']:>7}{sup:>15}{l['cost_usd']:>10,.0f}  {l['status']}")
        print(f"total ${plan['total_usd']:,.0f} of ${plan['budget_usd']:,.0f} budget")
        decision = {"approved": "--reject" not in sys.argv, "by": "supply-chain-lead-demo",
                    "reason": "" if "--reject" not in sys.argv else "wait for Q4 contract pricing"}
        task = erp.send(urls["planner"], {"approval": decision}, context_id=task["contextId"], task_id=task["id"])
    out = artifact_data(task)
    print(f"\nfinal state: {task['status']['state']}")
    for po in out["purchase_orders"]:
        print(f"  {po['po']} {po['sku']:<12} {po['units']:>5} units from {po['supplier_id']:<13} "
              f"${po['total_usd']:>9,.2f}  ETA {po['eta_weeks']} wk")
    print(f"\nnote: {out['note']}")


if __name__ == "__main__":
    main()
