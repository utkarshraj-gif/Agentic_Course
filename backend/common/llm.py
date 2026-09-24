"""Provider-agnostic LLM client used by every class and project.

Two modes:
  * online  - OPENAI_API_KEY is set (optionally LLM_BASE_URL for vLLM / Azure OpenAI /
              any OpenAI-compatible server). Real model calls.
  * offline - no key, or OFFLINE=1. Every call site passes a deterministic `fallback`
              so the whole course runs end-to-end on a laptop with no network and no cost.

The offline fallbacks are intentionally simple heuristics. They are there so you can
study the *architecture* (graphs, tools, memory, evals, guardrails) before paying for
tokens. Swap in a real model and the same code paths run unchanged.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any, Callable, Type, TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)


class LLM:
    def __init__(self, model: str | None = None, base_url: str | None = None,
                 api_key: str | None = None, temperature: float = 0.0):
        self.model = model or os.getenv("LLM_MODEL", "gpt-4o-mini")
        self.base_url = base_url or os.getenv("LLM_BASE_URL")
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.temperature = temperature
        self.online = bool(self.api_key) and os.getenv("OFFLINE", "0") != "1"
        self._client = None
        self.usage = {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0, "latency_s": 0.0}

    # ------------------------------------------------------------------ plumbing
    @property
    def client(self):
        if self._client is None:
            from openai import OpenAI  # imported lazily so offline mode needs no SDK
            self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    def _record(self, resp, started: float) -> None:
        self.usage["calls"] += 1
        self.usage["latency_s"] += time.perf_counter() - started
        u = getattr(resp, "usage", None)
        if u:
            self.usage["prompt_tokens"] += u.prompt_tokens or 0
            self.usage["completion_tokens"] += u.completion_tokens or 0

    @property
    def mode(self) -> str:
        return f"online:{self.model}" if self.online else "offline:heuristic"

    # ------------------------------------------------------------------ text
    def chat(self, messages: list[dict] | str, *, fallback: Callable[[], str] | None = None,
             temperature: float | None = None, max_tokens: int = 800) -> str:
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        if not self.online:
            self.usage["calls"] += 1
            return fallback() if fallback else "[offline] set OPENAI_API_KEY for real completions."
        started = time.perf_counter()
        resp = self.client.chat.completions.create(
            model=self.model, messages=messages, max_tokens=max_tokens,
            temperature=self.temperature if temperature is None else temperature)
        self._record(resp, started)
        return resp.choices[0].message.content or ""

    # ------------------------------------------------------------------ structured output
    def structured(self, messages: list[dict] | str, schema: Type[T], *,
                   fallback: Callable[[], T | dict], retries: int = 2) -> T:
        """Return a validated pydantic object. Retries with the validation error on failure."""
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        if not self.online:
            self.usage["calls"] += 1
            out = fallback()
            return out if isinstance(out, schema) else schema.model_validate(out)
        sys = {"role": "system", "content": (
            "Reply with ONLY a JSON object that validates against this JSON schema:\n"
            + json.dumps(schema.model_json_schema()))}
        convo = [sys, *messages]
        last_err = None
        for _ in range(retries + 1):
            started = time.perf_counter()
            resp = self.client.chat.completions.create(
                model=self.model, messages=convo, temperature=0,
                response_format={"type": "json_object"})
            self._record(resp, started)
            raw = resp.choices[0].message.content or "{}"
            try:
                return schema.model_validate_json(raw)
            except ValidationError as e:  # self-correction loop
                last_err = e
                convo += [{"role": "assistant", "content": raw},
                          {"role": "user", "content": f"That failed validation: {e}. Fix it."}]
        raise ValueError(f"structured output failed after retries: {last_err}")

    # ------------------------------------------------------------------ tool calling
    def next_action(self, messages: list[dict], tools: list[dict], *,
                    fallback: Callable[[], dict]) -> dict:
        """One reasoning step. Returns {"tool": name, "args": {...}} or {"final": text}.

        `tools` uses the OpenAI function schema format (see common/tools.py).
        """
        if not self.online:
            self.usage["calls"] += 1
            return fallback()
        started = time.perf_counter()
        resp = self.client.chat.completions.create(
            model=self.model, messages=messages, temperature=0,
            tools=[{"type": "function", "function": t} for t in tools])
        self._record(resp, started)
        msg = resp.choices[0].message
        if msg.tool_calls:
            call = msg.tool_calls[0]
            return {"tool": call.function.name, "args": json.loads(call.function.arguments or "{}"),
                    "call_id": call.id}
        return {"final": msg.content or ""}


_default: LLM | None = None


def get_llm() -> LLM:
    """Process-wide default client (reads env once)."""
    global _default
    if _default is None:
        _default = LLM()
    return _default


def extract_json(text: str) -> Any:
    """Best-effort JSON extraction from a model reply that may include prose or fences."""
    text = text.strip()
    if "```" in text:
        text = text.split("```")[1].removeprefix("json").strip()
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=0)
    return json.loads(text[start:])
