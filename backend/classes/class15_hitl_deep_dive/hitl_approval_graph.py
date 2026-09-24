"""Class 15 — Human-in-the-Loop (HITL) State Graph & Interrupt Engine

Demonstrates LangGraph-style checkpointing and execution interruption
for sensitive, high-impact enterprise tool calls.
"""

from typing import Dict, Any, Optional
import uuid

class HITLApprovalWorkflow:
    def __init__(self, policy_limit: float = 2500.0):
        self.policy_limit = policy_limit
        # In-memory thread checkpoint store (representing Postgres Checkpointer)
        self.checkpoints: Dict[str, Dict[str, Any]] = {}

    def initiate_action(self, action_name: str, amount: float, recipient: str) -> Dict[str, Any]:
        """Evaluates policy and conditionally interrupts execution if risk threshold is reached."""
        thread_id = f"thread_{uuid.uuid4().hex[:8]}"
        requires_approval = amount >= self.policy_limit

        state = {
            "thread_id": thread_id,
            "action_name": action_name,
            "amount": amount,
            "recipient": recipient,
            "status": "SUSPENDED" if requires_approval else "EXECUTED",
            "approver": None,
            "justification": None
        }

        if requires_approval:
            # Checkpoint the suspended graph state
            self.checkpoints[thread_id] = state
            return {
                "thread_id": thread_id,
                "status": "INTERRUPTED",
                "message": f"Action exceeded safety policy limit (${self.policy_limit:,.2f}). Checkpoint saved. Awaiting human approval.",
                "pending_review": state
            }
        else:
            return {
                "thread_id": thread_id,
                "status": "COMPLETED",
                "message": f"Action executed automatically under policy threshold (${amount:,.2f} sent to {recipient}).",
                "result": state
            }

    def resolve_interrupt(self, thread_id: str, approved: bool, reviewer_email: str, notes: str) -> Dict[str, Any]:
        """Resumes a paused thread following human reviewer decision."""
        if thread_id not in self.checkpoints:
            raise ValueError(f"No checkpoint found for thread {thread_id}")

        state = self.checkpoints[thread_id]

        if approved:
            state["status"] = "APPROVED_AND_EXECUTED"
            state["approver"] = reviewer_email
            state["justification"] = notes
            outcome = f"Approved by {reviewer_email}. Transaction of ${state['amount']:,.2f} executed."
        else:
            state["status"] = "REJECTED_BY_HUMAN"
            state["approver"] = reviewer_email
            state["justification"] = notes
            outcome = f"Rejected by {reviewer_email}. Reason: {notes}. Execution aborted."

        del self.checkpoints[thread_id]
        return {
            "thread_id": thread_id,
            "final_status": state["status"],
            "resolution": outcome,
            "state_diff": state
        }

if __name__ == "__main__":
    workflow = HITLApprovalWorkflow(policy_limit=2500.0)

    print("=== Human-in-the-Loop Interrupt & Resume Simulation ===\n")
    # Case 1: Low-risk automatic execution
    res1 = workflow.initiate_action("DISBURSEMENT", 450.0, "vendor_logistics_llc")
    print(f"Case 1 (Low Risk): {res1['message']}\n")

    # Case 2: High-risk interrupt
    res2 = workflow.initiate_action("CAPITAL_TRANSFER", 15000.0, "offshore_cloud_datacenter")
    thread_id = res2["thread_id"]
    print(f"Case 2 (High Risk): {res2['message']}")
    print(f"  • Paused Thread: {thread_id}")

    # Case 2 Resume: Human reviewer signs off
    res2_resolved = workflow.resolve_interrupt(
        thread_id=thread_id,
        approved=True,
        reviewer_email="cfo_compliance@velloe.ai",
        notes="Verified Q3 cloud reservation invoice. Authorized."
    )
    print(f"  • Resolution: {res2_resolved['resolution']}")
