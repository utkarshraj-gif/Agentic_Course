"""Class 6 - Short-term, episodic and semantic memory for a clinical documentation assistant.

  * short-term : LangGraph checkpointer keyed by thread_id - the conversation survives across
                 turns (and process restarts with a durable checkpointer such as Redis/Postgres).
  * semantic   : durable user preferences extracted from conversation ("I prefer bullets").
  * episodic   : a one-line summary of each finished session, recalled in later sessions.

Namespaces isolate memories per clinician - Dr. Rao never sees Dr. Mehta's memories.
MemoryStore uses Redis when REDIS_URL is set, otherwise an in-process dict.

Run:  python -m classes.class06_memory_mcp.memory_demo
"""
from __future__ import annotations

import operator
import re
from typing import Annotated, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from common.llm import get_llm
from common.memory import MemoryStore

store = MemoryStore()


class Chat(TypedDict):
    user_id: str
    messages: Annotated[list[dict], operator.add]


# ----------------------------------------------------------------------------- memory extraction
PREF_PATTERNS = [r"\bi prefer ([^.]+)", r"\balways ([^.]+)", r"\bremember that ([^.]+)", r"\bplease never ([^.]+)"]


def extract_memories(text: str) -> list[str]:
    """LangMem-style extraction. Online: ask the LLM for durable facts as JSON.
    Offline: pattern rules for explicit preference statements."""
    def offline():
        return "\n".join(m.group(0).strip() for p in PREF_PATTERNS for m in re.finditer(p, text, re.I))
    out = get_llm().chat(
        "Extract durable user preferences or facts worth remembering from this message, one per line. "
        f"Return nothing if none.\n\n{text}", fallback=offline)
    return [line.strip("- ").strip() for line in out.splitlines() if line.strip()]


# ----------------------------------------------------------------------------- the graph
def respond(state: Chat) -> dict:
    uid = state["user_id"]
    last = state["messages"][-1]["content"]
    for fact in extract_memories(last):                       # write path
        store.add(f"prefs:{uid}", fact, kind="preference", importance=0.8)
    prefs = store.recall(f"prefs:{uid}", last, k=3)            # read path
    episodes = store.recall(f"episodes:{uid}", last, k=1)
    history = len([m for m in state["messages"] if m["role"] == "user"])

    def offline():
        style = " ".join(p.text for p in prefs) or "no stored preferences"
        prev = f" Last time: {episodes[0].text}" if episodes else ""
        return f"(turn {history} in this thread · applying: {style}.{prev})"

    system = ("You are a clinical documentation assistant. Apply these user preferences: "
              + "; ".join(p.text for p in prefs) + ". Previous sessions: " + "; ".join(e.text for e in episodes))
    reply = get_llm().chat([{"role": "system", "content": system}, *state["messages"]], fallback=offline)
    return {"messages": [{"role": "assistant", "content": reply}]}


def build():
    g = StateGraph(Chat)
    g.add_node("respond", respond)
    g.add_edge(START, "respond")
    g.add_edge("respond", END)
    return g.compile(checkpointer=MemorySaver())


def say(app, thread: str, uid: str, text: str) -> str:
    out = app.invoke({"user_id": uid, "messages": [{"role": "user", "content": text}]},
                     {"configurable": {"thread_id": thread}})
    reply = out["messages"][-1]["content"]
    print(f"  [{uid} · {thread}] you: {text}\n  {'':>{len(uid) + len(thread) + 5}}bot: {reply}")
    return reply


if __name__ == "__main__":
    app = build()
    print("Session 1 - Dr. Rao states preferences (semantic memory is written)")
    say(app, "t1", "dr-rao", "I prefer bullet-point summaries with the policy ID first.")
    say(app, "t1", "dr-rao", "Summarise the MRI prior-auth criteria.")
    store.add("episodes:dr-rao", "Reviewed lumbar MRI criteria for PA-1001; pending PT dates.", kind="episode")

    print("\nShort-term memory: same thread continues, new thread starts empty")
    state = app.get_state({"configurable": {"thread_id": "t1"}}).values
    print(f"  thread t1 holds {len(state['messages'])} messages; "
          f"thread t2 holds {len(app.get_state({'configurable': {'thread_id': 't2'}}).values.get('messages', []))}")

    print("\nSession 2 (new thread) - long-term memory is recalled")
    say(app, "t2", "dr-rao", "Draft the GLP-1 criteria summary for today's case.")

    print("\nIsolation - another clinician gets none of Dr. Rao's memories")
    say(app, "t3", "dr-mehta", "Summarise the knee arthroscopy criteria.")

    print("\nStored memories:", [(m.kind, m.text) for ns in ("prefs:dr-rao", "episodes:dr-rao") for m in store.list(ns)])
