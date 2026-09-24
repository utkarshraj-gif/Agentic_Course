"""Class 11 - Export agent spans with OpenTelemetry (vendor-neutral).

OpenTelemetry's GenAI semantic conventions (gen_ai.* attributes) let any backend - Azure
Monitor / Application Insights, Grafana Tempo, Datadog, Honeycomb, Langfuse, Phoenix - show
LLM calls next to your HTTP and database spans.

pip install opentelemetry-sdk opentelemetry-exporter-otlp
Run:  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 python -m classes.class11_observability_guardrails.otel_setup
      (without an endpoint, spans print to the console)
"""
from __future__ import annotations

import os


def tracer():
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

    provider = TracerProvider(resource=Resource.create({"service.name": "clinical-assistant",
                                                        "deployment.environment": os.getenv("ENV", "dev")}))
    if os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    else:
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)
    return trace.get_tracer("agentic-course")


if __name__ == "__main__":
    try:
        t = tracer()
    except ImportError:
        print("pip install opentelemetry-sdk opentelemetry-exporter-otlp to run this example.")
        raise SystemExit(0)
    with t.start_as_current_span("clinical_assistant") as root:
        root.set_attribute("app.version", "1.4.0")
        with t.start_as_current_span("chat gpt-4o-mini") as sp:        # GenAI semantic conventions
            sp.set_attribute("gen_ai.operation.name", "chat")
            sp.set_attribute("gen_ai.request.model", "gpt-4o-mini")
            sp.set_attribute("gen_ai.usage.input_tokens", 812)
            sp.set_attribute("gen_ai.usage.output_tokens", 96)
        with t.start_as_current_span("output_guard") as sp:
            sp.set_attribute("guardrail.result", "allowed")
