/**
 * Reviewer Agent — Reviews executor output for quality, completeness, and errors.
 * Focused on critique only, not execution.
 */

import type { StepResult } from './executor_agent';

const REVIEWER_SYSTEM_PROMPT = `You are a quality review specialist agent. Your ONLY job is to review the executor's output.

For each step, check:
1. **Completeness** — Was the step fully completed?
2. **Correctness** — Is the output correct and accurate?
3. **Quality** — Does the output meet quality standards?
4. **Relevance** — Does the output address the original step goal?

Output one of:
- APPROVE: Step passes all checks
- REJECT: Step has issues that need fixing (explain what's wrong)

Be fair but thorough. Minor issues can be approved. Critical errors must be rejected.`;

export interface ReviewResult {
  stepIndex: number;
  approved: boolean;
  score: number;  // 1-10
  issues: string[];
  suggestions: string[];
}

/**
 * Review a step's execution result.
 */
export function reviewStep(stepResult: StepResult): ReviewResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 10;

  // Check if step failed
  if (stepResult.status === 'failed') {
    return {
      stepIndex: stepResult.stepIndex,
      approved: false,
      score: 0,
      issues: [`Step failed with error: ${stepResult.error ?? 'Unknown error'}`],
      suggestions: ['Investigate the error and retry with adjusted approach'],
    };
  }

  // Check if output is empty
  if (!stepResult.output || stepResult.output.trim().length === 0) {
    issues.push('Step produced no output');
    score -= 5;
  }

  // Check if tool was used
  if (!stepResult.toolUsed) {
    issues.push('No tool was used for this step');
    score -= 2;
  }

  // Check output quality
  if (stepResult.output) {
    const output = stepResult.output;
    
    // Check for error indicators in output
    if (output.toLowerCase().includes('error:') || output.toLowerCase().includes('failed')) {
      issues.push('Output contains error indicators');
      score -= 3;
    }

    // Check output length (very short outputs may be incomplete)
    if (output.length < 20 && stepResult.status === 'completed') {
      issues.push('Output seems too short — may be incomplete');
      score -= 2;
    }

    // Bonus for substantial output
    if (output.length > 500) {
      score = Math.min(10, score + 1);
    }
  }

  // Check execution time (flag very fast executions as suspicious)
  if (stepResult.duration > 0 && stepResult.duration < 100) {
    suggestions.push('Step completed very quickly — verify results');
  }

  // Generate suggestions based on step content
  const step = stepResult.step.toLowerCase();
  if (step.includes('search') && !stepResult.output?.includes('http')) {
    suggestions.push('Consider searching additional sources for comprehensive results');
  }
  if (step.includes('create') || step.includes('write') || step.includes('generate')) {
    if (!stepResult.output?.includes('file') && !stepResult.output?.includes('created')) {
      suggestions.push('Verify that all required files were created');
    }
  }

  score = Math.max(0, Math.min(10, score));

  return {
    stepIndex: stepResult.stepIndex,
    approved: score >= 5,  // Auto-approve if score is 5 or above
    score,
    issues,
    suggestions,
  };
}

/**
 * Review the overall execution and produce a final assessment.
 */
export function reviewOverall(stepResults: StepResult[]): {
  overallApproved: boolean;
  overallScore: number;
  summary: string;
  failedSteps: number[];
  qualityNotes: string[];
} {
  const reviews = stepResults.map(reviewStep);
  const avgScore = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
  const failedSteps = reviews.filter(r => !r.approved).map(r => r.stepIndex);

  const qualityNotes: string[] = [];
  
  const completedSteps = reviews.filter(r => r.approved).length;
  if (completedSteps === reviews.length) {
    qualityNotes.push('All steps completed successfully');
  } else {
    qualityNotes.push(`${failedSteps.length} step(s) need revision: ${failedSteps.join(', ')}`);
  }

  if (avgScore >= 8) {
    qualityNotes.push('Overall quality is excellent');
  } else if (avgScore >= 6) {
    qualityNotes.push('Overall quality is good with minor issues');
  } else {
    qualityNotes.push('Overall quality needs improvement');
  }

  return {
    overallApproved: avgScore >= 5 && failedSteps.length === 0,
    overallScore: Math.round(avgScore * 10) / 10,
    summary: `${completedSteps}/${reviews.length} steps passed review (avg score: ${avgScore.toFixed(1)}/10)`,
    failedSteps,
    qualityNotes,
  };
}

export { REVIEWER_SYSTEM_PROMPT };
