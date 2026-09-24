"""A small, production-minded tool layer (Class 5).

Features you want in every enterprise tool, independent of framework:
  * JSON schema generated from type hints (what the model sees)
  * argument validation with pydantic before execution
  * risk level + human-approval gate for side-effecting tools
  * timeouts / retries / structured errors the model can recover from
  * an audit trail of every call
"""
from __future__ import annotations

import inspect
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Literal, get_type_hints

from pydantic import ValidationError, create_model

Risk = Literal["read", "write", "destructive"]


@dataclass
class Tool:
    name: str
    description: str
    fn: Callable[..., Any]
    risk: Risk = "read"
    requires_approval: bool = False
    retries: int = 1
    args_model: Any = None

    @property
    def schema(self) -> dict:
        s = self.args_model.model_json_schema()
        s.pop("title", None)
        return {"name": self.name, "description": self.description, "parameters": s}


@dataclass
class ToolResult:
    ok: bool
    output: Any = None
    error: str | None = None
    latency_ms: float = 0.0


def tool(risk: Risk = "read", requires_approval: bool | None = None, retries: int = 1):
    """Decorator: turn a typed python function into a Tool. The docstring is the description."""
    def wrap(fn: Callable) -> Tool:
        hints = get_type_hints(fn)
        sig = inspect.signature(fn)
        fields = {}
        for p in sig.parameters.values():
            ann = hints.get(p.name, str)
            default = ... if p.default is inspect.Parameter.empty else p.default
            fields[p.name] = (ann, default)
        model = create_model(f"{fn.__name__}_args", **fields)
        return Tool(name=fn.__name__, description=inspect.getdoc(fn) or fn.__name__, fn=fn,
                    risk=risk, retries=retries, args_model=model,
                    requires_approval=(risk != "read") if requires_approval is None else requires_approval)
    return wrap


@dataclass
class ToolRegistry:
    tools: dict[str, Tool] = field(default_factory=dict)
    audit: list[dict] = field(default_factory=list)
    approver: Callable[[Tool, dict], bool] = lambda t, a: False  # deny by default

    def register(self, *tools: Tool) -> "ToolRegistry":
        for t in tools:
            self.tools[t.name] = t
        return self

    def schemas(self) -> list[dict]:
        return [t.schema for t in self.tools.values()]

    def call(self, name: str, args: dict, actor: str = "agent") -> ToolResult:
        started = time.perf_counter()
        entry = {"ts": time.time(), "actor": actor, "tool": name, "args": args}
        t = self.tools.get(name)
        if t is None:
            res = ToolResult(False, error=f"unknown tool '{name}'. Available: {list(self.tools)}")
        else:
            try:
                parsed = t.args_model.model_validate(args).model_dump()
            except ValidationError as e:
                res = ToolResult(False, error=f"invalid arguments: {e.errors()[0]['msg']} "
                                              f"at {e.errors()[0]['loc']}")
            else:
                if t.requires_approval and not self.approver(t, parsed):
                    res = ToolResult(False, error="approval_required: a human must approve this action")
                else:
                    res = self._run(t, parsed)
        res.latency_ms = round((time.perf_counter() - started) * 1000, 2)
        entry.update(ok=res.ok, error=res.error, latency_ms=res.latency_ms)
        self.audit.append(entry)
        return res

    @staticmethod
    def _run(t: Tool, args: dict) -> ToolResult:
        err = None
        for attempt in range(t.retries + 1):
            try:
                return ToolResult(True, output=t.fn(**args))
            except Exception as e:  # noqa: BLE001 - errors go back to the model as text
                err = f"{type(e).__name__}: {e}"
                time.sleep(0.05 * (2 ** attempt))
        return ToolResult(False, error=err)
