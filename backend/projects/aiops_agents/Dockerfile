# Build from the repository root:  docker build -f projects/aiops_agents/Dockerfile -t aiops-agents .
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY common/ common/
COPY data/aiops/ data/aiops/
COPY projects/aiops_agents/ projects/aiops_agents/
ENV PYTHONUNBUFFERED=1
RUN useradd -m app && mkdir -p runs && chown app runs
USER app
EXPOSE 8003
HEALTHCHECK CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8003/health')"
CMD ["uvicorn", "projects.aiops_agents.api:app", "--host", "0.0.0.0", "--port", "8003"]
