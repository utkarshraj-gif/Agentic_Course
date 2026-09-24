"""Class 9 - Launching a fine-tune on the data from finetune_data.py.

Two paths:
  openai : managed SFT / DPO on a hosted model (needs OPENAI_API_KEY)
  nemo   : LoRA on an open model with NVIDIA NeMo (GPU host; NeMo container).
           Prints the recipe - APIs move quickly, so check it against your NeMo release notes.

Run:  python -m classes.class09_agentic_rag_finetuning.launch_finetune openai|nemo
"""
from __future__ import annotations

import os
import sys

from common import RUNS

DATA = RUNS / "finetune"

NEMO_RECIPE = f"""
# --- NVIDIA NeMo 2.x LoRA recipe (run inside nvcr.io/nvidia/nemo:<release> on a GPU host) ---
import nemo_run as run
from nemo.collections import llm

recipe = llm.llama3_8b.finetune_recipe(          # any supported open model recipe
    name="clinical_policy_lora",
    dir="/workspace/checkpoints",
    num_nodes=1, num_gpus_per_node=1,
    peft_scheme="lora",                           # low-rank adapters: ~0.1-1% of weights trained
)
recipe.data = run.Config(llm.FineTuningDataModule,  # expects input/output JSONL
    dataset_root="{DATA}", seq_length=4096, micro_batch_size=1, global_batch_size=8)
recipe.trainer.max_steps = 300
recipe.optim.config.lr = 1e-4
run.run(recipe, executor=run.LocalExecutor())

# Convert chat JSONL -> NeMo input/output JSONL first:
#   {{"input": "<system>\\n<user>", "output": "<assistant>"}}
# Serve the merged model or the LoRA adapter with vLLM / NVIDIA NIM (Class 10):
#   vllm serve meta-llama/Meta-Llama-3-8B-Instruct --enable-lora --lora-modules policy=/workspace/checkpoints/...
"""


def openai_sft() -> None:
    from openai import OpenAI
    client = OpenAI()
    train = client.files.create(file=open(DATA / "sft_train.jsonl", "rb"), purpose="fine-tune")
    val = client.files.create(file=open(DATA / "sft_val.jsonl", "rb"), purpose="fine-tune")
    job = client.fine_tuning.jobs.create(model=os.getenv("FT_BASE_MODEL", "gpt-4o-mini-2024-07-18"),
                                         training_file=train.id, validation_file=val.id,
                                         suffix="clinical-policy")
    print("started job", job.id, "- evaluate the result with Class 7 before switching traffic")


if __name__ == "__main__":
    which = (sys.argv[1:] or ["nemo"])[0]
    if not (DATA / "sft_train.jsonl").exists():
        sys.exit("run finetune_data.py first")
    if which == "openai":
        if not os.getenv("OPENAI_API_KEY"):
            sys.exit("set OPENAI_API_KEY")
        openai_sft()
    else:
        print(NEMO_RECIPE)
