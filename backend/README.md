# Agentic AI Course — Backend Service

FastAPI-powered backend service for the **Building Enterprise AI Agents** course platform.

## Architecture

```
backend/
├── __init__.py
├── main.py              # FastAPI application, CORS middleware, route registrations
├── config.py            # Environment configurations, path definitions, CORS origins
├── run.py               # Standalone runner script
├── models/
│   ├── __init__.py
│   ├── course.py        # Pydantic schemas for ClassModule, CapstoneProject, TechStackItem
│   └── agent.py         # Pydantic schemas for AgentRunRequest, AgentRunResponse, AgentStatus
├── routes/
│   ├── __init__.py
│   ├── health.py        # GET /api/health - Health check and system info
│   ├── curriculum.py    # GET /api/curriculum, GET /api/curriculum/{id}, GET /api/curriculum/tech-stack
│   ├── capstones.py     # GET /api/capstones, GET /api/capstones/{id}
│   └── agents.py        # GET /api/agents, POST /api/agents/run
└── services/
    ├── __init__.py
    ├── course_service.py # Curriculum & Capstone loader
    └── agent_service.py  # Agent execution & simulation engine (AIOps, Clinical, Legal, Inventory)
```

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Backend Server
Using the standalone runner:
```bash
python backend/run.py
```
Or directly with Uvicorn:
```bash
uvicorn backend.main:app --reload --port 8000
```

### 3. Access Interactive Docs & Endpoints
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Curriculum API**: [http://localhost:8000/api/curriculum](http://localhost:8000/api/curriculum)
- **Capstones API**: [http://localhost:8000/api/capstones](http://localhost:8000/api/capstones)
- **Agent Sandbox API**: [http://localhost:8000/api/agents](http://localhost:8000/api/agents)

## API Reference

### Health
- `GET /api/health` — System status, Python version, platform information.

### Curriculum
- `GET /api/curriculum` — List all 12 course classes (filterable by `?week=N` and `?search=term`).
- `GET /api/curriculum/{class_id}` — Get detailed syllabus, topics, and code files for a specific class.
- `GET /api/curriculum/tech-stack` — Get production technology stack details.

### Capstones
- `GET /api/capstones` — List the 4 enterprise capstone projects with full architecture tiers.
- `GET /api/capstones/{capstone_id}` — Detailed specifications for a given capstone (`clinical_prior_auth`, `legal_contract_review`, `aiops_agents`, `inventory_planner`).

### Agent Execution Sandbox
- `GET /api/agents` — List available agent engines and capabilities.
- `POST /api/agents/run` — Run an agent trajectory with simulated or synthetic data:
  ```json
  {
    "agent_id": "aiops",
    "simulate": true
  }
  ```
