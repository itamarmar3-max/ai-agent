/**
 * Cost tracking — turns token usage into an actual USD estimate.
 *
 * Previously the agent reported only a raw token count (and often a crude
 * char/4 guess), so there was no way to know what a session actually costs —
 * exactly the blind spot that turns a $0.50 test workflow into a five-figure
 * monthly bill at scale. This module maps a model id to per-million-token
 * pricing and computes a running cost the loop can surface and budget against.
 *
 * Prices are USD per 1M tokens and are approximate; unknown models fall back
 * to a conservative default so a session is never reported as "free".
 */

export interface ModelPricing {
  /** USD per 1M input (prompt) tokens. */
  input: number;
  /** USD per 1M output (completion) tokens. */
  output: number;
}

// Keyed by a substring matched against the (lower-cased) model id. Order
// matters: more specific keys should come before more general ones.
const PRICING_TABLE: Array<{ match: string; pricing: ModelPricing }> = [
  // OpenAI
  { match: 'gpt-4o-mini', pricing: { input: 0.15, output: 0.6 } },
  { match: 'gpt-4o', pricing: { input: 2.5, output: 10 } },
  { match: 'gpt-4.1-mini', pricing: { input: 0.4, output: 1.6 } },
  { match: 'gpt-4.1', pricing: { input: 2, output: 8 } },
  { match: 'gpt-4-turbo', pricing: { input: 10, output: 30 } },
  { match: 'gpt-4', pricing: { input: 30, output: 60 } },
  { match: 'gpt-3.5', pricing: { input: 0.5, output: 1.5 } },
  { match: 'o3-mini', pricing: { input: 1.1, output: 4.4 } },
  { match: 'o1-mini', pricing: { input: 1.1, output: 4.4 } },
  { match: 'o1', pricing: { input: 15, output: 60 } },
  // Anthropic
  { match: 'claude-3-5-haiku', pricing: { input: 0.8, output: 4 } },
  { match: 'claude-3-haiku', pricing: { input: 0.25, output: 1.25 } },
  { match: 'haiku', pricing: { input: 0.8, output: 4 } },
  { match: 'claude-3-5-sonnet', pricing: { input: 3, output: 15 } },
  { match: 'sonnet', pricing: { input: 3, output: 15 } },
  { match: 'opus', pricing: { input: 15, output: 75 } },
  // Google
  { match: 'gemini-1.5-flash', pricing: { input: 0.075, output: 0.3 } },
  { match: 'gemini-2.0-flash', pricing: { input: 0.1, output: 0.4 } },
  { match: 'gemini-1.5-pro', pricing: { input: 1.25, output: 5 } },
  // Open models — typically self-hosted / cheap
  { match: 'llama', pricing: { input: 0.2, output: 0.2 } },
  { match: 'mistral', pricing: { input: 0.2, output: 0.6 } },
  { match: 'qwen', pricing: { input: 0.2, output: 0.6 } },
  { match: 'deepseek', pricing: { input: 0.27, output: 1.1 } },
];

// Conservative fallback for unrecognised models.
const DEFAULT_PRICING: ModelPricing = { input: 1, output: 3 };

/** Look up per-1M-token pricing for a model id. */
export function getModelPricing(model: string): ModelPricing {
  const id = (model || '').toLowerCase();
  for (const entry of PRICING_TABLE) {
    if (id.includes(entry.match)) return entry.pricing;
  }
  return DEFAULT_PRICING;
}

/** Estimate USD cost for a given input/output token split on a model. */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getModelPricing(model);
  const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  // Round to 6 decimals — sub-cent precision without float noise.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Accumulates token usage and cost across a session, so the loop can both
 * report a final figure and stop early when a budget is exceeded.
 */
export class CostTracker {
  private inputTokens = 0;
  private outputTokens = 0;

  constructor(
    private readonly model: string,
    /** Optional hard ceiling in USD. When exceeded, `isOverBudget()` is true. */
    private readonly budgetUsd?: number,
  ) {}

  add(inputTokens: number, outputTokens: number): void {
    this.inputTokens += Math.max(0, inputTokens);
    this.outputTokens += Math.max(0, outputTokens);
  }

  get totalTokens(): number {
    return this.inputTokens + this.outputTokens;
  }

  get costUsd(): number {
    return estimateCost(this.model, this.inputTokens, this.outputTokens);
  }

  isOverBudget(): boolean {
    return this.budgetUsd !== undefined && this.costUsd >= this.budgetUsd;
  }

  snapshot(): { inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number } {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.totalTokens,
      costUsd: this.costUsd,
    };
  }
}
