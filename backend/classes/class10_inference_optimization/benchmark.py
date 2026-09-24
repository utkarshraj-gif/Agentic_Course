"""Class 10 - Load-test any OpenAI-compatible endpoint (vLLM, NIM, Azure OpenAI, OpenAI).

Measures time-to-first-token (TTFT), end-to-end latency and output tokens/s at several
concurrency levels - the numbers you need to size GPUs and set autoscaling targets.
vLLM's continuous batching should raise aggregate tokens/s with concurrency while TTFT
grows slowly; a saturated server shows TTFT exploding.

Run:  LLM_BASE_URL=http://localhost:8000/v1 LLM_MODEL=meta-llama/Llama-3.1-8B-Instruct \
      OPENAI_API_KEY=dummy python -m classes.class10_inference_optimization.benchmark
"""
from __future__ import annotations

import asyncio
import os
import statistics
import time

PROMPT = ("Summarise the prior-authorization criteria for lumbar MRI in three bullet points: "
          "6 weeks of symptoms, 6 weeks of conservative therapy, and a planned change in management.")


async def one(client, model: str) -> tuple[float, float, int]:
    t0 = time.perf_counter()
    ttft, n = None, 0
    stream = await client.chat.completions.create(model=model, stream=True, max_tokens=128,
                                                  messages=[{"role": "user", "content": PROMPT}])
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            ttft = ttft or time.perf_counter() - t0
            n += 1
    return ttft or 0.0, time.perf_counter() - t0, n


async def level(client, model: str, concurrency: int, rounds: int = 3) -> dict:
    results = []
    t0 = time.perf_counter()
    for _ in range(rounds):
        results += await asyncio.gather(*[one(client, model) for _ in range(concurrency)])
    wall = time.perf_counter() - t0
    ttfts, lats, toks = zip(*results)
    return {"concurrency": concurrency, "ttft_p50_ms": 1000 * statistics.median(ttfts),
            "latency_p50_ms": 1000 * statistics.median(lats), "agg_tokens_per_s": sum(toks) / wall}


async def main() -> None:
    if not os.getenv("LLM_BASE_URL") and not os.getenv("OPENAI_API_KEY"):
        print("Set LLM_BASE_URL (e.g. a local vLLM server) or OPENAI_API_KEY to benchmark a real endpoint.")
        return
    from openai import AsyncOpenAI
    client = AsyncOpenAI(base_url=os.getenv("LLM_BASE_URL"), api_key=os.getenv("OPENAI_API_KEY", "dummy"))
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    print(f"{'conc':>5}{'TTFT p50 ms':>14}{'latency p50 ms':>16}{'agg tok/s':>12}")
    for c in (1, 4, 16):
        r = await level(client, model, c)
        print(f"{c:>5}{r['ttft_p50_ms']:>14.0f}{r['latency_p50_ms']:>16.0f}{r['agg_tokens_per_s']:>12.1f}")


if __name__ == "__main__":
    asyncio.run(main())
