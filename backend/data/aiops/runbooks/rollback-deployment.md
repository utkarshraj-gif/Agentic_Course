runbook_id: RB-DEPLOY-001
services: all
risk: medium

# Runbook: Roll Back a Deployment

## When to use

A deployment in the last 2 hours correlates with a new error spike, latency regression, or failing health checks, and a forward fix is not ready within 15 minutes.

## Procedure

Identify the previous stable version from the deploy history. Execute the rollback through the deployment pipeline (never by editing pods by hand). Requires approval from the on-call incident commander for tier-1 services.

## Verification

Health checks pass, and error rate and latency return to the pre-deploy baseline. Post a note in the incident channel with the rollback version.
