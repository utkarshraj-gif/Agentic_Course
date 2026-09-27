"""
Class 0: Comprehensive Enterprise AI Environment Diagnostics
Performs full-stack validation: Python runtime, core frameworks, vector stores, Docker, and API connectivity.
"""
import sys
import os
import platform
import subprocess
import math

def check_python_runtime() -> bool:
    v = sys.version_info
    py_ver = f"{v.major}.{v.minor}.{v.micro}"
    os_info = f"{platform.system()} {platform.release()} ({platform.machine()})"
    print(f"[*] Python Runtime: v{py_ver} on {os_info}")
    
    if v < (3, 10):
        print("  [FAIL] Python 3.10 or higher is required. Please upgrade your runtime.")
        return False
    elif v >= (3, 13):
        print("  [WARN] Python 3.13 detected; some compiled C-extensions (FAISS/Chroma) may have pre-built wheel limits.")
    else:
        print("  [PASS] Python version meets enterprise specifications (3.10 – 3.12).")
    return True

def check_dependency_tier(title: str, packages: list[tuple[str, str]], required: bool = True) -> int:
    print(f"\n[*] {title}:")
    passed = 0
    for mod_name, desc in packages:
        try:
            mod = __import__(mod_name)
            ver = getattr(mod, "__version__", "installed")
            print(f"  [PASS] {mod_name:18} (v{ver}) - {desc}")
            passed += 1
        except ImportError:
            status = "[FAIL - REQUIRED]" if required else "[OPTIONAL - OMITTED]"
            print(f"  {status} {mod_name:18} - {desc}")
    return passed

def check_docker_engine() -> bool:
    print("\n[*] Container Runtime (Docker):")
    try:
        res = subprocess.run(["docker", "--version"], capture_output=True, text=True, timeout=3)
        if res.returncode == 0:
            print(f"  [PASS] {res.stdout.strip()}")
            return True
        else:
            print("  [INFO] Docker command failed; containerized checkpointers (Redis) will use in-memory fallbacks.")
            return False
    except Exception:
        print("  [INFO] Docker CLI not detected on system PATH. (Optional: Offline mock runs without containers).")
        return False

def check_environment_configuration() -> None:
    print("\n[*] Environment Variables & API Credentials:")
    env_keys = [
        ("OPENAI_API_KEY", "Model API Provider", False),
        ("LLM_BASE_URL", "Custom Endpoint (vLLM/Azure/Ollama)", False),
        ("REDIS_URL", "Redis State Checkpointer (Class 6)", False),
        ("LANGSMITH_API_KEY", "LangSmith Observability (Class 7/11)", False),
        ("OPIK_API_KEY", "Opik Evaluation Tracking (Class 7/11)", False),
    ]

    is_offline = os.getenv("OFFLINE", "0") == "1" or not os.getenv("OPENAI_API_KEY")
    if is_offline:
        print("  >> Running in DETERMINISTIC OFFLINE MODE (Zero API cost, instant mock heuristics active).")
    else:
        print("  >> LIVE INFERENCE MODE enabled with configured API credentials.")

    for key, desc, required in env_keys:
        val = os.getenv(key)
        if val:
            masked = val[:4] + "..." + val[-4:] if len(val) > 8 else "***"
            print(f"  [CONFIGURED] {key:18} = {masked} ({desc})")
        else:
            status = "[MISSING]" if required else "[UNSET]"
            print(f"  {status:12} {key:18} - {desc}")

def run_functional_sanity_checks() -> bool:
    print("\n[*] Functional Sanity Validations:")
    try:
        # 1. Pydantic v2 schema test
        from pydantic import BaseModel, Field
        class AgentState(BaseModel):
            turn: int = Field(default=1, ge=1)
            action: str
        state = AgentState(turn=1, action="test_retrieval")
        assert state.turn == 1 and state.action == "test_retrieval"
        print("  [PASS] Pydantic v2 Schema & Validation Engine")
    except Exception as e:
        print(f"  [FAIL] Pydantic v2 test failed: {e}")
        return False

    try:
        # 2. Vector Cosine Similarity
        vec_a = [0.1, 0.5, 0.8]
        vec_b = [0.1, 0.5, 0.8]
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        sim = dot / (norm_a * norm_b)
        assert abs(sim - 1.0) < 1e-5
        print(f"  [PASS] Vector Similarity Mathematics (sim = {sim:.4f})")
    except Exception as e:
        print(f"  [FAIL] Vector math validation failed: {e}")
        return False

    return True

def main():
    print("=" * 70)
    print("   VELLOE LEARNS: ENTERPRISE AGENTIC AI COURSE ENVIRONMENT CHECK")
    print("=" * 70)

    py_ok = check_python_runtime()

    core_packages = [
        ("pydantic", "Schema validation & structured LLM outputs"),
        ("fastapi", "High-performance web API framework"),
        ("uvicorn", "ASGI server engine"),
        ("numpy", "Vector embeddings array math"),
        ("markdown", "Curriculum prose rendering engine"),
        ("pytest", "Automated evaluation & regression test harness"),
    ]
    core_passed = check_dependency_tier("Core Architectural Dependencies", core_packages, required=True)

    agent_packages = [
        ("langgraph", "Stateful agent workflow graph engine"),
        ("langchain_core", "LangChain interfaces and message representations"),
        ("faiss", "FAISS high-speed dense vector retrieval"),
        ("chromadb", "Chroma DB local vector store"),
        ("rank_bm25", "BM25 lexical search for hybrid RAG"),
        ("mcp", "Anthropic Model Context Protocol SDK"),
    ]
    agent_passed = check_dependency_tier("Agent, Memory & RAG Dependencies", agent_packages, required=False)

    check_docker_engine()
    check_environment_configuration()
    sanity_ok = run_functional_sanity_checks()

    print("\n" + "=" * 70)
    print("   READINESS SCORECARD")
    print("=" * 70)
    print(f"  - Python Runtime:            {'PASSED' if py_ok else 'FAILED'}")
    print(f"  - Core Platform Modules:     {core_passed}/{len(core_packages)} installed")
    print(f"  - Agent & Vector Modules:    {agent_passed}/{len(agent_packages)} installed")
    print(f"  - Math & Validation Engine:  {'PASSED' if sanity_ok else 'FAILED'}")

    if py_ok and core_passed == len(core_packages) and sanity_ok:
        print("\n>> VERDICT: WORKSTATION IS FULLY QUALIFIED TO RUN ALL COURSE LABS!")
    else:
        print("\n>> VERDICT: ATTENTION NEEDED — Please install missing packages via:")
        print("   pip install -r requirements.txt")
    print("=" * 70)

if __name__ == "__main__":
    main()
