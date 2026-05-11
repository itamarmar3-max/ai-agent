/**
 * Multi-Agent Orchestrator — Coordinates Planner, Executor, and Reviewer agents.
 * Provides callbacks for the UI to display agent activity.
 */

import { createExecutionPlan } from './planner_agent';
import { ExecutionContext } from './executor_agent';
import type { Plan, AgentActivity, Subtask } from '@/types';
import { reviewStep, reviewOverall } from './reviewer_agent';

export interface OrchestratorCallbacks {
  onAgentActivity?: (activity: AgentActivity) => void;
  onPlanCreated?: (plan: Plan) => void;
  onStepUpdate?: (subtask: Subtask) => void;
  onReview?: (stepIndex: number, approved: boolean, score: number) => void;
  onError?: (error: string) => void;
}

/**
 * Activity emitter — sends structured activity events to the UI.
 */
function emitActivity(
  role: AgentActivity['role'],
  status: AgentActivity['status'],
  description: string,
  callbacks: OrchestratorCallbacks,
): void {
  callbacks.onAgentActivity?.({
    role,
    status,
    description,
    timestamp: Date.now(),
  });
}

/**
 * Create an orchestrated execution plan with all three agents.
 * This is a synchronous coordination function — actual tool execution
 * is handled by the main agent loop.
 */
export function orchestratePlan(
  userMessage: string,
  availableTools: string[],
  callbacks: OrchestratorCallbacks = {},
): {
  plan: Plan;
  subtasks: Subtask[];
  context: ExecutionContext;
} {
  // Phase 1: Planning
  emitActivity('planner', 'active', 'Creating execution plan...', callbacks);
  
  const plan = createExecutionPlan(userMessage, availableTools);
  callbacks.onPlanCreated?.(plan);

  // Convert plan steps to subtasks
  const subtasks: Subtask[] = plan.steps.map((step, index) => ({
    id: index + 1,
    task: step,
    status: 'pending' as const,
  }));

  emitActivity('planner', 'completed', `Plan created with ${plan.steps.length} steps`, callbacks);

  // Phase 2: Initialize execution context
  const context = new ExecutionContext();
  context.initFromPlan(plan.steps);

  // Phase 3: Signal ready for execution
  emitActivity('executor', 'active', 'Ready to execute plan steps', callbacks);

  // Send initial subtask updates
  for (const subtask of subtasks) {
    callbacks.onStepUpdate?.(subtask);
  }

  return { plan, subtasks, context };
}

/**
 * Process a completed step — run reviewer and determine next action.
 */
export function processStepCompletion(
  context: ExecutionContext,
  stepIndex: number,
  toolUsed: string,
  output: string,
  duration: number,
  callbacks: OrchestratorCallbacks = {},
): {
  approved: boolean;
  reviewScore: number;
  issues: string[];
  nextStep: number | null;
  executionComplete: boolean;
  summary: string;
} {
  // Complete the step in context
  context.completeStep(stepIndex, toolUsed, output, duration);

  // Phase: Review
  emitActivity('reviewer', 'active', `Reviewing step ${stepIndex + 1}...`, callbacks);

  const stepResult = context.getAllResults()[stepIndex];
  const review = reviewStep(stepResult);
  
  callbacks.onReview?.(stepIndex, review.approved, review.score);

  if (review.approved) {
    emitActivity('reviewer', 'completed', 
      `Step ${stepIndex + 1} approved (score: ${review.score}/10)`, callbacks);
  } else {
    emitActivity('reviewer', 'failed', 
      `Step ${stepIndex + 1} needs revision: ${review.issues.join('; ')}`, callbacks);
  }

  // Determine next step
  const nextStep = review.approved ? context.getNextPendingStep() : stepIndex;
  const summary = context.getSummary();
  const executionComplete = nextStep === null && review.approved;

  if (nextStep !== null) {
    emitActivity('executor', 'active', 
      executionComplete ? 'All steps completed!' : `Moving to step ${nextStep + 1}`, callbacks);
  }

  if (executionComplete) {
    emitActivity('reviewer', 'completed', 
      `Execution complete! ${summary.completed}/${summary.total} steps passed`, callbacks);
    
    const overallReview = reviewOverall(context.getAllResults());
    emitActivity('planner', 'completed', overallReview.summary, callbacks);
  }

  return {
    approved: review.approved,
    reviewScore: review.score,
    issues: review.issues,
    nextStep,
    executionComplete,
    summary: `${summary.completed}/${summary.total} steps completed (${summary.progress}%)`,
  };
}

/**
 * Get the current orchestrator state for UI display.
 */
export function getOrchestratorState(context: ExecutionContext | null): {
  currentStep: number;
  progress: number;
  stepResults: Array<{
    stepIndex: number;
    step: string;
    status: string;
  }>;
} {
  if (!context) {
    return { currentStep: 0, progress: 0, stepResults: [] };
  }

  const summary = context.getSummary();
  return {
    currentStep: context.getCurrentStep(),
    progress: summary.progress,
    stepResults: context.getAllResults().map(r => ({
      stepIndex: r.stepIndex,
      step: r.step,
      status: r.status,
    })),
  };
}
