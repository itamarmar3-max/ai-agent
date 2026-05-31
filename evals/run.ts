/**
 * Eval runner — drives the real agent over EVAL_TASKS and prints a scoreboard.
 *
 * Run with:  bun evals/run.ts        (or: npm run eval)
 *
 * Requires model credentials in the environment (so the harness can call a
 * real model). If none are present it prints guidance and exits cleanly — the
 * suite is opt-in and never part of the normal build/test.
 *
 *   EVAL_API_KEY / EVAL_BASE_URL / EVAL_MODEL   (preferred)
 *   or OPENAI_API_KEY (+ optional OPENAI_BASE_URL / EVAL_MODEL)
 */

import { runAgent } from '@/agent';
import { runEvalSuite, type EvalTask, type TaskRunner } from './harness';
import { EVAL_TASKS } from './tasks';
import { formatMetrics } from './metrics';

function readCreds(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey = process.env.EVAL_API_KEY || process.env.OPENAI_API_KEY || '';
  if (!apiKey) return null;
  const baseUrl = process.env.EVAL_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.EVAL_MODEL || 'gpt-4o-mini';
  return { apiKey, baseUrl, model };
}

async function main(): Promise<void> {
  const creds = readCreds();
  if (!creds) {
    console.log(
      'No eval credentials found. Set EVAL_API_KEY (and optionally EVAL_BASE_URL / EVAL_MODEL) ' +
        'or OPENAI_API_KEY to run the suite.',
    );
    return;
  }

  const runTask: TaskRunner = async (task: EvalTask) => {
    const start = Date.now();
    try {
      const result = await runAgent([{ role: 'user', content: task.prompt }], {
        apiKey: creds.apiKey,
        baseUrl: creds.baseUrl,
        model: creds.model,
        mode: task.mode,
        costBudgetUsd: 0.5, // safety net per task
      });
      return { result, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        result: { text: '', toolCalls: [], images: [] },
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };

  console.log(`Running ${EVAL_TASKS.length} eval tasks with model ${creds.model}…\n`);
  const report = await runEvalSuite(EVAL_TASKS, runTask);

  for (const r of report.results) {
    console.log(`  ${r.passed ? 'PASS' : 'FAIL'}  ${r.id}${r.notes ? `  — ${r.notes}` : ''}`);
  }
  console.log('\n' + formatMetrics(report.metrics));
}

main().catch((err) => {
  console.error('Eval run failed:', err);
  process.exitCode = 1;
});
