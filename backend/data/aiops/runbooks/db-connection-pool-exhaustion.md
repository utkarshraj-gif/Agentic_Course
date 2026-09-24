runbook_id: RB-DB-003
services: payments-svc, orders-svc
risk: medium

# Runbook: Database Connection Pool Exhaustion

## Symptoms

Application logs show "Connection is not available, request timed out" from HikariCP or a similar pool; 5xx errors and latency rise together while database CPU stays normal; active pool connections equal the pool maximum.

## Diagnosis

Compare the pool maximum with the previous deployment. Check whether a recent deployment changed maximumPoolSize, connection timeouts, or introduced long-running transactions. Confirm database health: if database CPU and connections are normal, the bottleneck is the client pool, not the database.

## Remediation

If a recent deployment reduced the pool size, roll back to the previous version (see RB-DEPLOY-001). As a temporary mitigation, scale out replicas of the service to add pool capacity. Do not raise the pool above the database max_connections budget for the service.

## Verification

Error rate returns below 1% and p99 latency below 500 ms within 10 minutes; waiting threads in the pool drop to zero.
