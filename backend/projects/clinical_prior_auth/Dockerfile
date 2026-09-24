# Build from the repository root:  docker build -f projects/clinical_prior_auth/Dockerfile -t prior-auth .
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY common/ common/
COPY data/clinical/ data/clinical/
COPY projects/clinical_prior_auth/ projects/clinical_prior_auth/
ENV PYTHONUNBUFFERED=1
RUN useradd -m app && mkdir -p runs && chown app runs
USER app
EXPOSE 8001
HEALTHCHECK CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8001/health')"
CMD ["uvicorn", "projects.clinical_prior_auth.api:app", "--host", "0.0.0.0", "--port", "8001"]
