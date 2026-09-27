// data/capstones.ts
// Central registry and curriculum mapping for Enterprise Capstone Projects

export interface CapstoneProjectItem {
  id: string;
  slug: string;
  title: string;
  short: string;
  domain: string;
  pattern: string;
  metric: string;
  color: string;
  description: string;
  tools: string[];
  relevantWeeks: number[];
  relevantClasses: number[];
  classHighlight?: Record<number, string>;
  weekHighlight?: Record<number, string>;
}

export const ALL_CAPSTONES: CapstoneProjectItem[] = [
  {
    id: 'clinical_prior_auth',
    slug: 'clinical_prior_auth',
    title: 'Clinical Prior-Authorization Assistant',
    short: 'Clinical Prior-Auth',
    domain: 'Healthcare',
    pattern: 'Workflow + Human Review (HITL)',
    metric: '6/6 recommendations correct · PHI never reaches LLM',
    color: '#07D2E0',
    description: 'Automate insurance prior-authorization reviews by extracting medical criteria from patient charts and matching against policy guidelines with human-in-the-loop escalation.',
    tools: ['LangGraph', 'Hybrid RAG', 'Human-in-the-Loop', 'FHIR', 'Guardrails'],
    relevantWeeks: [1, 2, 4, 5, 7],
    relevantClasses: [1, 3, 7, 9, 11, 15],
    classHighlight: {
      1: 'Powers the clinical intake workflow and state graph architecture in this capstone.',
      3: 'Implements hybrid RAG retrieval over insurance policy guidelines and medical documentation.',
      7: 'Forms the evaluation test suite for clinical prior-authorization accuracy and hallucination defense.',
      9: 'Applies agentic retrieval loops and policy-specialized fine-tuning for complex prior-auth cases.',
      11: 'Enforces HIPAA-compliant PHI masking guardrails and OpenTelemetry tracing for clinical agents.',
      15: 'Implements physician escalation queues and human-in-the-loop approval workflows for borderline determinations.',
    },
    weekHighlight: {
      1: 'Applies Foundations of Agentic AI to the Clinical Prior-Auth graph architecture.',
      2: 'Implements policy guideline search and medical chart retrieval using RAG.',
      4: 'Evaluates clinical recommendation accuracy and diagnostic trajectory safety.',
      5: 'Optimizes clinical reasoning with fine-tuning and agentic RAG loops.',
      7: 'Deploys human-in-the-loop clinician escalation checkpoints and PHI guardrails.',
    },
  },
  {
    id: 'legal_contract_review',
    slug: 'legal_contract_review',
    title: 'Legal Contract Review Agent',
    short: 'Contract Review',
    domain: 'Legal',
    pattern: 'Map-Reduce over Clauses',
    metric: '19/20 clause risks correct · Counsel escalation',
    color: '#8B5CF6',
    description: 'Analyze complex commercial contracts (MSAs, NDAs, DPAs), identify high-risk non-standard clauses, suggest redlines against corporate playbooks, and generate risk scores.',
    tools: ['LangGraph', 'Chroma DB', 'Map-Reduce', 'LangSmith', 'Prompt Engineering'],
    relevantWeeks: [1, 2, 4],
    relevantClasses: [2, 4, 8],
    classHighlight: {
      2: 'Defines prompt engineering templates and clause risk extraction schemas for commercial agreements.',
      4: 'Builds multi-vector contract indexing and playbook retrieval across MSAs, NDAs, and DPAs.',
      8: 'Uses LLM-as-Judge and error analysis to audit contract clause redline recommendations.',
    },
    weekHighlight: {
      1: 'Applies prompt engineering and agent design to legal clause risk categorization.',
      2: 'Builds chunking strategies and semantic search over 50+ page legal agreements.',
      4: 'Conducts error analysis and LLM-as-Judge audits on legal redlines.',
    },
  },
  {
    id: 'aiops_agents',
    slug: 'aiops_agents',
    title: 'Autonomous AIOps Incident Responder',
    short: 'AIOps Agents',
    domain: 'IT Operations',
    pattern: 'Supervisor + 4 Specialists',
    metric: '3/3 root causes · 1 duplicate alert dropped',
    color: '#10B981',
    description: 'Full-cycle automated incident resolution: ingest Alertmanager webhooks, correlate telemetry across logs/metrics/traces, formulate remediation plans, and execute with human approvals.',
    tools: ['LangGraph', 'Tool Engineering', 'MCP', 'OpenTelemetry', 'A2A Protocol'],
    relevantWeeks: [3, 4, 7],
    relevantClasses: [5, 6, 7, 10, 13],
    classHighlight: {
      5: 'Develops tool definitions for executing kubectl, Datadog queries, and network diagnostics.',
      6: 'Connects MCP servers and LangMem persistent checkpointers for incident memory across shifts.',
      7: 'Validates multi-turn incident resolution trajectories and tool-calling accuracy.',
      10: 'Optimizes LLM inference latency for real-time P0 incident triage pipelines.',
      13: 'Hardens the AIOps execution environment against prompt injection and unauthorized system commands.',
    },
    weekHighlight: {
      3: 'Implements MCP tool servers and checkpointer memory for automated incident response.',
      4: 'Tracks multi-agent telemetry and evaluates incident root-cause hypotheses.',
      7: 'Secures infrastructure tools against prompt injection and unauthorized command execution.',
    },
  },
  {
    id: 'inventory_planner',
    slug: 'inventory_planner',
    title: 'Supply Chain Inventory Planner',
    short: 'Inventory Planner',
    domain: 'Supply Chain',
    pattern: 'Peer Agents over A2A',
    metric: '3 POs within budget · Approval via input-required',
    color: '#F59E0B',
    description: 'Multi-agent supply chain optimization system: predict stockouts across regional warehouses, simulate supplier disruptions, and coordinate PO generation through A2A negotiation.',
    tools: ['LangGraph', 'Multi-Agent', 'A2A Protocol', 'Docker', 'Azure Container Apps'],
    relevantWeeks: [6, 7],
    relevantClasses: [12, 14, 15],
    classHighlight: {
      12: 'The centerpiece case study: coordinates autonomous inventory agents using the A2A protocol.',
      14: 'Compares local open-source models (Llama 3) vs proprietary APIs for supply chain simulation.',
      15: 'Establishes human approval thresholds for high-dollar purchase orders and transfer requisitions.',
    },
    weekHighlight: {
      6: 'The primary capstone project: Multi-agent coordination and A2A negotiation across fulfillment centers.',
      7: 'Deploys open-source agent runtimes with human approval gates for capital expenditures.',
    },
  },
];

export function getCapstonesForWeek(weekNum: number): CapstoneProjectItem[] {
  if (weekNum === 0) return []; // Prerequisites
  return ALL_CAPSTONES.filter(c => c.relevantWeeks.includes(weekNum));
}

export function getCapstonesForClass(classId: number): CapstoneProjectItem[] {
  if (classId === 0) return [];
  return ALL_CAPSTONES.filter(c => c.relevantClasses.includes(classId));
}

export function getPrimaryCapstoneForClass(classId: number): CapstoneProjectItem | null {
  const capstones = getCapstonesForClass(classId);
  return capstones.length > 0 ? capstones[0] : null;
}
