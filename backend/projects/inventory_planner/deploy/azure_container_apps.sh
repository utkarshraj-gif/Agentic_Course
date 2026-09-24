#!/usr/bin/env bash
# Deploy the three A2A agents to Azure Container Apps (one environment, internal ingress for
# forecaster/supplier, external ingress for the planner). Requires: az CLI logged in, Docker.
# Review names/regions first; this creates billable resources.
set -euo pipefail

RG=${RG:-rg-agentic-course}
LOC=${LOC:-centralindia}
ACR=${ACR:-acragenticcourse$RANDOM}
ENV_NAME=${ENV_NAME:-cae-agents}
IMAGE=inventory-agents:$(git rev-parse --short HEAD 2>/dev/null || echo v1)
A2A_TOKEN=${A2A_TOKEN:?set A2A_TOKEN (store it in Key Vault in production)}

az group create -n "$RG" -l "$LOC"
az acr create -g "$RG" -n "$ACR" --sku Basic --admin-enabled false
az acr build -r "$ACR" -t "$IMAGE" -f projects/inventory_planner/Dockerfile .
az containerapp env create -g "$RG" -n "$ENV_NAME" -l "$LOC"

deploy() {  # name port ingress
  az containerapp create -g "$RG" -n "$1" --environment "$ENV_NAME" \
    --image "$ACR.azurecr.io/$IMAGE" --registry-server "$ACR.azurecr.io" --registry-identity system \
    --target-port "$2" --ingress "$3" --min-replicas 1 --max-replicas 5 \
    --secrets a2a-token="$A2A_TOKEN" openai-key="${OPENAI_API_KEY:-none}" \
    --env-vars AGENT="$1" PORT="$2" A2A_TOKEN=secretref:a2a-token OPENAI_API_KEY=secretref:openai-key \
      FORECASTER_URL="http://forecaster" SUPPLIER_URL="http://supplier" \
    --scale-rule-name http --scale-rule-type http --scale-rule-http-concurrency 20
}
deploy forecaster 8101 internal
deploy supplier 8102 internal
deploy planner 8103 external

PLANNER=$(az containerapp show -g "$RG" -n planner --query properties.configuration.ingress.fqdn -o tsv)
echo "Planner Agent Card: https://$PLANNER/.well-known/agent-card.json"
# Next: Application Insights (OpenTelemetry) for traces, Key Vault for secrets, revisions for canary:
#   az containerapp revision set-mode -g $RG -n planner --mode multiple
#   az containerapp ingress traffic set -g $RG -n planner --revision-weight latest=10 <stable>=90
