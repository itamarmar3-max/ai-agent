/**
 * Eval harness — runs a suite of tasks through a (dependency-injected) task
 * runner and aggregates metrics. The runner is injected so the harness can be
 * unit-tested with a mock and driven against the real agent in evals/run.ts.
 */

import type { AgentResult, AgentMode } from '@/agent';
import { computeMetrics, type EvalMetrics, type EvalRunResult } from './metrics';

export interface EvalTask {
  id: string;
  prompt: string;
  mode?: AgentMode;
  /** Verdict on a completed agent run. */
  check: (result: AgentResult) => { passed: boolean; notes?: string };
}

export interface TaskRunner {
  (task: EvalTask): Promise<{ result: AgentResult; latencyMs: number; error?: string }>;
}

export interface SuiteReport {
  results: EvalRunResult[];
  metrics: EvalMetrics;
}

/** Run all tasks and aggregate. Never throws — runner errors become failures. */
export async function runEvalSuite(tasks: EvalTask[], runTask: TaskRunner): Promise<SuiteReport> {
  const results: EvalRunResult[] = [];

  for (const task of tasks) {
    try {
      const { result, latencyMs, error } = await runTask(task);
      const toolErrors = result.toolCalls.filter((c) => String(c.output).startsWith('Error:')).length;
      const verdict = error ? { passed: false, notes: error } : task.check(result);
      results.push({
        id: task.id,
        passed: verdict.passed,
        notes: verdict.notes,
        toolCalls: result.toolCalls.length,
        toolErrors,
        totalTokens: result.performance?.totalTokens ?? 0,
        costUsd: result.performance?.estimatedCostUsd ?? 0,
        latencyMs,
        error,
      });
    } catch (err) {
      results.push({
        id: task.id,
        passed: false,
        notes: 'runner threw',
        toolCalls: 0,
        toolErrors: 0,
        totalTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { results, metrics: computeMetrics(results) };
}
