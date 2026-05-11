/**
 * Planner Agent — Creates structured execution plans from user requests.
 * Focused on planning only, not execution.
 */

import type { Plan, Subtask } from '@/types';

const PLANNER_SYSTEM_PROMPT = `You are a planning specialist agent. Your ONLY job is to create structured execution plans.

Given a user request, produce a clear, actionable plan:
1. Break the request into concrete steps
2. Identify which tools are needed for each step
3. Estimate complexity
4. Flag dependencies between steps

Output your plan as structured JSON. Be specific about what each step accomplishes.`;

/**
 * Create a structured plan from a user message.
 */
export function createExecutionPlan(
  userMessage: string,
  availableTools: string[],
): Plan {
  const steps: string[] = [];
  const toolsNeeded: string[] = [];

  // Heuristic-based planning (keyword matching)
  const msg = userMessage.toLowerCase();

  // Research steps
  if (msg.includes('search') || msg.includes('find') || msg.includes('research') || msg.includes('look up')) {
    steps.push('Search for relevant information using web search');
    toolsNeeded.push('web_search');
    if (msg.includes('scholar') || msg.includes('paper') || msg.includes('academic')) {
      steps.push('Search academic sources for scholarly references');
      toolsNeeded.push('scholar_search');
    }
    if (msg.includes('scrape') || msg.includes('extract') || msg.includes('content')) {
      steps.push('Scrape detailed content from relevant web pages');
      toolsNeeded.push('web_scrape');
    }
  }

  // File creation steps
  if (msg.includes('create') || msg.includes('write') || msg.includes('build') || msg.includes('generate')) {
    steps.push('Plan project structure and file organization');
    steps.push('Generate required files with complete implementation');
    toolsNeeded.push('write_file');
    toolsNeeded.push('generate_file_structure');
  }

  // Code analysis steps
  if (msg.includes('debug') || msg.includes('fix') || msg.includes('error') || msg.includes('bug')) {
    steps.push('Read and analyze the relevant source files');
    steps.push('Identify the root cause of the issue');
    toolsNeeded.push('read_file');
    toolsNeeded.push('list_files');
  }

  // Code review steps
  if (msg.includes('review') || msg.includes('improve') || msg.includes('optimize') || msg.includes('refactor')) {
    steps.push('Review all relevant code files');
    steps.push('Identify issues and improvement opportunities');
    toolsNeeded.push('read_file');
    toolsNeeded.push('format_code');
  }

  // Data analysis steps
  if (msg.includes('analyz') || msg.includes('data') || msg.includes('chart') || msg.includes('statistic')) {
    steps.push('Load and examine the data');
    steps.push('Perform analysis and extract insights');
    toolsNeeded.push('read_file');
    toolsNeeded.push('run_javascript');
    toolsNeeded.push('math_eval');
  }

  // Documentation steps
  if (msg.includes('document') || msg.includes('readme') || msg.includes('guide') || msg.includes('tutorial')) {
    steps.push('Review existing project structure');
    steps.push('Write comprehensive documentation');
    toolsNeeded.push('read_file');
    toolsNeeded.push('write_file');
  }

  // Image generation
  if (msg.includes('image') || msg.includes('picture') || msg.includes('draw') || msg.includes('generate image')) {
    steps.push('Generate the requested image');
    toolsNeeded.push('generate_image');
  }

  // ZIP packaging
  if (msg.includes('zip') || msg.includes('download') || msg.includes('package') || msg.includes('export')) {
    steps.push('Package all files into a downloadable ZIP');
    toolsNeeded.push('create_zip');
  }

  // Default steps if nothing matched
  if (steps.length === 0) {
    steps.push('Analyze the user request');
    steps.push('Execute the appropriate actions');
    steps.push('Verify results and provide comprehensive response');
    toolsNeeded.push('web_search');
  }

  // Add verification step
  steps.push('Verify all outputs and present results to user');

  // Estimate complexity
  let estimatedComplexity: 'low' | 'medium' | 'high' = 'low';
  if (steps.length > 5 || msg.includes('complex') || msg.includes('full')) {
    estimatedComplexity = 'high';
  } else if (steps.length > 3) {
    estimatedComplexity = 'medium';
  }

  // Filter tools to only available ones
  const availableSet = new Set(availableTools);
  const filteredTools = toolsNeeded.filter(t => availableSet.has(t));

  return {
    goal: userMessage.slice(0, 200),
    steps,
    tools_needed: filteredTools.length > 0 ? [...new Set(filteredTools)] : availableTools.slice(0, 5),
    estimated_complexity: estimatedComplexity,
  };
}

export { PLANNER_SYSTEM_PROMPT };
