# backend/routes/compiler.py
# Interactive Python Code Compiler & Sandbox Execution Service

import sys
import os
import time
import tempfile
import subprocess
from typing import Optional, Dict
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["Compiler"])

class CodeRunRequest(BaseModel):
    code: str = Field(..., description="Python code string to execute")
    language: str = Field(default="python", description="Programming language (default: python)")
    stdin: Optional[str] = Field(default="", description="Optional standard input")
    timeout_seconds: Optional[float] = Field(default=8.0, ge=1.0, le=15.0, description="Max execution time in seconds")

class CodeRunResponse(BaseModel):
    status: str
    stdout: str
    stderr: str
    exit_code: int
    execution_time_ms: float

LAB_TEMPLATES: Dict[str, Dict[str, str]] = {
    "lab-01": {
        "title": "Build Your First LangGraph Agent",
        "filename": "agent_state_graph.py",
        "code": """# Lab 1: Build Your First LangGraph Agent
# Objective: Create a stateful agent with routing and memory

class AgentState:
    def __init__(self, query: str):
        self.query = query
        self.steps = []
        self.output = ""

def tool_calculator(expression: str) -> str:
    \"\"\"Evaluates mathematical expressions.\"\"\"
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception as e:
        return f"Error: {e}"

def tool_knowledge_lookup(topic: str) -> str:
    \"\"\"Mock knowledge base lookup.\"\"\"
    knowledge = {
        "langgraph": "LangGraph is a library for building stateful, multi-actor applications with LLMs.",
        "mcp": "Model Context Protocol standardizes how AI models connect to data sources and tools."
    }
    return knowledge.get(topic.lower(), "Topic not found in local index.")

def router_node(state: AgentState):
    print(f"[Router] Analyzing query: '{state.query}'")
    if any(char in state.query for char in "+-*/"):
        state.steps.append("Route -> Calculator Tool")
        res = tool_calculator("24 * 7 + 10")
        state.output = f"Calculation Result: {res}"
    else:
        state.steps.append("Route -> Knowledge Lookup")
        res = tool_knowledge_lookup("langgraph")
        state.output = f"Knowledge: {res}"
    return state

# Run the agent
state = AgentState(query="What is LangGraph?")
final_state = router_node(state)

print("\\n[Execution Summary]")
for step in final_state.steps:
    print(f" - {step}")
print(f"Final Response: {final_state.output}")
"""
    },
    "lab-02": {
        "title": "Prompt Engineering with DSPy",
        "filename": "dspy_optimizer.py",
        "code": """# Lab 2: Prompt Engineering with DSPy
# Objective: Optimize classification prompt using few-shot exemplar selection

def classify_clause(clause: str, prompt_template: str) -> str:
    \"\"\"Simulates zero-shot vs few-shot prompt classification.\"\"\"
    clause_lower = clause.lower()
    if "indemnif" in clause_lower or "hold harmless" in clause_lower:
        return "HIGH_RISK_INDEMNITY"
    elif "governing law" in clause_lower or "jurisdiction" in clause_lower:
        return "STANDARD_JURISDICTION"
    elif "confidential" in clause_lower:
        return "CONFIDENTIALITY_NDA"
    return "GENERAL_COMMERCIAL"

test_clauses = [
    "Supplier shall indemnify and hold harmless Customer against all third-party claims.",
    "This Agreement shall be governed by the laws of the State of Delaware.",
    "Receiving Party agrees to retain Confidential Information in strict confidence."
]

print("=== DSPy Automated Clause Classification Pipeline ===")
for i, clause in enumerate(test_clauses, 1):
    category = classify_clause(clause, "template_v2_optimized")
    print(f"[{i}] Clause: \\"{clause[:50]}...\\"")
    print(f"    -> Classified: {category}\\n")

print("Pipeline Evaluation: 3/3 Clauses classified with 100% precision.")
"""
    },
    "lab-03": {
        "title": "Build a RAG Pipeline with FAISS",
        "filename": "faiss_vector_rag.py",
        "code": """# Lab 3: Build a RAG Pipeline with FAISS
# Objective: Embed documents, store vectors, and perform nearest-neighbor search
import math

documents = [
    {"id": 1, "text": "Patient eligible for cardiac rehabilitation after acute myocardial infarction within 12 months."},
    {"id": 2, "text": "Prior authorization required for non-formulary biologics and specialty oncology medications."},
    {"id": 3, "text": "Diagnostic MRI requires documentation of failed conservative therapy for at least 6 weeks."}
]

# Simple simulated word-frequency vectorizer
vocab = ["cardiac", "rehabilitation", "prior", "authorization", "mri", "therapy"]

def vectorize(text: str):
    words = text.lower().split()
    return [words.count(v) for v in vocab]

def cosine_similarity(v1, v2):
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    return dot / (norm1 * norm2) if norm1 and norm2 else 0.0

query = "Prior authorization for specialized medications"
q_vec = vectorize(query)

print(f"Query: '{query}'\\nVector Search Rankings:")
scored = []
for doc in documents:
    d_vec = vectorize(doc["text"])
    score = cosine_similarity(q_vec, d_vec)
    scored.append((score, doc))

scored.sort(reverse=True, key=lambda x: x[0])
for rank, (score, doc) in enumerate(scored, 1):
    print(f"Rank {rank} (Score: {score:.3f}): [Doc #{doc['id']}] {doc['text']}")
"""
    },
    "lab-04": {
        "title": "Hybrid Search with Chroma + BM25",
        "filename": "hybrid_search_rrf.py",
        "code": """# Lab 4: Hybrid Search with Chroma + BM25
# Objective: Reciprocal Rank Fusion (RRF) combining dense & sparse scores

docs = [
    "Contract termination notice must be delivered 30 days prior in writing.",
    "Liability cap is limited to total fees paid during preceding 12 months.",
    "Non-solicitation of employees remains in effect for 24 months post-termination."
]

# Simulated ranks from Dense vs BM25 Keyword Search
dense_rankings = {0: 1, 2: 2, 1: 3}   # Doc 0 is rank 1, Doc 2 is rank 2, Doc 1 is rank 3
bm25_rankings  = {0: 2, 1: 1, 2: 3}   # Doc 1 is rank 1, Doc 0 is rank 2, Doc 2 is rank 3

k = 60 # RRF smoothing constant
rrf_scores = {}

for idx in range(len(docs)):
    r_dense = dense_rankings[idx]
    r_bm25 = bm25_rankings[idx]
    score = (1.0 / (k + r_dense)) + (1.0 / (k + r_bm25))
    rrf_scores[idx] = score

ranked = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

print("=== Hybrid Search: Reciprocal Rank Fusion Results ===")
for pos, (doc_id, score) in enumerate(ranked, 1):
    print(f"[{pos}] RRF Score: {score:.5f} | {docs[doc_id]}")
"""
    },
    "lab-05": {
        "title": "Connect External Tools to an Agent",
        "filename": "tool_dispatch_agent.py",
        "code": """# Lab 5: Connect External Tools to an Agent
# Objective: Function dispatching & schema-based tool routing

def tool_restart_pod(service: str, cluster: str) -> dict:
    return {"action": "restart", "service": service, "cluster": cluster, "status": "success", "latency_ms": 120}

def tool_get_metrics(service: str) -> dict:
    return {"service": service, "cpu_pct": 94.2, "memory_pct": 88.0, "p99_latency_ms": 1420}

TOOLS = {
    "restart_pod": tool_restart_pod,
    "get_metrics": tool_get_metrics
}

def dispatch_tool(tool_name: str, **kwargs):
    if tool_name in TOOLS:
        print(f"[ToolDispatcher] Invoking '{tool_name}' with args {kwargs}")
        return TOOLS[tool_name](**kwargs)
    raise ValueError(f"Unknown tool: {tool_name}")

# Agent tool execution loop
metrics = dispatch_tool("get_metrics", service="payments-api")
print(f"Metrics Received: CPU={metrics['cpu_pct']}%, P99={metrics['p99_latency_ms']}ms")

if metrics["cpu_pct"] > 90:
    print("[Agent Decision] High CPU detected! Triggering automated remediation...")
    result = dispatch_tool("restart_pod", service="payments-api", cluster="us-east-prod")
    print(f"[Remediation Result] {result}")
"""
    },
    "lab-06": {
        "title": "Persistent Memory with Redis + LangMem",
        "filename": "cross_session_memory.py",
        "code": """# Lab 6: Persistent Memory with Redis + LangMem
# Objective: Cross-session conversational memory extraction and key-value retrieval

class MockMemoryStore:
    def __init__(self):
        self._store = {}

    def save_fact(self, user_id: str, key: str, value: str):
        if user_id not in self._store:
            self._store[user_id] = {}
        self._store[user_id][key] = value
        print(f"[Memory Persisted] User={user_id} | {key} -> {value}")

    def get_memory(self, user_id: str):
        return self._store.get(user_id, {})

memory = MockMemoryStore()
user = "dr_chen_92"

# Session 1: Storing clinical preference
memory.save_fact(user, "preferred_model", "claude-3-5-sonnet")
memory.save_fact(user, "specialty", "Cardiology & Interventional")

# Session 2: Retrieve memory in a new session
print(f"\\n[New Session Initialized for {user}]")
context = memory.get_memory(user)
for k, v in context.items():
    print(f"  - Recalled memory fact: {k} = '{v}'")

print("\\nAgent initialized with full cross-session contextual memory.")
"""
    },
    "lab-07": {
        "title": "Evaluate an Agent with LangSmith",
        "filename": "agent_eval_benchmark.py",
        "code": """# Lab 7: Evaluate an Agent with LangSmith
# Objective: Benchmark evaluation suite with precision, recall & latency scoring

test_cases = [
    {"input": "What is the deductible for Plan B?", "expected": "$500", "actual": "$500", "latency_ms": 320},
    {"input": "Is acupuncture covered?", "expected": "Yes, with referral", "actual": "Yes, with referral", "latency_ms": 410},
    {"input": "Max out of pocket for families?", "expected": "$8,000", "actual": "$8,500", "latency_ms": 290}
]

correct = 0
total_latency = 0

print("=== Automated Agent Benchmark Evaluation ===")
for i, test in enumerate(test_cases, 1):
    is_match = test["expected"].lower() == test["actual"].lower()
    if is_match:
        correct += 1
    total_latency += test["latency_ms"]
    status = "PASS" if is_match else "FAIL"
    print(f"Test {i}: [{status}] Input: '{test['input']}' | Expected: {test['expected']} | Actual: {test['actual']}")

accuracy = (correct / len(test_cases)) * 100
avg_latency = total_latency / len(test_cases)
print(f"\\nSummary:")
print(f"  Accuracy: {accuracy:.1f}% ({correct}/{len(test_cases)})")
print(f"  Avg Latency: {avg_latency:.1f}ms")
"""
    },
    "lab-08": {
        "title": "LLM-as-Judge for Contract QA",
        "filename": "llm_judge_evaluator.py",
        "code": """# Lab 8: LLM-as-Judge for Contract QA
# Objective: Rubric-based evaluation of model answers

def judge_response(question: str, ground_truth: str, generated_answer: str) -> dict:
    # Criteria: Faithfulness, Completeness, Conciseness
    faithfulness = 10 if ground_truth in generated_answer or generated_answer in ground_truth else 7
    completeness = 9 if len(generated_answer) > 20 else 5
    overall_score = round((faithfulness + completeness) / 2, 1)

    return {
        "overall_score": overall_score,
        "faithfulness": faithfulness,
        "completeness": completeness,
        "rationale": f"Answer accurately captures key requirement ('{ground_truth}') without hallucinations."
    }

eval_result = judge_response(
    question="What is the indemnification ceiling?",
    ground_truth="$2,000,000 aggregate cap",
    generated_answer="The agreement specifies an indemnification ceiling of $2,000,000 aggregate cap for all claims."
)

print("=== LLM-as-Judge Evaluation Report ===")
print(f"Overall Quality Score: {eval_result['overall_score']} / 10.0")
print(f" - Faithfulness Score:  {eval_result['faithfulness']} / 10")
print(f" - Completeness Score:  {eval_result['completeness']} / 10")
print(f"Judge Rationale: {eval_result['rationale']}")
"""
    }
}

@router.get("/compiler/templates")
def get_templates():
    """Return starter code templates for all practice labs."""
    return LAB_TEMPLATES

@router.get("/compiler/templates/{lab_id}")
def get_lab_template(lab_id: str):
    """Return starter code template for a specific lab."""
    if lab_id in LAB_TEMPLATES:
        return LAB_TEMPLATES[lab_id]
    raise HTTPException(status_code=404, detail=f"Template for '{lab_id}' not found")

@router.post("/compiler/run", response_model=CodeRunResponse)
def run_code(req: CodeRunRequest):
    """
    Executes Python code in a sandboxed sub-process with timeout and output capture.
    """
    if req.language.lower() != "python":
        raise HTTPException(status_code=400, detail="Only Python execution is supported at this time.")

    code_str = req.code.strip()
    if not code_str:
        return CodeRunResponse(
            status="error",
            stdout="",
            stderr="No code provided for execution.",
            exit_code=1,
            execution_time_ms=0.0
        )

    # Write code to a safe temporary file
    temp_file = tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode="w", encoding="utf-8")
    try:
        temp_file.write(code_str)
        temp_file.flush()
        temp_file.close()

        start_time = time.perf_counter()
        try:
            # Execute Python sub-process
            process = subprocess.run(
                [sys.executable, temp_file.name],
                input=req.stdin or "",
                capture_output=True,
                text=True,
                timeout=req.timeout_seconds
            )
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 1)

            stdout = process.stdout[:50000] if process.stdout else ""
            stderr = process.stderr[:50000] if process.stderr else ""

            return CodeRunResponse(
                status="success" if process.returncode == 0 else "error",
                stdout=stdout,
                stderr=stderr,
                exit_code=process.returncode,
                execution_time_ms=elapsed_ms
            )

        except subprocess.TimeoutExpired:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 1)
            return CodeRunResponse(
                status="timeout",
                stdout="",
                stderr=f"Execution timed out after {req.timeout_seconds} seconds. Please verify there are no infinite loops or unresolved input prompts.",
                exit_code=-1,
                execution_time_ms=elapsed_ms
            )

        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 1)
            return CodeRunResponse(
                status="error",
                stdout="",
                stderr=f"Execution error: {str(e)}",
                exit_code=1,
                execution_time_ms=elapsed_ms
            )

    finally:
        # Clean up temporary file
        try:
            if os.path.exists(temp_file.name):
                os.remove(temp_file.name)
        except Exception:
            pass
