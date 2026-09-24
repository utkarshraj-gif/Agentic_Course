PY ?= python3

.PHONY: install test classes projects all clean

install:
	$(PY) -m pip install -r requirements.txt

test:
	$(PY) -m pytest -q tests

classes:
	$(PY) -m classes.class01_intro_agentic_ai.example
	$(PY) -m classes.class01_intro_agentic_ai.langgraph_version > /dev/null
	$(PY) -m classes.class02_prompt_engineering.example
	$(PY) -m classes.class03_embeddings_rag.example
	$(PY) -m classes.class04_rag_design.example
	$(PY) -m classes.class05_tool_engineering.example --approve
	$(PY) -m classes.class06_memory_mcp.mcp_client
	$(PY) -m classes.class06_memory_mcp.memory_demo
	$(PY) -m classes.class07_evaluation.example
	$(PY) -m classes.class08_error_analysis_judge.example
	$(PY) -m classes.class09_agentic_rag_finetuning.agentic_rag
	$(PY) -m classes.class09_agentic_rag_finetuning.finetune_data
	$(PY) -m classes.class10_inference_optimization.example
	$(PY) -m classes.class11_observability_guardrails.guarded_pipeline
	$(PY) -m classes.class11_observability_guardrails.trace_report
	$(PY) -m classes.class12_inventory_a2a_deployment.example > /dev/null

projects:
	$(PY) -m projects.clinical_prior_auth.run
	$(PY) -m projects.legal_contract_review.run
	$(PY) -m projects.aiops_agents.run
	$(PY) -m projects.inventory_planner.run

all: test classes projects

clean:
	rm -rf runs .pytest_cache
	find . -name __pycache__ -type d -prune -exec rm -rf {} +
