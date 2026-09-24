# backend/services/graph_builder.py
# Factory and Registry Service for Dynamic Architecture & Process Graphs

from typing import Dict, List, Optional, Any
from backend.models.diagram import Diagram, DiagramNode, DiagramEdge


class GraphBuilderService:
    """
    Dedicated service that constructs graph structures independent of presentation layout.
    Ensures zero React Flow or ELK coordinates bleed into backend models.
    """

    @classmethod
    def get_agent_architecture(cls) -> Diagram:
        """
        Reference Clinical Prior Authorization / Enterprise ReAct Agent Architecture.
        Nodes match the reference diagram specification:
        Clinic User ↔ Agent Controller ↔ LLM ↔ Tool Registry → [find_policy, check_member, turnaround, Audit Log]
        """
        nodes = [
            DiagramNode(
                id="clinic_user",
                label="Clinic User",
                subtitle="Portal / EHR Client",
                type="user",
                metadata={"role": "Physician / Care Team", "channel": "Web Portal"}
            ),
            DiagramNode(
                id="agent_controller",
                label="Agent Controller",
                subtitle="ReAct loop",
                type="service",
                metadata={"framework": "LangGraph / Custom State Machine", "timeoutSec": 30}
            ),
            DiagramNode(
                id="llm",
                label="LLM",
                subtitle="OpenAI / vLLM / offline",
                type="database",
                metadata={"models": ["GPT-4o", "Claude 3.5 Sonnet", "Llama 3 70B"], "mode": "Function Calling"}
            ),
            DiagramNode(
                id="tool_registry",
                label="Tool Registry",
                subtitle="schema · validation · approval",
                type="service",
                metadata={"guardrails": "Strict Pydantic schemas", "humanInTheLoop": True}
            ),
            DiagramNode(
                id="find_policy",
                label="find_policy",
                subtitle="Policy Catalogue",
                type="service",
                metadata={"searchEngine": "Hybrid Vector + BM25", "domain": "Clinical Guidelines"}
            ),
            DiagramNode(
                id="check_member",
                label="check_member",
                subtitle="Eligibility System",
                type="service",
                metadata={"system": "Payer Core EDI 270/271", "latency": "140ms"}
            ),
            DiagramNode(
                id="turnaround",
                label="turnaround",
                subtitle="SLA Service",
                type="service",
                metadata={"slaDays": 3, "priority": "Urgent Pre-Auth"}
            ),
            DiagramNode(
                id="audit_log",
                label="Audit Log",
                subtitle="Immutable Ledger",
                type="database",
                metadata={"compliance": "HIPAA / SOC2 Type II", "storage": "WORM S3 / PostgreSQL"}
            ),
        ]

        edges = [
            DiagramEdge(
                id="e_user_to_agent",
                source="clinic_user",
                target="agent_controller",
                label="question",
                animated=True,
                metadata={"protocol": "HTTPS / SSE"}
            ),
            DiagramEdge(
                id="e_agent_to_user",
                source="agent_controller",
                target="clinic_user",
                label="answer + policy ID",
                animated=False,
                metadata={"payload": "Markdown + Citation Footnotes"}
            ),
            DiagramEdge(
                id="e_agent_to_llm",
                source="agent_controller",
                target="llm",
                label="messages + tool schemas",
                animated=True,
                metadata={"tokens": "3.4k prompt"}
            ),
            DiagramEdge(
                id="e_llm_to_agent",
                source="llm",
                target="agent_controller",
                label="tool call or final answer",
                animated=True,
                metadata={"stopReason": "tool_calls"}
            ),
            DiagramEdge(
                id="e_agent_to_tools",
                source="agent_controller",
                target="tool_registry",
                label="validated call",
                animated=True,
                metadata={"validation": "Passed guardrails"}
            ),
            DiagramEdge(
                id="e_llm_to_find_policy",
                source="llm",
                target="find_policy",
                label="lookup policy guidelines",
                animated=False,
                metadata={"method": "Semantic RAG"}
            ),
            DiagramEdge(
                id="e_tools_to_check_member",
                source="tool_registry",
                target="check_member",
                label="verify benefits & active plan",
                animated=False,
                metadata={"target": "payer_db"}
            ),
            DiagramEdge(
                id="e_tools_to_turnaround",
                source="tool_registry",
                target="turnaround",
                label="evaluate statutory timeline",
                animated=False,
                metadata={"target": "sla_engine"}
            ),
            DiagramEdge(
                id="e_tools_to_audit",
                source="tool_registry",
                target="audit_log",
                label="structured reasoning & action trace",
                animated=False,
                metadata={"retention": "7 years"}
            ),
        ]

        return Diagram(
            id="agent-architecture",
            name="Clinical Prior Authorization Agent Architecture",
            direction="RIGHT",
            description="Autonomous ReAct decision loop orchestrated across clinical policies, member verification, and immutable audit trails.",
            nodes=nodes,
            edges=edges
        )

    @classmethod
    def get_aiops_architecture(cls) -> Diagram:
        """
        Self-Healing Kubernetes Multi-Agent SRE Architecture diagram.
        """
        nodes = [
            DiagramNode(id="prometheus", label="Prometheus & OTEL", subtitle="Metric Ingestion", type="database"),
            DiagramNode(id="anomaly_detector", label="Telemetry Triager", subtitle="Spike & Latency Filter", type="service"),
            DiagramNode(id="sre_orchestrator", label="SRE Commander", subtitle="LangGraph Multi-Agent Team", type="service"),
            DiagramNode(id="k8s_operator", label="K8s Tool Executor", subtitle="Pod Restart & Rollback", type="service"),
            DiagramNode(id="slack_alert", label="On-Call Engineer", subtitle="HITL Verification Channel", type="user"),
            DiagramNode(id="runbook_rag", label="Runbook Vault", subtitle="Milvus Vector DB", type="database"),
        ]
        edges = [
            DiagramEdge(id="e_prom_anomaly", source="prometheus", target="anomaly_detector", label="high p99 alert", animated=True),
            DiagramEdge(id="e_anomaly_sre", source="anomaly_detector", target="sre_orchestrator", label="incident ticket", animated=True),
            DiagramEdge(id="e_sre_rag", source="sre_orchestrator", target="runbook_rag", label="query remediation steps", animated=False),
            DiagramEdge(id="e_sre_slack", source="sre_orchestrator", target="slack_alert", label="request rollback approval", animated=True),
            DiagramEdge(id="e_slack_sre", source="slack_alert", target="sre_orchestrator", label="approve token", animated=False),
            DiagramEdge(id="e_sre_k8s", source="sre_orchestrator", target="k8s_operator", label="execute helm rollback", animated=True),
        ]
        return Diagram(
            id="aiops-architecture",
            name="Self-Healing Kubernetes SRE Agent System",
            direction="RIGHT",
            description="Automated telemetry triage, vector runbook reasoning, and human-in-the-loop rollback execution.",
            nodes=nodes,
            edges=edges
        )

    @classmethod
    def get_diagram(cls, diagram_id: str) -> Optional[Diagram]:
        """Lookup diagram by identifier."""
        registry: Dict[str, Any] = {
            "agent-architecture": cls.get_agent_architecture,
            "aiops-architecture": cls.get_aiops_architecture,
        }
        builder = registry.get(diagram_id)
        if builder:
            return builder()
        return None

    @classmethod
    def list_diagrams(cls) -> List[Dict[str, Any]]:
        """Return list of all registered diagrams."""
        return [
            {
                "id": "agent-architecture",
                "name": "Clinical Prior Authorization Agent",
                "category": "Healthcare / ReAct",
                "nodeCount": 8,
                "edgeCount": 9
            },
            {
                "id": "aiops-architecture",
                "name": "Self-Healing Kubernetes SRE Agent",
                "category": "Infrastructure / Multi-Agent",
                "nodeCount": 6,
                "edgeCount": 6
            }
        ]
