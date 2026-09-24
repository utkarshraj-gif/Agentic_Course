"""Class 14 — Total Cost of Ownership (TCO) & Break-Even Calculator

Compares linear cloud API costs ($/MTok) against dedicated self-hosted
GPU infrastructure across varying enterprise query volumes.
"""

from typing import Dict, Any

def calculate_tco(daily_tokens_million: float) -> Dict[str, Any]:
    # Proprietary API Rates (blend of input/output per million tokens)
    # GPT-4o estimate: $5.00 blended per 1M tokens
    api_rate_per_mtok = 5.00
    monthly_api_cost = daily_tokens_million * 30 * api_rate_per_mtok

    # Dedicated Self-Hosted Setup:
    # 1x Node with 4x NVIDIA A100 (80GB SXM4) for Llama-3.1-70B
    # Hourly cloud rate approx $12.50/hr -> $9,000 / month (reserved instance)
    gpu_node_monthly_cost = 9000.00
    maint_and_eng_overhead = 2500.00
    total_self_hosted_monthly = gpu_node_monthly_cost + maint_and_eng_overhead

    # Cost Delta
    savings = monthly_api_cost - total_self_hosted_monthly
    recommendation = "Self-Hosted (vLLM / Open Weights)" if savings > 0 else "Cloud Proprietary API"

    return {
        "daily_volume_tokens": f"{daily_tokens_million:,.1f}M tokens/day",
        "monthly_api_spend": f"${monthly_api_cost:,.2f}",
        "monthly_self_hosted_tco": f"${total_self_hosted_monthly:,.2f}",
        "monthly_savings": f"${abs(savings):,.2f} ({'Saved' if savings > 0 else 'Cheaper via API'})",
        "optimal_strategy": recommendation,
    }

def print_break_even_matrix():
    volumes = [0.5, 1.0, 2.3, 5.0, 10.0, 25.0]
    print(f"{'Daily Tokens':<15} | {'Monthly API Cost':<18} | {'Self-Hosted TCO':<18} | {'Strategy'}")
    print("-" * 75)
    for v in volumes:
        res = calculate_tco(v)
        print(f"{res['daily_volume_tokens']:<15} | {res['monthly_api_spend']:<18} | {res['monthly_self_hosted_tco']:<18} | {res['optimal_strategy']}")

if __name__ == "__main__":
    print("=== Enterprise LLM Total Cost of Ownership (TCO) Matrix ===\n")
    print_break_even_matrix()
