# Change Management Kit for Agent Deployments

Use this for every material change to an agent: a new model, prompt version, tool, autonomy level, or data source. It is written for the Inventory Planner and applies to all four capstones.

## 1. Change request (fill in per release)

| Field | Example: Inventory Planner v1.3 |
|---|---|
| Change | Planner re-ranks supplier options by total landed cost (lead-time-aware safety stock) |
| Why | v1.2 chose the cheapest unit price and caused 2 stock-outs of syringes in August |
| Autonomy | Unchanged: L2 (plans above $5k need the supply-chain lead's approval) |
| Blast radius | Purchase orders for 5 SKUs; budget capped at $8k per cycle |
| Eval evidence | Class 7 regression gate: backtest service level 95.4% vs 91.0%; cost +3.1% |
| Rollback | Container Apps revision traffic back to v1.2 (one command, under 2 minutes) |
| Approvers | Supply-chain lead (business), platform on-call (technical), data owner (forecast) |

## 2. Rollout plan

1. **Shadow** (1 week): v1.3 plans alongside v1.2; planners compare, and nothing is executed.
2. **Canary** (1 week): 10% of planning cycles on v1.3, with approval required for every plan.
3. **General availability**: 100%, with the normal approval threshold restored.
4. **Kill switch**: `AUTONOMY=suggest_only` forces every plan to `input-required`.

## 3. Go / no-go criteria

- The golden-set regression gate passes (no metric worse than tolerance).
- Guardrail block and review rates are within ±20% of the previous release.
- p95 latency is under the SLO; cost per plan is within budget.
- The human override rate during canary is below 15%.
- Runbook, on-call rotation and dashboards are updated.

## 4. People side (ADKAR)

| Stage | Action for planners and buyers |
|---|---|
| Awareness | 20-minute demo: what the agent does, what it never does (execute without approval over $5k) |
| Desire | Show the August stock-outs the change prevents; the planners' judgement stays final |
| Knowledge | Job aid: reading the plan table (cover, ROP, safety stock, deferred) |
| Ability | Two supervised cycles with a champion planner on each shift |
| Reinforcement | Weekly review of overrides; overrides become new eval cases |

## 5. RACI

| Activity | Supply-chain lead | Planners | Platform team | Data science | Security / compliance |
|---|---|---|---|---|---|
| Approve plans above threshold | A/R | C | – | – | – |
| Model / prompt changes | C | C | R | A | C |
| Deployments and rollback | I | I | A/R | C | C |
| Eval set ownership | C | R (labels) | C | A | – |
| Access and secrets | I | – | R | – | A |

## 6. Post-release review (2 weeks after GA)

Compare KPIs against the baseline (stock-outs, inventory holding cost, planner hours saved, override rate). Turn every override and incident into an eval case, and decide whether to widen autonomy.
