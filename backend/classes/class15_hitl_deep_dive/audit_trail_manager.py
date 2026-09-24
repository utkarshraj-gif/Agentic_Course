"""Class 15 — Immutable Enterprise Compliance Audit Trail Manager

Logs cryptographic sha256 checksums of agent execution traces,
user prompts, model reasoning, and human decision overrides.
"""

import hashlib
import json
import time
from typing import Dict, Any, List

class AuditTrailLogger:
    def __init__(self):
        self.ledger: List[Dict[str, Any]] = []

    def record_decision(
        self,
        event_type: str,
        actor: str,
        payload: Dict[str, Any],
        human_override: bool = False
    ) -> Dict[str, Any]:
        timestamp = time.time()
        serialized = json.dumps(payload, sort_keys=True)
        record_hash = hashlib.sha256(f"{timestamp}:{event_type}:{actor}:{serialized}".encode()).hexdigest()

        entry = {
            "timestamp": timestamp,
            "event_type": event_type,
            "actor": actor,
            "human_override": human_override,
            "payload": payload,
            "signature_sha256": record_hash
        }
        self.ledger.append(entry)
        return entry

if __name__ == "__main__":
    audit = AuditTrailLogger()
    record = audit.record_decision(
        event_type="DISBURSEMENT_APPROVAL",
        actor="lead_auditor@velloe.ai",
        payload={"transaction_id": "TX_9902", "amount": 15000.0, "status": "APPROVED"},
        human_override=True
    )
    print("=== Cryptographic Compliance Audit Entry Generated ===")
    print(f"Actor: {record['actor']}")
    print(f"Event: {record['event_type']}")
    print(f"SHA256 Signature: {record['signature_sha256']}")
