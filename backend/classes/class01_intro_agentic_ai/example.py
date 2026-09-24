"""Class 1 - Anatomy of an agent, built from scratch.

Scenario (clinical): a prior-authorization intake assistant receives a free-text question
from a clinic and must decide which tools to call before answering:
    "Does member M-2231 need prior auth for a lumbar MRI, and how fast will we hear back?"

We implement the same task two ways:
  1. a fixed WORKFLOW  - the developer hard-codes the steps
  2. an AGENT          - the model chooses the next tool each turn (ReAct loop)

Run:  python -m classes.class01_intro_agentic_ai.example
"""
from __future__ import annotations

import json

from common.llm import get_llm
from common.tools import ToolRegistry, tool

# --------------------------------------------------------------------------- tools (fake systems)
POLICIES = {
    "mri lumbar": {"policy_id": "MP-RAD-014", "requires_pa": True, "codes": ["72148"]},
    "semaglutide": {"policy_id": "MP-RX-221", "requires_pa": True, "codes": ["semaglutide"]},
    "office visit": {"policy_id": None, "requires_pa": False, "codes": ["99213"]},
}
MEMBERS = {"M-2231": {"plan": "Gold PPO", "active": True, "pa_turnaround_days": {"standard": 3, "urgent": 1}}}


@tool()
def find_policy(service: str) -> dict:
    """Look up whether a service requires prior authorization and which medical policy applies."""
    s = service.lower()
    for key, val in POLICIES.items():
        if all(w in s for w in key.split()):
            return {"service": key, **val}
    return {"service": service, "policy_id": None, "requires_pa": "unknown"}


@tool()
def check_member(member_id: str) -> dict:
    """Return plan and eligibility details for a health-plan member ID like M-1234."""
    m = MEMBERS.get(member_id)
    if not m:
        raise KeyError(f"member {member_id} not found")
    return {"member_id": member_id, **m}


@tool()
def turnaround(member_id: str, urgent: bool = False) -> dict:
    """Return the expected prior-auth decision time in days for a member (urgent or standard)."""
    days = MEMBERS[member_id]["pa_turnaround_days"]["urgent" if urgent else "standard"]
    return {"member_id": member_id, "urgent": urgent, "days": days}


registry = ToolRegistry().register(find_policy, check_member, turnaround)

QUESTION = "Does member M-2231 need prior auth for a lumbar MRI, and how fast will we hear back?"


# --------------------------------------------------------------------------- 1. workflow
def workflow(question: str) -> str:
    """Deterministic: always the same three calls in the same order."""
    policy = registry.call("find_policy", {"service": "MRI lumbar"}).output
    member = registry.call("check_member", {"member_id": "M-2231"}).output
    t = registry.call("turnaround", {"member_id": "M-2231"}).output
    return (f"Prior auth required: {policy['requires_pa']} (policy {policy['policy_id']}). "
            f"Member on {member['plan']}; expect a decision in {t['days']} business days.")


# --------------------------------------------------------------------------- 2. agent (ReAct)
SYSTEM = """You are a prior-authorization intake assistant for a health plan.
Use the tools to look up facts; never guess policy or eligibility.
When you have enough information, answer in two sentences and name the policy ID."""


def offline_planner(observations: list[dict]):
    """Stand-in for the model's reasoning when no API key is set.
    It mimics what a good model does: gather missing facts, then answer."""
    called = {o["tool"] for o in observations}
    if "find_policy" not in called:
        return lambda: {"tool": "find_policy", "args": {"service": "lumbar MRI"},
                        "thought": "I need to know if a lumbar MRI requires PA."}
    if "check_member" not in called:
        return lambda: {"tool": "check_member", "args": {"member_id": "M-2231"},
                        "thought": "Confirm the member is active and see their plan."}
    if "turnaround" not in called:
        return lambda: {"tool": "turnaround", "args": {"member_id": "M-2231", "urgent": False},
                        "thought": "The user asked how fast - get standard turnaround."}
    p = next(o["output"] for o in observations if o["tool"] == "find_policy")
    t = next(o["output"] for o in observations if o["tool"] == "turnaround")
    return lambda: {"final": f"Yes - a lumbar MRI requires prior authorization under {p['policy_id']}. "
                             f"For member M-2231 a standard decision takes about {t['days']} business days."}


def agent(question: str, max_steps: int = 6, verbose: bool = True) -> str:
    llm = get_llm()
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}]
    observations: list[dict] = []
    for step in range(1, max_steps + 1):
        action = llm.next_action(messages, registry.schemas(), fallback=offline_planner(observations))
        if "final" in action:
            if verbose:
                print(f"  step {step}: FINAL -> {action['final']}")
            return action["final"]
        if verbose:
            print(f"  step {step}: {action.get('thought', '')}\n           ACT  {action['tool']}({action['args']})")
        res = registry.call(action["tool"], action["args"])
        obs = res.output if res.ok else {"error": res.error}
        if verbose:
            print(f"           OBS  {json.dumps(obs)}")
        observations.append({"tool": action["tool"], "output": obs})
        # feed the observation back (OpenAI tool-message format when online)
        call_id = action.get("call_id", f"call_{step}")
        messages.append({"role": "assistant", "content": None, "tool_calls": [
            {"id": call_id, "type": "function",
             "function": {"name": action["tool"], "arguments": json.dumps(action["args"])}}]})
        messages.append({"role": "tool", "tool_call_id": call_id, "content": json.dumps(obs)})
    return "Stopped: step budget exhausted (escalate to a human)."


if __name__ == "__main__":
    print(f"LLM mode: {get_llm().mode}\n")
    print("1) WORKFLOW (developer decides the steps)")
    print("  ", workflow(QUESTION))
    print("\n2) AGENT (model decides the steps - ReAct loop)")
    answer = agent(QUESTION)
    print("\nAudit trail (every tool call is logged):")
    for e in registry.audit:
        print(f"   {e['tool']:<12} ok={e['ok']}  {e['latency_ms']}ms")
