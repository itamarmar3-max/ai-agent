/**
 * Eval metrics — pure aggregation over per-task results.
 *
 * Gives the agent the effectiveness scoreboard it lacked: task completion rate,
 * tool success rate, and token/cost/latency averages. Inspired by
 * ReliabilityBench's emphasis on measuring real outcomes rather than text
 * similarity. Kept pure so it can be unit-tested without any network or model.
 */

export interface EvalRunResult {
  id: string;
  passed: boolean;
  notes?: string;
  toolCalls: number;
  toolErrors: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  error?: string;
}

export interface EvalMetrics {
  taskCount: number;
  passed: number;
  completionRate: number; // fraction of tasks whose checks passed
  toolSuccessRate: number; // 1 - (errors / tool calls)
  totalToolCalls: number;
  avgTokens: number;
  avgCostUsd: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)];
}

export function computeMetrics(results: EvalRunResult[]): EvalMetrics {
  const taskCount = results.length;
  if (taskCount === 0) {
    return {
      taskCount: 0,
      passed: 0,
      completionRate: 0,
      toolSuccessRate: 1,
      totalToolCalls: 0,
      avgTokens: 0,
      avgCostUsd: 0,
      totalCostUsd: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
    };
  }

  const passed = results.filter((r) => r.passed).length;
  const totalToolCalls = results.reduce((s, r) => s + r.toolCalls, 0);
  const totalToolErrors = results.reduce((s, r) => s + r.toolErrors, 0);
  const totalTokens = results.reduce((s, r) => s + r.totalTokens, 0);
  const totalCostUsd = results.reduce((s, r) => s + r.costUsd, 0);
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);

  return {
    taskCount,
    passed,
    completionRate: passed / taskCount,
    toolSuccessRate: totalToolCalls === 0 ? 1 : 1 - totalToolErrors / totalToolCalls,
    totalToolCalls,
    avgTokens: Math.round(totalTokens / taskCount),
    avgCostUsd: totalCostUsd / taskCount,
    totalCostUsd,
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / taskCount),
    p95LatencyMs: percentile(latencies, 95),
  };
}

/** Render metrics as a compact human-readable report. */
export function formatMetrics(metrics: EvalMetrics): string {
  return [
    `Tasks:            ${metrics.passed}/${metrics.taskCount} passed (${(metrics.completionRate * 100).toFixed(0)}%)`,
    `Tool success:     ${(metrics.toolSuccessRate * 100).toFixed(0)}% over ${metrics.totalToolCalls} calls`,
    `Avg tokens/task:  ${metrics.avgTokens}`,
    `Cost:             $${metrics.totalCostUsd.toFixed(4)} total, $${metrics.avgCostUsd.toFixed(4)}/task`,
    `Latency:          ${metrics.avgLatencyMs}ms avg, ${metrics.p95LatencyMs}ms p95`,
  ].join('\n');
}
