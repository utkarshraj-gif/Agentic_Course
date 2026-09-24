"""The four specialist agents. Each has a narrow job, its own tools and its own output schema.

  TriageAgent       alerts -> deduplicated, correlated incidents with severity
  InvestigatorAgent incident -> ranked root-cause hypotheses with evidence (read-only tools)
  RemediationAgent  hypothesis -> runbook-backed action plan with risk + approval requirement
  CommsAgent        incident record -> status update + postmortem draft

Online, the investigator and comms agents use the LLM (tool calling / writing); offline they
use transparent heuristics so the whole pipeline is runnable and testable.
"""
from __future__ import annotations

import json
from datetime import datetime

from pydantic import BaseModel, Field

from common import DATA
from common.domain import load_telemetry
from common.llm import get_llm
from common.retrieval import HybridRetriever, chunk_markdown, load_markdown_dir

from .tools import dependencies, metric_summary, recent_deploys, search_logs, topology

SEV_BY_TIER = {1: "SEV1", 2: "SEV2", 3: "SEV3"}


def _t(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


# ============================================================================= triage
class Incident(BaseModel):
    id: str
    services: list[str]
    alerts: list[str]
    severity: str
    started: str
    title: str


class TriageAgent:
    """Dedupe -> correlate by dependency graph + time window -> severity from service tier."""

    def __init__(self, window_min: int = 5):
        self.window = window_min

    def run(self, alerts: list[dict]) -> tuple[list[Incident], list[str]]:
        seen, uniq, dropped = set(), [], []
        for a in sorted(alerts, key=lambda a: a["ts"]):
            key = (a["service"], a["name"])
            if key in seen:
                dropped.append(a["alert_id"])
                continue
            seen.add(key)
            uniq.append(a)
        groups: list[list[dict]] = []
        topo = topology()
        for a in uniq:
            home = None
            for g in groups:
                related = any(a["service"] == b["service"] or a["service"] in topo[b["service"]]["depends_on"]
                              or b["service"] in topo[a["service"]]["depends_on"] for b in g)
                close = abs((_t(a["ts"]) - _t(g[-1]["ts"])).total_seconds()) <= self.window * 60
                if related and close:
                    home = g
                    break
            (home.append(a) if home else groups.append([a]))
        incidents = []
        for i, g in enumerate(groups, 1):
            svcs = list(dict.fromkeys(a["service"] for a in g))
            tier = min(topo[s]["tier"] for s in svcs)
            crit = any(a["severity"] == "critical" for a in g)
            sev = SEV_BY_TIER[tier] if crit or tier > 1 else "SEV2"
            incidents.append(Incident(id=f"INC-{4470 + i}", services=svcs, alerts=[a["alert_id"] for a in g],
                                      severity=sev, started=g[0]["ts"],
                                      title=f"{', '.join(sorted({a['name'] for a in g}))} on {', '.join(svcs)}"))
        return incidents, dropped


# ============================================================================= investigation
class Hypothesis(BaseModel):
    origin_service: str
    cause: str
    category: str                      # bad_deploy | memory_leak | disk_growth | unknown
    confidence: float
    evidence: list[str] = Field(default_factory=list)
    suspect_deploy: dict | None = None


class InvestigatorAgent:
    """Walk the dependency graph from symptomatic services to the deepest anomalous one,
    then explain it with logs and deploy history."""

    def __init__(self, registry):
        self.reg = registry
        self.calls: list[str] = []

    def _call(self, name: str, **args):
        self.calls.append(name)
        r = self.reg.call(name, args, actor="investigator")
        return r.output

    def run(self, inc: Incident) -> Hypothesis:
        # breadth-first over the incident services and their dependencies
        frontier, summaries = list(inc.services), {}
        while frontier:
            s = frontier.pop(0)
            if s in summaries:
                continue
            summaries[s] = self._call("metric_summary", service=s)["metrics"]
            frontier += dependencies(s)
        anomalous = {s for s, m in summaries.items() if any(v["anomalous"] for v in m.values())}
        # origin = anomalous service none of whose dependencies are anomalous
        # rank: prefer services named in the incident, then the strongest anomaly (deterministic)
        origins = [s for s in anomalous if not set(dependencies(s)) & anomalous] or list(inc.services)
        origins.sort(key=lambda s: (s not in inc.services,
                                    -max((v["ratio"] for v in summaries[s].values() if v["anomalous"]), default=0), s))
        origin = origins[0]
        m = summaries[origin]
        evidence = [f"{origin} {k}: {v['baseline']} -> {v['current']} (x{v['ratio']}, from {v['changed_at']})"
                    for k, v in m.items() if v["anomalous"]]
        downstream = sorted(s for s in anomalous if s != origin and origin in _transitive_deps(s))
        if downstream:
            evidence.append(f"downstream symptoms (depend on {origin}): {downstream}")
        unrelated = sorted(anomalous - {origin} - set(downstream))
        if unrelated:
            evidence.append(f"other anomalies in scope, tracked separately: {unrelated}")
        logs = self._call("search_logs", service=origin, level="ERROR")["signatures"] or \
            self._call("search_logs", service=origin, level="WARN")["signatures"]
        evidence += [f"log x{l['count']}: {l['pattern'][:110]}" for l in logs[:2]]
        deploys = self._call("recent_deploys", service=origin)["deploys"]
        change_ts = min((v["changed_at"] for v in m.values() if v["anomalous"]), default=inc.started)
        suspect = next((d for d in deploys if _t(d["ts"]) <= _t(change_ts) and
                        (_t(change_ts) - _t(d["ts"])).total_seconds() < 24 * 3600), None)

        def offline() -> Hypothesis:
            if "disk_used_pct" in m and m["disk_used_pct"]["anomalous"]:
                return Hypothesis(origin_service=origin, category="disk_growth", confidence=0.8, evidence=evidence,
                                  cause="Log volume growth filled the disk (rotated logs not compressed).")
            if suspect and "memory_pct" in m and m["memory_pct"]["steady_rise"]:
                return Hypothesis(origin_service=origin, category="memory_leak", confidence=0.75, evidence=evidence
                                  + [f"deploy {suspect['version']} at {suspect['ts']}: {suspect['change']}"],
                                  suspect_deploy=suspect,
                                  cause=f"Unbounded memory growth since {suspect['version']} ({suspect['change']}).")
            if suspect:
                return Hypothesis(origin_service=origin, category="bad_deploy", confidence=0.9, evidence=evidence
                                  + [f"deploy {suspect['version']} at {suspect['ts']}: {suspect['change']}"],
                                  suspect_deploy=suspect,
                                  cause=f"Deploy {suspect['version']} of {origin} ({suspect['change']}) "
                                        f"preceded the anomaly at {change_ts}.")
            return Hypothesis(origin_service=origin, category="unknown", confidence=0.3, evidence=evidence,
                              cause="No change correlated; needs human investigation.")

        return get_llm().structured(
            "You are an SRE. From this evidence, state the most likely root cause.\n"
            + json.dumps({"incident": inc.model_dump(), "metrics": summaries, "logs": logs, "deploys": deploys}),
            Hypothesis, fallback=offline)


def _transitive_deps(service: str) -> set[str]:
    out, stack = set(), list(dependencies(service))
    while stack:
        d = stack.pop()
        if d not in out:
            out.add(d)
            stack += dependencies(d)
    return out


# ============================================================================= remediation
class ActionPlan(BaseModel):
    action: str                        # rollback | rolling_restart | cleanup_disk | escalate
    args: dict
    runbook: str
    risk: str                          # low | medium | high
    requires_approval: bool
    rationale: str


RUNBOOKS = HybridRetriever([c for d, t in load_markdown_dir(DATA / "aiops" / "runbooks") for c in chunk_markdown(d, t)])


class RemediationAgent:
    """Retrieve the matching runbook, map it to a concrete action, and apply the change policy:
    tier-1 services or rollbacks need a human; low-risk actions on tier 2-3 may auto-run."""

    def run(self, inc: Incident, h: Hypothesis) -> ActionPlan:
        hits = RUNBOOKS.search(f"{h.cause} {h.category.replace('_', ' ')} {' '.join(h.evidence)[:300]}", k=1)
        rb = hits[0][0].meta if hits else {"runbook_id": "none", "risk": "high"}
        tier = topology()[h.origin_service]["tier"]
        key = f"{inc.id}-{h.category}"
        if h.category == "bad_deploy" and h.suspect_deploy:
            action, args = "rollback", {"service": h.origin_service,
                                        "to_version": h.suspect_deploy["previous_version"], "idempotency_key": key}
        elif h.category == "memory_leak":
            action, args = "rolling_restart", {"service": h.origin_service, "idempotency_key": key}
        elif h.category == "disk_growth":
            action, args = "cleanup_disk", {"service": h.origin_service, "path": "/var/log/batch",
                                            "older_than_days": 7, "idempotency_key": key}
        else:
            action, args = "escalate", {}
        risk = rb.get("risk", "high") if action != "rollback" else "medium"
        needs_human = action in ("rollback", "escalate") or tier == 1 or risk != "low"
        return ActionPlan(action=action, args=args, runbook=rb.get("runbook_id", "none"), risk=risk,
                          requires_approval=needs_human,
                          rationale=f"{rb.get('runbook_id')} matches '{h.category}'; tier-{tier} service; "
                                    f"{'human approval required' if needs_human else 'auto-approved by change policy'}.")


# ============================================================================= comms
class CommsAgent:
    def status_update(self, inc: Incident, h: Hypothesis, plan: ActionPlan, outcome: dict) -> str:
        def offline():
            return (f"[{inc.severity}] {inc.id} {inc.title}. Likely cause: {h.cause} "
                    f"Action: {plan.action} ({outcome.get('status', 'pending')}). Next update in 30 min.")
        return get_llm().chat(f"Write a 3-sentence incident status update for stakeholders: "
                              f"{inc.model_dump()} {h.model_dump()} {plan.model_dump()} {outcome}", fallback=offline)

    def postmortem(self, inc: Incident, h: Hypothesis, plan: ActionPlan, outcome: dict, approver: str | None) -> str:
        tel = load_telemetry()
        timeline = [f"- {a['ts']} alert {a['alert_id']} {a['name']} on {a['service']} ({a['value']})"
                    for a in tel["alerts"] if a["alert_id"] in inc.alerts]
        if h.suspect_deploy:
            timeline.insert(0, f"- {h.suspect_deploy['ts']} deploy {h.suspect_deploy['version']} of "
                               f"{h.suspect_deploy['service']}: {h.suspect_deploy['change']}")
        timeline.append(f"- action {plan.action} {plan.args} -> {outcome.get('status')}"
                        f"{' (approved by ' + approver + ')' if approver else ''}")
        return "\n".join([f"# Postmortem {inc.id}: {inc.title}", "", "*Blameless · draft generated by CommsAgent*", "",
                          f"**Severity:** {inc.severity} · **Services:** {', '.join(inc.services)}", "",
                          "## Root cause", h.cause, f"Confidence {h.confidence:.0%}.", "",
                          "## Evidence", *[f"- {e}" for e in h.evidence], "",
                          "## Timeline (UTC)", *sorted(timeline), "",
                          "## Resolution", plan.rationale, "",
                          "## Action items",
                          "- Add a pre-deploy check that diffs connection-pool and resource settings"
                          if h.category == "bad_deploy" else
                          "- Add eviction/limits to in-process caches and a memory-growth alert"
                          if h.category == "memory_leak" else
                          "- Enable log compression in logrotate and alert at 80% disk",
                          "- Add this incident to the AIOps evaluation set (Class 7)"])
