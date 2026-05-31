import { describe, it, expect } from 'vitest';
import { getModelPricing, estimateCost, CostTracker } from '@/agent/cost';

describe('getModelPricing', () => {
  it('matches known model families', () => {
    expect(getModelPricing('gpt-4o-mini').input).toBe(0.15);
    expect(getModelPricing('claude-3-5-sonnet-20241022').output).toBe(15);
    expect(getModelPricing('gemini-1.5-flash').input).toBeLessThan(1);
  });

  it('falls back to a non-zero default for unknown models', () => {
    const p = getModelPricing('some-random-model-x');
    expect(p.input).toBeGreaterThan(0);
    expect(p.output).toBeGreaterThan(0);
  });
});

describe('estimateCost', () => {
  it('computes cost from input/output token split', () => {
    // 1M input @ $2.5 + 1M output @ $10 = $12.5 for gpt-4o
    expect(estimateCost('gpt-4o', 1_000_000, 1_000_000)).toBeCloseTo(12.5, 5);
  });

  it('returns zero for zero usage', () => {
    expect(estimateCost('gpt-4o', 0, 0)).toBe(0);
  });
});

describe('CostTracker', () => {
  it('accumulates tokens and cost', () => {
    const t = new CostTracker('gpt-4o');
    t.add(1000, 500);
    t.add(1000, 500);
    expect(t.totalTokens).toBe(3000);
    expect(t.costUsd).toBeGreaterThan(0);
  });

  it('reports over-budget once the ceiling is crossed', () => {
    const t = new CostTracker('gpt-4o', 0.01);
    expect(t.isOverBudget()).toBe(false);
    t.add(1_000_000, 1_000_000); // ~$12.5
    expect(t.isOverBudget()).toBe(true);
  });

  it('never reports over-budget when no budget is set', () => {
    const t = new CostTracker('gpt-4o');
    t.add(10_000_000, 10_000_000);
    expect(t.isOverBudget()).toBe(false);
  });
});
