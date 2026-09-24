runbook_id: RB-APP-007
services: inventory-svc, checkout-api
risk: low

# Runbook: Memory Growth and Long GC Pauses

## Symptoms

Memory usage climbs steadily without dropping after GC; GC pause warnings in logs; latency spikes follow.

## Remediation

Perform a rolling restart of the affected service to recover memory (low risk for tier-2 services, one instance at a time). Open a bug for the owning team referencing the most recent change that added in-memory state, such as a cache without eviction.

## Verification

Memory drops below 60% after restart and GC pause warnings stop.
