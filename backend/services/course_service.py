from pathlib import Path
from typing import List, Optional, Dict, Any
import re
import markdown
from functools import lru_cache

from backend.config import BASE_DIR, BACKEND_DIR
from backend.models.course import (
    ClassModule,
    ClassDetail,
    CapstoneProject,
    CapstoneDetail,
    TechStackItem,
    WeekInfo,
    CurriculumOverview,
    CodeFile
)

WEEKS_CONFIG = [
    {
        "n": 1,
        "title": "Foundations of Agentic AI",
        "classes": [1, 2],
        "summary": "Learn the foundations of AI agents and understand the enterprise landscape.",
        "tools": ["LangChain", "LangGraph", "OpenAI", "DSPy"]
    },
    {
        "n": 2,
        "title": "Retrieval & RAG",
        "classes": [3, 4],
        "summary": "Build and evaluate retrieval systems that ground agents in enterprise knowledge.",
        "tools": ["FAISS", "Chroma DB"]
    },
    {
        "n": 3,
        "title": "Tools, Integrations & Memory",
        "classes": [5, 6],
        "summary": "Equip agents with tools, external integrations, and persistent memory.",
        "tools": ["MCP", "LangMem", "Redis"]
    },
    {
        "n": 4,
        "title": "Evaluation & Complex Workflows",
        "classes": [7, 8],
        "summary": "Systematically evaluate agent quality and build complex workflows with LangGraph.",
        "tools": ["LangSmith", "Opik"]
    },
    {
        "n": 5,
        "title": "Agentic RAG & Performance",
        "classes": [9, 10],
        "summary": "Combine agentic reasoning with advanced retrieval and optimize for production performance.",
        "tools": ["LangGraph", "NVIDIA NeMo", "vLLM"]
    },
    {
        "n": 6,
        "title": "Production & Multi-Agent Systems",
        "classes": [11, 12],
        "summary": "Ship agents to production with guardrails, observability, and multi-agent coordination.",
        "tools": ["Docker", "Azure Cloud", "A2A Protocol"]
    },
    {
        "n": 7,
        "title": "Enterprise AI Security & Advanced Deployment",
        "classes": [13, 14, 15],
        "summary": "Secure enterprise applications, evaluate open-source models, and design robust human-in-the-loop workflows.",
        "tools": ["PromptArmor", "Llama 3", "HITL"]
    }
]

CLASS_DIRECTORIES = {
    1: "classes/class01_intro_agentic_ai",
    2: "classes/class02_prompt_engineering",
    3: "classes/class03_embeddings_rag",
    4: "classes/class04_rag_design",
    5: "classes/class05_tool_engineering",
    6: "classes/class06_memory_mcp",
    7: "classes/class07_evaluation",
    8: "classes/class08_error_analysis_judge",
    9: "classes/class09_agentic_rag_finetuning",
    10: "classes/class10_inference_optimization",
    11: "classes/class11_observability_guardrails",
    12: "classes/class12_inventory_a2a_deployment",
    13: "classes/class13_security_redteaming",
    14: "classes/class14_opensource_vs_proprietary",
    15: "classes/class15_hitl_deep_dive",
}

CLASS_META = {
    1: {"short": "Introduction to Agentic AI", "domain": "Clinical prior-authorization intake", "tools": ["LangChain", "LangGraph", "OpenAI"]},
    2: {"short": "Prompt Engineering and Designing Agents", "domain": "Legal clause triage", "tools": ["OpenAI", "LangChain", "DSPy"]},
    3: {"short": "Embeddings and RAG", "domain": "Clinical medical-policy Q&A", "tools": ["FAISS", "OpenAI embeddings"]},
    4: {"short": "RAG Design", "domain": "Legal contract and playbook search", "tools": ["Chroma DB", "FAISS", "BM25"]},
    5: {"short": "Tool Engineering", "domain": "AIOps incident investigation", "tools": ["OpenAI function calling", "LangGraph"]},
    6: {"short": "Memory in Agents and the Model Context Protocol", "domain": "AIOps tool server; clinical documentation assistant", "tools": ["MCP", "LangGraph checkpointer", "LangMem", "Redis"]},
    7: {"short": "Evaluating your Agent", "domain": "Clinical RAG assistant; AIOps agent trajectories", "tools": ["LangSmith", "Opik"]},
    8: {"short": "Error Analysis and LLM as Judge", "domain": "Legal contract Q&A", "tools": ["LangSmith", "Opik", "OpenAI"]},
    9: {"short": "Agentic RAG and Fine-tuning", "domain": "Clinical policy assistant", "tools": ["LangGraph", "NVIDIA NeMo", "OpenAI fine-tuning"]},
    10: {"short": "Inference Optimization", "domain": "Mixed clinical, legal and AIOps traffic", "tools": ["vLLM", "NVIDIA NeMo", "OpenAI"]},
    11: {"short": "Observability and Guardrails", "domain": "Clinical assistant with PHI", "tools": ["OpenTelemetry", "LangSmith", "Opik"]},
    12: {"short": "Case Study: Inventory Planner · A2A Protocol · Deployment", "domain": "Hospital medical-supplies replenishment", "tools": ["A2A Protocol", "Docker", "Azure Container Apps", "LangGraph"]},
    13: {"short": "Enterprise Security & Red Teaming", "domain": "Enterprise prompt injection defenses", "tools": ["PromptArmor", "NeMo Guardrails"]},
    14: {"short": "Open Source vs. Proprietary Models", "domain": "Local inference and cost analysis", "tools": ["Llama 3", "vLLM", "Mistral"]},
    15: {"short": "Deep Dive: Human-in-the-Loop", "domain": "Regulated industry approval workflows", "tools": ["LangGraph", "Approval Checkpoints"]},
}

CAPSTONES_CONFIG = [
    {
        "id": "clinical_prior_auth",
        "slug": "clinical_prior_auth",
        "title": "Clinical Prior-Authorization Assistant",
        "short": "Clinical Prior-Auth",
        "domain": "Healthcare",
        "pattern": "Workflow + human review",
        "metric": "6/6 recommendations correct · PHI never reaches LLM",
        "color": "cyan",
        "description": "Automate insurance prior-authorization reviews by extracting medical criteria from patient charts and matching against policy guidelines with human-in-the-loop escalation.",
        "directory": "projects/clinical_prior_auth",
        "entrypoint": "projects.clinical_prior_auth.run",
        "architecture": [
            "EMR patient chart parsing & FHIR schema normalization",
            "Insurance policy guideline retrieval via hybrid RAG",
            "Criterion-by-criterion evidence extraction & matching",
            "Confidence-scored recommendation with clinical justification",
            "Human-in-the-loop review queue for borderline cases"
        ],
        "api_available": True
    },
    {
        "id": "legal_contract_review",
        "slug": "legal_contract_review",
        "title": "Legal Contract Review Agent",
        "short": "Contract Review",
        "domain": "Legal",
        "pattern": "Map-reduce over clauses",
        "metric": "19/20 clause risks correct · counsel escalation",
        "color": "violet",
        "description": "Analyze complex commercial contracts (MSAs, NDAs, DPAs), identify high-risk non-standard clauses, suggest redlines against corporate playbooks, and generate risk scores.",
        "directory": "projects/legal_contract_review",
        "entrypoint": "projects.legal_contract_review.run",
        "architecture": [
            "Multi-page contract OCR & structural hierarchy extraction",
            "Clause classification across 20+ legal categories",
            "Playbook deviation analysis with risk severity scoring",
            "Automated redline generation with legal reasoning",
            "Comprehensive executive risk summary with negotiation points"
        ],
        "api_available": True
    },
    {
        "id": "aiops_agents",
        "slug": "aiops_agents",
        "title": "Autonomous AIOps Incident Responder",
        "short": "AIOps Agents",
        "domain": "IT Operations",
        "pattern": "Supervisor + 4 specialists",
        "metric": "3/3 root causes · 1 duplicate alert dropped",
        "color": "emerald",
        "description": "Full-cycle automated incident resolution: ingest Alertmanager webhooks, correlate telemetry across logs/metrics/traces, formulate remediation plans, and execute with human approvals.",
        "directory": "projects/aiops_agents",
        "entrypoint": "projects.aiops_agents.run",
        "architecture": [
            "Alert correlation & deduplication across services",
            "Root-cause hypothesis generation via log & metric analysis",
            "Remediation plan formulation with safety pre-checks",
            "Human-in-the-loop approval gates via REST/ChatOps",
            "Post-incident summary generation & runbook updates"
        ],
        "api_available": True
    },
    {
        "id": "inventory_planner",
        "slug": "inventory_planner",
        "title": "Supply Chain Inventory Planner",
        "short": "Inventory Planner",
        "domain": "Supply chain",
        "pattern": "Peer agents over A2A",
        "metric": "3 POs within budget · approval via input-required",
        "color": "amber",
        "description": "Multi-agent supply chain optimization system: predict stockouts across regional warehouses, simulate supplier disruptions, and coordinate PO generation through A2A negotiation.",
        "directory": "projects/inventory_planner",
        "entrypoint": "projects.inventory_planner.run",
        "architecture": [
            "Demand forecasting with seasonal & promotional trend models",
            "Multi-echelon inventory optimization across fulfillment centers",
            "Agent-to-Agent negotiation for inter-warehouse transfers",
            "Automated purchase order generation with vendor constraints",
            "Disruption scenario simulation & resilience scoring"
        ],
        "api_available": True
    }
]

TECH_STACK_DATA = [
    {"name": "LangGraph", "category": "Framework", "description": "Cyclic computational graphs with first-class state checkpointing", "badge": "Core"},
    {"name": "FastAPI", "category": "Serving", "description": "Production REST API for webhooks, agent endpoints, and human approvals", "badge": "Backend"},
    {"name": "DSPy", "category": "Prompting", "description": "Declarative prompt programming with automated metric-driven optimization", "badge": "Core"},
    {"name": "FAISS & Chroma", "category": "Retrieval", "description": "Vector similarity search with HNSW indexing and metadata filtering", "badge": "Vector"},
    {"name": "BM25 & RRF", "category": "Hybrid RAG", "description": "Lexical search combined with dense vector retrieval via reciprocal rank fusion", "badge": "RAG"},
    {"name": "Model Context Protocol", "category": "Integration", "description": "Anthropic's open standard for secure agent-to-tool and agent-to-data communication", "badge": "Protocol"},
    {"name": "Pydantic v2", "category": "Validation", "description": "High-performance data validation and structured schema enforcement", "badge": "Core"},
    {"name": "OpenTelemetry & Tracing", "category": "Observability", "description": "Distributed tracing for multi-step agent trajectories and latency profiling", "badge": "Ops"},
    {"name": "vLLM", "category": "Inference", "description": "High-throughput, low-latency LLM serving with PagedAttention", "badge": "Compute"},
    {"name": "Pytest", "category": "Testing", "description": "Automated regression testing and evaluation suites for agent reliability", "badge": "Quality"}
]

def _resolve_dir(sub_path: str) -> Path:
    p = BACKEND_DIR / sub_path
    if p.exists():
        return p
    return BASE_DIR / sub_path

def _parse_markdown_doc(text: str) -> tuple[str, List[str], List[str]]:
    diagrams = []
    def replace_mmd(m):
        idx = len(diagrams)
        diagrams.append(m.group(1).strip())
        return f'<div class="mmd" data-d="{idx}"></div>'

    # Extract Mermaid diagrams
    processed = re.sub(r'```mermaid\s*\n(.*?)\n```', replace_mmd, text, flags=re.DOTALL)

    # Convert to HTML
    html = markdown.markdown(processed, extensions=['fenced_code', 'tables'])

    # Add id to h2 tags for table of contents
    toc = []
    def add_h2_id(m):
        idx = len(toc)
        title = m.group(1).strip()
        clean_title = re.sub(r'<[^>]+>', '', title)
        toc.append(clean_title)
        return f'<h2 id="s{idx}">{title}</h2>'

    html = re.sub(r'<h2(?:\s+[^>]*)?>(.*?)</h2>', add_h2_id, html, flags=re.IGNORECASE)
    return html, diagrams, toc

def _read_code_files(folder_path: Path) -> List[CodeFile]:
    files = []
    if not folder_path.exists():
        return files
    
    # Priority order for display
    py_files = sorted(folder_path.glob("*.py"))
    docker_files = sorted(folder_path.glob("Dockerfile*"))
    all_files = py_files + docker_files
    
    for p in all_files:
        if p.name.startswith("__"):
            continue
        try:
            content = p.read_text(encoding="utf-8")
            lang = "python" if p.suffix == ".py" else ("dockerfile" if "docker" in p.name.lower() else "text")
            files.append(CodeFile(name=p.name, lang=lang, code=content))
        except Exception:
            pass
    return files


class CourseService:
    @staticmethod
    def get_overview() -> CurriculumOverview:
        weeks = [WeekInfo(**w) for w in WEEKS_CONFIG]
        all_tools = sorted(list(set(t for w in WEEKS_CONFIG for t in w["tools"])))
        
        # Summary dict of classes
        classes_summary = {}
        for num, sub in CLASS_DIRECTORIES.items():
            meta = CLASS_META.get(num, {})
            w_num = next((w["n"] for w in WEEKS_CONFIG if num in w["classes"]), 1)
            classes_summary[str(num)] = {
                "id": num,
                "title": f"Class {num} — {meta.get('short', '')}",
                "short": meta.get("short", f"Class {num}"),
                "domain": meta.get("domain", ""),
                "tools": meta.get("tools", []),
                "week": w_num,
                "folder": sub
            }

        return CurriculumOverview(
            weeks=weeks,
            classes=classes_summary,
            capstones=[dict(c) for c in CAPSTONES_CONFIG],
            tools=all_tools
        )

    @staticmethod
    def get_classes() -> List[ClassModule]:
        overview = CourseService.get_overview()
        result = []
        for cid_str, info in overview.classes.items():
            cid = int(cid_str)
            w_num = info["week"]
            folder = CLASS_DIRECTORIES.get(cid, "")
            dir_path = _resolve_dir(folder)
            readme_path = dir_path / "README.md"
            preview = None
            if readme_path.exists():
                try:
                    text = readme_path.read_text(encoding="utf-8")
                    preview = text[:400] + ("..." if len(text) > 400 else "")
                except Exception:
                    pass

            result.append(ClassModule(
                id=cid,
                class_num=cid,
                week=w_num,
                tag=f"Week {w_num}",
                title=info["title"],
                short=info["short"],
                description=info["domain"],
                topics=info["tools"],
                code_file=None,
                directory=folder,
                readme_preview=preview
            ))
        return result

    @staticmethod
    @lru_cache(maxsize=32)
    def get_class_detail(class_num: int) -> Optional[ClassDetail]:
        if class_num not in CLASS_DIRECTORIES:
            return None
        
        folder = CLASS_DIRECTORIES[class_num]
        dir_path = _resolve_dir(folder)
        readme_path = dir_path / "README.md"
        if not readme_path.exists():
            return None

        raw_text = readme_path.read_text(encoding="utf-8")
        
        # Remove first h1 from markdown since UI renders its own header
        cleaned_text = re.sub(r'^#\s+Class\s+\d+.*?\n', '', raw_text)
        # Strip redundant week/domain/tools metadata header block from prose since UI header displays them
        cleaned_text = re.sub(r'^\*\*Week\s+\d+.*?(?=\n##|\Z)', '', cleaned_text.strip(), flags=re.DOTALL).strip()
        
        html, diagrams, toc = _parse_markdown_doc(cleaned_text)
        files = _read_code_files(dir_path)
        meta = CLASS_META.get(class_num, {})
        w_cfg = next((w for w in WEEKS_CONFIG if class_num in w["classes"]), None)
        w_num = w_cfg["n"] if w_cfg else 1
        w_title = w_cfg["title"] if w_cfg else "Foundations"

        return ClassDetail(
            id=class_num,
            title=f"Class {class_num} — {meta.get('short', '')}",
            short=meta.get("short", f"Class {class_num}"),
            week=w_num,
            meta={"week": f"Week {w_num} · {w_title}", "tools": meta.get("tools", []), "domain": meta.get("domain", "")},
            html=html,
            diagrams=diagrams,
            toc=toc,
            files=files,
            folder=folder
        )

    @staticmethod
    def get_capstones() -> List[CapstoneProject]:
        return [CapstoneProject(**c) for c in CAPSTONES_CONFIG]

    @staticmethod
    @lru_cache(maxsize=16)
    def get_capstone_detail(slug: str) -> Optional[CapstoneDetail]:
        cfg = next((c for c in CAPSTONES_CONFIG if c["slug"] == slug or c["id"] == slug), None)
        if not cfg:
            return None

        dir_path = _resolve_dir(cfg["directory"])
        readme_path = dir_path / "README.md"
        if not readme_path.exists():
            return None

        raw_text = readme_path.read_text(encoding="utf-8")
        # Remove first title
        cleaned_text = re.sub(r'^#\s+.*?\n', '', raw_text)

        html, diagrams, toc = _parse_markdown_doc(cleaned_text)
        files = _read_code_files(dir_path)

        return CapstoneDetail(
            slug=cfg["slug"],
            title=cfg["title"],
            short=cfg["short"],
            domain=cfg["domain"],
            pattern=cfg["pattern"],
            metric=cfg["metric"],
            html=html,
            diagrams=diagrams,
            toc=toc,
            files=files,
            folder=cfg["directory"]
        )

    @staticmethod
    def get_capstone_by_id(capstone_id: str) -> Optional[CapstoneProject]:
        """Find a capstone by its id or slug."""
        return next(
            (CapstoneProject(**c) for c in CAPSTONES_CONFIG
             if c["id"] == capstone_id or c["slug"] == capstone_id),
            None
        )

    @staticmethod
    def get_tech_stack() -> List[TechStackItem]:
        return [TechStackItem(**t) for t in TECH_STACK_DATA]

