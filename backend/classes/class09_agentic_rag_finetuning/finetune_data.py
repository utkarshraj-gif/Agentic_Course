"""Class 9 - Preparing fine-tuning data from your own agent's traces and labels.

Produces three datasets in runs/finetune/:
  sft_train.jsonl / sft_val.jsonl  - chat-format supervised examples (OpenAI / NeMo / HF TRL)
  dpo_pairs.jsonl                  - preference pairs (chosen vs rejected) from Class 8 labels

Quality gates applied before anything is written:
  * PHI/PII scrub (fails the build if any identifier survives)
  * de-duplication by normalised prompt
  * answers must carry a valid citation (grounded behaviour is what we want to teach)
  * deterministic train/val split by hash (no leakage between runs)

Run:  python -m classes.class09_agentic_rag_finetuning.finetune_data
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from common import RUNS
from common.domain import load_clinical_golden
from common.guardrails import PII_PATTERNS, redact
from common.retrieval import HybridRetriever, chunk_markdown, extractive_answer, format_context, load_markdown_dir
from common import DATA

OUT = RUNS / "finetune"
SYSTEM = ("You answer health-plan medical policy questions using only the provided context. "
          "Cite [chunk-id] after each sentence. Say 'Not found in policy documents.' if unsupported.")


def sft_examples() -> list[dict]:
    retr = HybridRetriever([c for d, t in load_markdown_dir(DATA / "clinical" / "guidelines")
                            for c in chunk_markdown(d, t, 700)])
    rows = []
    for g in load_clinical_golden():
        res = retr.search(g["q"], 3)
        answer = extractive_answer(g["q"], res, n=2)   # in practice: human-approved or judge-PASS outputs
        rows.append({"messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Context:\n{format_context(res)}\n\nQuestion: {g['q']}"},
            {"role": "assistant", "content": answer}]})
    # teach refusal too - a behaviour prompting alone often under-delivers
    rows.append({"messages": [{"role": "system", "content": SYSTEM},
                              {"role": "user", "content": "Context:\n(none relevant)\n\nQuestion: Is acupuncture covered?"},
                              {"role": "assistant", "content": "Not found in policy documents."}]})
    return rows


def dpo_pairs() -> list[dict]:
    samples = json.loads((Path(__file__).parents[1] / "class08_error_analysis_judge" / "samples.json").read_text())
    by_q: dict[str, dict[str, list]] = {}
    for s in samples:
        by_q.setdefault(s["question"], {"pass": [], "fail": []})[s["human"]].append(s["answer"])
    return [{"prompt": q, "chosen": v["pass"][0], "rejected": v["fail"][0]}
            for q, v in by_q.items() if v["pass"] and v["fail"]]


def gate(rows: list[dict]) -> list[dict]:
    seen, out = set(), []
    for r in rows:
        text = json.dumps(r)
        text = redact(text).text
        for label, pat in PII_PATTERNS.items():
            if label != "CARD" and re.search(pat, text, re.I):
                raise ValueError(f"PII ({label}) survived scrubbing - refusing to write training data")
        r = json.loads(text)
        prompt = r["messages"][1]["content"] if "messages" in r else r["prompt"]
        key = re.sub(r"\W+", " ", prompt.split("Question:")[-1].lower()).strip()
        if key in seen:
            continue
        seen.add(key)
        answer = r["messages"][-1]["content"] if "messages" in r else r["chosen"]
        if "Not found" not in answer and not re.search(r"\[[\w\-]+#\d+\]", answer):
            continue
        out.append(r)
    return out


def split(rows: list[dict], val_pct: int = 20):
    train, val = [], []
    for r in rows:
        h = int(hashlib.sha256(json.dumps(r, sort_keys=True).encode()).hexdigest(), 16) % 100
        (val if h < val_pct else train).append(r)
    if not val and len(train) > 4:          # tiny datasets: guarantee a validation example
        val.append(train.pop())
    return train, val


def write(name: str, rows: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text("\n".join(json.dumps(r) for r in rows) + "\n")


if __name__ == "__main__":
    sft = gate(sft_examples())
    train, val = split(sft)
    write("sft_train.jsonl", train)
    write("sft_val.jsonl", val)
    dpo = gate(dpo_pairs())
    write("dpo_pairs.jsonl", dpo)
    print(f"SFT: {len(train)} train / {len(val)} val · DPO pairs: {len(dpo)} -> {OUT}")
    print("example SFT assistant turn:", train[0]["messages"][-1]["content"][:160], "…")
    print("example DPO pair:", json.dumps(dpo[0])[:240], "…")
