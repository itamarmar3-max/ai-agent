import { describe, it, expect } from 'vitest';
import { computeMetrics, formatMetrics, type EvalRunResult } from '../evals/metrics';
import { runEvalSuite, type EvalTask, type TaskRunner } from '../evals/harness';
import type { AgentResult } from '@/agent';

const sample: EvalRunResult[] = [
  { id: 'a', passed: true, toolCalls: 4, toolErrors: 0, totalTokens: 1000, costUsd: 0.01, latencyMs: 100 },
  { id: 'b', passed: false, toolCalls: 6, toolErrors: 2, totalTokens: 2000, costUsd: 0.03, latencyMs: 300 },
];

describe('computeMetrics', () => {
  it('aggregates completion, tool success, cost and latency', () => {
    const m = computeMetrics(sample);
    expect(m.taskCount).toBe(2);
    expect(m.completionRate).toBe(0.5);
    expect(m.toolSuccessRate).toBeCloseTo(1 - 2 / 10, 6);
    expect(m.totalCostUsd).toBeCloseTo(0.04, 6);
    expect(m.avgLatencyMs).toBe(200);
  });

  it('handles an empty suite', () => {
    const m = computeMetrics([]);
    expect(m.taskCount).toBe(0);
    expect(m.completionRate).toBe(0);
    expect(m.toolSuccessRate).toBe(1);
  });

  it('formats a readable report', () => {
    expect(formatMetrics(computeMetrics(sample))).toContain('passed');
  });
});

describe('runEvalSuite', () => {
  const makeResult = (over: Partial<AgentResult>): AgentResult => ({
    text: '',
    toolCalls: [],
    images: [],
    performance: {
      totalToolCalls: 0,
      totalTokens: 500,
      sessionDuration: 0,
      averageResponseTime: 0,
      toolUsageCounts: {},
      sessionStartTime: 0,
      estimatedCostUsd: 0.005,
    },
    ...over,
  });

  it('runs tasks and applies their checks', async () => {
    const tasks: EvalTask[] = [
      { id: 'pass', prompt: 'p', check: (r) => ({ passed: r.text === 'ok' }) },
      { id: 'fail', prompt: 'p', check: (r) => ({ passed: r.text === 'ok' }) },
    ];
    const runner: TaskRunner = async (task) => ({
      result: makeResult({ text: task.id === 'pass' ? 'ok' : 'no' }),
      latencyMs: 50,
    });

    const report = await runEvalSuite(tasks, runner);
    expect(report.metrics.passed).toBe(1);
    expect(report.results.find((r) => r.id === 'pass')!.passed).toBe(true);
  });

  it('treats a runner error as a failed task', async () => {
    const tasks: EvalTask[] = [{ id: 'x', prompt: 'p', check: () => ({ passed: true }) }];
    const runner: TaskRunner = async () => ({ result: makeResult({}), latencyMs: 10, error: 'boom' });
    const report = await runEvalSuite(tasks, runner);
    expect(report.results[0].passed).toBe(false);
    expect(report.results[0].error).toBe('boom');
  });

  it('counts tool errors from Error: outputs', async () => {
    const tasks: EvalTask[] = [{ id: 'x', prompt: 'p', check: () => ({ passed: true }) }];
    const runner: TaskRunner = async () => ({
      result: makeResult({
        toolCalls: [
          { name: 'a', input: {}, output: 'fine' },
          { name: 'b', input: {}, output: 'Error: nope' },
        ],
      }),
      latencyMs: 10,
    });
    const report = await runEvalSuite(tasks, runner);
    expect(report.results[0].toolErrors).toBe(1);
  });
});
