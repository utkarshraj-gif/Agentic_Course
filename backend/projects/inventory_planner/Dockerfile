# One image, three agents - the command picks which agent a container runs.
# Build from the repository root:  docker build -f projects/inventory_planner/Dockerfile -t inventory-agents .
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY common/ common/
COPY data/inventory/ data/inventory/
COPY projects/inventory_planner/ projects/inventory_planner/
RUN useradd -m app && mkdir -p runs && chown app runs
USER app
ENV PYTHONUNBUFFERED=1 AGENT=planner PORT=8103
EXPOSE 8101 8102 8103
HEALTHCHECK CMD python -c "import os,urllib.request;urllib.request.urlopen(f'http://localhost:{os.environ[\"PORT\"]}/health')"
CMD ["sh", "-c", "uvicorn projects.inventory_planner.${AGENT}:app --host 0.0.0.0 --port ${PORT}"]
