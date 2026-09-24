"""Demand Forecaster agent (A2A skill: forecast_demand).

Holt's linear exponential smoothing with a small grid search on a walk-forward backtest -
simple, explainable, and a solid baseline before reaching for ML. Returns the point forecast,
the residual standard deviation (used for safety stock) and backtest MAPE (trust signal).

Serve:  uvicorn projects.inventory_planner.forecaster:app --port 8101
"""
from __future__ import annotations

import os
import statistics

from common.domain import load_sales_history

from .a2a import AgentCard, Skill, build_app


def holt(series: list[float], alpha: float, beta: float, horizon: int) -> tuple[list[float], list[float]]:
    level, trend = series[0], series[1] - series[0]
    fitted = []
    for y in series:
        fitted.append(level + trend)
        prev = level
        level = alpha * y + (1 - alpha) * (level + trend)
        trend = beta * (level - prev) + (1 - beta) * trend
    return [level + (h + 1) * trend for h in range(horizon)], fitted


def forecast(sku: str, horizon_weeks: int = 8) -> dict:
    y = [float(v) for v in load_sales_history()[sku]]
    best = None
    for a in (0.2, 0.4, 0.6, 0.8):
        for b in (0.05, 0.1, 0.2):
            errs = []
            for t in range(16, len(y)):                     # walk-forward 1-step backtest
                f, _ = holt(y[:t], a, b, 1)
                errs.append(abs(f[0] - y[t]) / max(y[t], 1))
            mape = statistics.mean(errs)
            if best is None or mape < best[0]:
                best = (mape, a, b)
    mape, a, b = best
    fc, fitted = holt(y, a, b, horizon_weeks)
    resid = [yi - fi for yi, fi in zip(y[2:], fitted[2:])]
    return {"sku": sku, "horizon_weeks": horizon_weeks, "weekly_forecast": [round(max(v, 0), 1) for v in fc],
            "sigma_weekly": round(statistics.pstdev(resid), 1), "backtest_mape": round(mape, 3),
            "model": f"holt(alpha={a}, beta={b})", "last_actual": y[-1]}


def handle(data: dict, ctx: str, tid: str | None):
    skus = data.get("skus") or [data["sku"]]
    res = {s: forecast(s, int(data.get("horizon_weeks", 8))) for s in skus}
    return "completed", {"forecasts": res}, f"forecast {len(res)} SKU(s)"


CARD = AgentCard(
    name="Demand Forecaster", url=os.getenv("FORECASTER_URL", "http://localhost:8101"),
    description="Weekly unit-demand forecasts with uncertainty for medical-supply SKUs.",
    skills=[Skill(id="forecast_demand", name="Forecast demand", tags=["forecasting", "supply-chain"],
                  description="Input {sku|skus, horizon_weeks}. Output weekly forecast, sigma, backtest MAPE.",
                  examples=['{"sku": "SKU-GLV-001", "horizon_weeks": 8}'])])
app = build_app(CARD, handle, token=os.getenv("A2A_TOKEN"))
