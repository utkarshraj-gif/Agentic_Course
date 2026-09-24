# Build from the repository root:  docker build -f projects/legal_contract_review/Dockerfile -t contract-review .
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY common/ common/
COPY data/legal/ data/legal/
COPY projects/legal_contract_review/ projects/legal_contract_review/
ENV PYTHONUNBUFFERED=1
RUN useradd -m app && mkdir -p runs && chown app runs
USER app
EXPOSE 8002
HEALTHCHECK CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8002/health')"
CMD ["uvicorn", "projects.legal_contract_review.api:app", "--host", "0.0.0.0", "--port", "8002"]
