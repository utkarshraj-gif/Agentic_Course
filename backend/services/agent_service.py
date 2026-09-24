import time
import uuid
from typing import Dict, Any, List
from backend.models.agent import AgentRunResponse, AgentStatus
try:
    from backend.common.domain import load_pa_requests, load_telemetry, list_contracts, load_contract_sections
except (ImportError, ModuleNotFoundError):
    from common.domain import load_pa_requests, load_telemetry, list_contracts, load_contract_sections

class AgentService:
    @staticmethod
    def get_agent_status_list() -> List[AgentStatus]:
        return [
            AgentStatus(
                agent_id="aiops",
                name="AIOps Incident Responder",
                status="online",
                mode="offline_synthetic_or_live",
                capabilities=["Alert Ingestion", "Root-Cause Analysis", "Plan Synthesis", "Approval Gates"]
            ),
            AgentStatus(
                agent_id="clinical",
                name="Clinical Prior-Authorization Agent",
                status="online",
                mode="offline_synthetic_or_live",
                capabilities=["FHIR Chart Parsing", "Policy Criterion Check", "Evidence Extraction", "Clinical Letter Gen"]
            ),
            AgentStatus(
                agent_id="legal",
                name="Legal Contract Review Agent",
                status="online",
                mode="offline_synthetic_or_live",
                capabilities=["Hierarchy Parsing", "Clause Classification", "Playbook Deviation Check", "Redline Generation"]
            ),
            AgentStatus(
                agent_id="inventory",
                name="Supply Chain Inventory Planner",
                status="online",
                mode="offline_synthetic_or_live",
                capabilities=["Demand Forecasting", "Stockout Risk Scoring", "A2A Inter-Warehouse Negotiation", "PO Draft"]
            )
        ]

    @staticmethod
    def execute_agent(agent_id: str, input_data: Dict[str, Any] = None, simulate: bool = True) -> AgentRunResponse:
        start_time = time.time()
        run_id = f"run_{agent_id}_{uuid.uuid4().hex[:8]}"

        if agent_id == "aiops":
            return AgentService._run_aiops(run_id, input_data, start_time)
        elif agent_id == "clinical":
            return AgentService._run_clinical(run_id, input_data, start_time)
        elif agent_id == "legal":
            return AgentService._run_legal(run_id, input_data, start_time)
        elif agent_id == "inventory":
            return AgentService._run_inventory(run_id, input_data, start_time)
        else:
            elapsed = (time.time() - start_time) * 1000
            return AgentRunResponse(
                run_id=run_id,
                agent_id=agent_id,
                status="error",
                execution_time_ms=elapsed,
                summary=f"Unknown agent identifier: '{agent_id}'",
                steps=[],
                result={"error": f"Agent '{agent_id}' not found"}
            )

    @staticmethod
    def _run_aiops(run_id: str, input_data: Dict[str, Any] = None, start_time: float = 0.0) -> AgentRunResponse:
        telemetry = load_telemetry()
        alerts = telemetry.get("alerts", [])
        sample_alert = alerts[0] if alerts else {"service": "checkout-api", "alertname": "High5xxErrorRate", "severity": "critical"}

        steps = [
            {
                "step": 1,
                "node": "ingest_and_triage",
                "action": f"Ingesting alert batch: {sample_alert.get('alertname')} on {sample_alert.get('service')}",
                "status": "completed",
                "details": f"Severity: {sample_alert.get('severity')}. Correlated 3 related events."
            },
            {
                "step": 2,
                "node": "hypothesis_generator",
                "action": "Querying logs & traces across upstream DB connections and recent deploys",
                "status": "completed",
                "details": "Hypothesis: Connection pool starvation in postgres-primary following deploy v2.4.1."
            },
            {
                "step": 3,
                "node": "plan_synthesizer",
                "action": "Drafting remediation plan",
                "status": "completed",
                "details": "Action: Scale connection pool max_size from 50 -> 150 and restart idle workers."
            },
            {
                "step": 4,
                "node": "approval_gate",
                "action": "Safety evaluation & human approval gate",
                "status": "waiting_approval",
                "details": "Risk level: Medium. Automated rollback configured. Awaiting SRE sign-off."
            }
        ]

        elapsed = (time.time() - start_time) * 1000
        return AgentRunResponse(
            run_id=run_id,
            agent_id="aiops",
            status="paused_for_approval",
            execution_time_ms=round(elapsed, 2),
            summary=f"Triaged critical alert on {sample_alert.get('service')}. Root cause identified with 94% confidence. Awaiting human approval for remediation.",
            steps=steps,
            result={
                "incident_id": "INC-8924",
                "service": sample_alert.get("service"),
                "root_cause": "Postgres connection pool exhaustion",
                "recommended_action": "kubectl set env deployment/checkout-api DB_POOL_SIZE=150",
                "safety_tier": "Requires SRE confirmation"
            }
        )

    @staticmethod
    def _run_clinical(run_id: str, input_data: Dict[str, Any] = None, start_time: float = 0.0) -> AgentRunResponse:
        requests = load_pa_requests()
        req = requests[0] if requests else {"patient_id": "PT-1049", "requested_treatment": "Dupixent (dupilumab)", "diagnosis": "Severe Atopic Dermatitis"}

        steps = [
            {
                "step": 1,
                "node": "chart_extraction",
                "action": f"Extracting clinical history for {req.get('patient_id')}",
                "status": "completed",
                "details": f"Diagnosis: {req.get('diagnosis')}. Prior therapies: Topical corticosteroids (failed), Phototherapy (contraindicated)."
            },
            {
                "step": 2,
                "node": "policy_retrieval",
                "action": f"Retrieving policy guidelines for {req.get('requested_treatment')}",
                "status": "completed",
                "details": "Clinical criteria matched: 3/3 guidelines satisfied (EASI score > 16, topical failure documented, age >= 12)."
            },
            {
                "step": 3,
                "node": "recommendation_engine",
                "action": "Evaluating confidence and rationale",
                "status": "completed",
                "details": "Recommendation: APPROVE (Confidence 98.4%). Full evidentiary citations attached."
            },
            {
                "step": 4,
                "node": "letter_generation",
                "action": "Drafting approval letter & CMS compliance notice",
                "status": "completed",
                "details": "Generated prior-authorization authorization letter with ICD-10 and HCPCS billing codes."
            }
        ]

        elapsed = (time.time() - start_time) * 1000
        return AgentRunResponse(
            run_id=run_id,
            agent_id="clinical",
            status="completed",
            execution_time_ms=round(elapsed, 2),
            summary=f"Processed Prior-Authorization for {req.get('patient_id')} ({req.get('requested_treatment')}). All clinical criteria met. Recommendation: APPROVE.",
            steps=steps,
            result={
                "request_id": req.get("request_id", "PA-9932"),
                "patient_id": req.get("patient_id"),
                "drug": req.get("requested_treatment"),
                "decision": "APPROVE",
                "confidence": 0.984,
                "rationale": "Patient demonstrated documented trial and failure of high-potency topical corticosteroids and intolerance to calcineurin inhibitors."
            }
        )

    @staticmethod
    def _run_legal(run_id: str, input_data: Dict[str, Any] = None, start_time: float = 0.0) -> AgentRunResponse:
        contracts = list_contracts()
        sample_contract = contracts[0] if contracts else "cloud_services_agreement"

        steps = [
            {
                "step": 1,
                "node": "document_parser",
                "action": f"Parsing document sections for {sample_contract}",
                "status": "completed",
                "details": "Extracted 14 sections, metadata header, and defined terms."
            },
            {
                "step": 2,
                "node": "clause_classifier",
                "action": "Classifying clauses against standard legal taxonomy",
                "status": "completed",
                "details": "Identified: Limitation of Liability, Indemnification, SLA credits, Data Protection."
            },
            {
                "step": 3,
                "node": "playbook_deviation_detector",
                "action": "Comparing against enterprise risk playbook",
                "status": "completed",
                "details": "FLAGGED HIGH RISK: Unlimited liability for consequential damages; mutual indemnity missing customer protection."
            },
            {
                "step": 4,
                "node": "redline_synthesizer",
                "action": "Generating counter-proposals and redline edits",
                "status": "completed",
                "details": "Generated 2 redline suggestions capping liability at 12 months fees paid."
            }
        ]

        elapsed = (time.time() - start_time) * 1000
        return AgentRunResponse(
            run_id=run_id,
            agent_id="legal",
            status="completed",
            execution_time_ms=round(elapsed, 2),
            summary=f"Reviewed contract {sample_contract}. Found 2 deviations requiring redlining. Overall risk score: HIGH (78/100).",
            steps=steps,
            result={
                "contract_name": sample_contract,
                "risk_score": 78,
                "severity": "HIGH",
                "deviations_found": 2,
                "recommended_redline": "Replace uncapped consequential damages clause with standard 12-month mutual fee cap."
            }
        )

    @staticmethod
    def _run_inventory(run_id: str, input_data: Dict[str, Any] = None, start_time: float = 0.0) -> AgentRunResponse:
        steps = [
            {
                "step": 1,
                "node": "demand_forecaster",
                "action": "Forecasting 14-day regional demand across 5 fulfillment centers",
                "status": "completed",
                "details": "Predicted 32% spike in West Coast demand due to scheduled promotional campaign."
            },
            {
                "step": 2,
                "node": "stockout_risk_assessor",
                "action": "Evaluating current inventory levels against lead times",
                "status": "completed",
                "details": "CRITICAL: Seattle hub projected stockout on Day 6 for SKU-7721 (safety stock = 1.2 days)."
            },
            {
                "step": 3,
                "node": "a2a_transfer_negotiator",
                "action": "Multi-agent negotiation between Regional Hub Agents",
                "status": "completed",
                "details": "Oakland hub agreed to transfer 400 units to Seattle. Inter-facility transit: 36 hours."
            },
            {
                "step": 4,
                "node": "po_dispatcher",
                "action": "Generating supplemental vendor Purchase Order",
                "status": "completed",
                "details": "Drafted PO #PO-4482 to Tier-1 supplier for 1,200 units with expedited shipping."
            }
        ]

        elapsed = (time.time() - start_time) * 1000
        return AgentRunResponse(
            run_id=run_id,
            agent_id="inventory",
            status="completed",
            execution_time_ms=round(elapsed, 2),
            summary="Identified projected Seattle stockout. Negotiated 400-unit transfer from Oakland hub and generated PO for 1,200 units.",
            steps=steps,
            result={
                "target_sku": "SKU-7721",
                "stockout_prevented": True,
                "transfer_approved": "Oakland -> Seattle (400 units)",
                "po_number": "PO-4482",
                "cost_saved": "$14,800"
            }
        )
