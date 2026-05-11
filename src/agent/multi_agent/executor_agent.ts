/**
 * Executor Agent — Executes planned tasks using tools.
 * Focused on execution only, not planning or review.
 */

import type { Subtask } from '@/types';

const EXECUTOR_SYSTEM_PROMPT = `You are an execution specialist agent. Your ONLY job is to execute the plan step by step using available tools.

Rules:
1. Execute each step in order
2. Use the most appropriate tool for each step
3. Report results after each step
4. If a step fails, report the error and suggest a fix
5. Never skip steps
6. Always verify results before proceeding to next step

Be efficient and precise. Minimize unnecessary tool calls.`;

/**
 * Represents an execution result for a single step.
 */
export interface StepResult {
  stepIndex: number;
  step: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  toolUsed: string | null;
  output: string;
  duration: number;
  error?: string;
}

/**
 * Track execution progress through the plan.
 */
export class ExecutionContext {
  private results: Map<number, StepResult> = new Map();
  private currentStep: number = 0;

  /**
   * Initialize execution context from plan steps.
   */
  initFromPlan(steps: string[]): void {
    this.results.clear();
    this.currentStep = 0;
    for (let i = 0; i < steps.length; i++) {
      this.results.set(i, {
        stepIndex: i,
        step: steps[i],
        status: 'pending',
        toolUsed: null,
        output: '',
        duration: 0,
      });
    }
  }

  /**
   * Start executing a step.
   */
  startStep(index: number): void {
    const result = this.results.get(index);
    if (result) {
      result.status = 'executing';
      this.currentStep = index;
    }
  }

  /**
   * Complete a step with results.
   */
  completeStep(index: number, toolUsed: string, output: string, duration: number): void {
    const result = this.results.get(index);
    if (result) {
      result.status = 'completed';
      result.toolUsed = toolUsed;
      result.output = output;
      result.duration = duration;
    }
  }

  /**
   * Mark a step as failed.
   */
  failStep(index: number, error: string): void {
    const result = this.results.get(index);
    if (result) {
      result.status = 'failed';
      result.error = error;
    }
  }

  /**
   * Get the current step index.
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Get the next pending step.
   */
  getNextPendingStep(): number | null {
    for (const [index, result] of this.results) {
      if (result.status === 'pending') return index;
    }
    return null;
  }

  /**
   * Get all step results.
   */
  getAllResults(): StepResult[] {
    return [...this.results.values()].sort((a, b) => a.stepIndex - b.stepIndex);
  }

  /**
   * Get a summary of execution progress.
   */
  getSummary(): {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    executing: number;
    progress: number; // 0-100
  } {
    let completed = 0, failed = 0, pending = 0, executing = 0;
    for (const result of this.results.values()) {
      switch (result.status) {
        case 'completed': completed++; break;
        case 'failed': failed++; break;
        case 'pending': pending++; break;
        case 'executing': executing++; break;
      }
    }
    const total = this.results.size;
    return {
      total,
      completed,
      failed,
      pending,
      executing,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}

export { EXECUTOR_SYSTEM_PROMPT };
