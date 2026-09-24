"""Class 2 - From hand-written prompts to *programs* with DSPy.

Instead of editing prompt strings, you declare a Signature (inputs -> outputs), pick a module
(Predict, ChainOfThought, ReAct) and let an optimizer compile few-shot demos / instructions
against a metric on your labelled data.

Requires:  pip install dspy  and OPENAI_API_KEY.  (Skipped gracefully otherwise.)
Run:       python -m classes.class02_prompt_engineering.dspy_program
"""
from __future__ import annotations

import os
import sys

from common.domain import CLAUSE_TYPES, load_clause_labels, load_contract_sections


def main() -> None:
    try:
        import dspy
    except ImportError:
        print("dspy not installed - `pip install dspy` to run this lesson. "
              "Read build_and_optimize() below for the program.")
        return
    if not os.getenv("OPENAI_API_KEY"):
        print("Set OPENAI_API_KEY to compile the DSPy program.")
        return
    build_and_optimize(dspy)


def build_and_optimize(dspy):
    dspy.configure(lm=dspy.LM(f"openai/{os.getenv('LLM_MODEL', 'gpt-4o-mini')}"))

    class ClassifyClause(dspy.Signature):
        """Classify a contract clause and rate its risk to our side against market standards."""
        section_title: str = dspy.InputField()
        clause: str = dspy.InputField()
        our_role: str = dspy.InputField()
        clause_type: str = dspy.OutputField(desc=f"one of {CLAUSE_TYPES}")
        risk: str = dspy.OutputField(desc="low | medium | high")

    program = dspy.ChainOfThought(ClassifyClause)

    examples = []
    for lab in load_clause_labels():
        sec = next(s for s in load_contract_sections(lab["contract"]) if s["section"] == lab["section"])
        examples.append(dspy.Example(section_title=sec["section"], clause=sec["text"],
                                     our_role=sec["meta"].get("our_role", "customer"),
                                     clause_type=lab["clause_type"], risk=lab["risk"])
                        .with_inputs("section_title", "clause", "our_role"))
    train, dev = examples[::2], examples[1::2]

    def metric(gold, pred, trace=None):
        return (gold.clause_type == pred.clause_type) + (gold.risk == pred.risk.lower()) / 2

    evaluate = dspy.Evaluate(devset=dev, metric=metric, display_progress=False)
    print("baseline:", evaluate(program))
    optimizer = dspy.BootstrapFewShot(metric=metric, max_bootstrapped_demos=4)
    compiled = optimizer.compile(program, trainset=train)
    print("optimized:", evaluate(compiled))
    compiled.save("runs/clause_classifier_dspy.json")


if __name__ == "__main__":
    sys.exit(main())
