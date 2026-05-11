/**
 * Planning system that creates structured plans before task execution.
 * Uses keyword/pattern matching instead of LLM calls for speed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Plan {
  goal: string;
  steps: string[];
  tools_needed: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
}

export interface PlanResult {
  completed_steps: string[];
  failed_steps: string[];
  result: string;
}

// ---------------------------------------------------------------------------
// Keyword patterns mapped to tool groups
// ---------------------------------------------------------------------------

const CREATION_KEYWORDS = ['create', 'build', 'write', 'generate', 'make', 'scaffold', 'new', 'add'];
const SEARCH_KEYWORDS = ['search', 'find', 'look up', 'locate', 'query', 'lookup', 'discover'];
const READ_KEYWORDS = ['read', 'show', 'display', 'view', 'get', 'open', 'list', 'check', 'inspect'];
const CALC_KEYWORDS = ['calculate', 'math', 'compute', 'evaluate', 'solve', 'sum', 'count'];
const CONVERT_KEYWORDS = ['convert', 'transform', 'translate', 'format', 'change'];

const CREATION_TOOLS = ['write_file', 'generate_file_structure', 'generate_image'];
const SEARCH_TOOLS = ['web_search', 'scholar_search'];
const READ_TOOLS = ['read_file', 'list_files'];
const CALC_TOOLS = ['math_eval'];
const CONVERT_TOOLS = ['file_format_converter'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesAny(message: string, keywords: string[]): boolean {
  const lower = message.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function countKeywordGroups(message: string): number {
  let count = 0;
  if (matchesAny(message, CREATION_KEYWORDS)) count++;
  if (matchesAny(message, SEARCH_KEYWORDS)) count++;
  if (matchesAny(message, READ_KEYWORDS)) count++;
  if (matchesAny(message, CALC_KEYWORDS)) count++;
  if (matchesAny(message, CONVERT_KEYWORDS)) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a plan by analyzing the user message with keyword/pattern matching.
 * Does NOT call an LLM — uses fast heuristic matching.
 */
export function createPlan(userMessage: string, availableTools: string[]): Plan {
  const goal = userMessage.trim();
  const toolsNeeded = new Set<string>();
  const steps: string[] = [];
  const messageLower = userMessage.toLowerCase();

  // Detect which keyword groups match
  const needsCreation = matchesAny(messageLower, CREATION_KEYWORDS);
  const needsSearch = matchesAny(messageLower, SEARCH_KEYWORDS);
  const needsRead = matchesAny(messageLower, READ_KEYWORDS);
  const needsCalc = matchesAny(messageLower, CALC_KEYWORDS);
  const needsConvert = matchesAny(messageLower, CONVERT_KEYWORDS);

  // Determine complexity from the number of keyword groups triggered
  const groupCount = countKeywordGroups(messageLower);

  // Build plan steps and collect tools
  if (needsCreation) {
    steps.push('Plan and design the structure of the output');
    steps.push('Create/write the required files or content');

    for (const tool of CREATION_TOOLS) {
      if (availableTools.includes(tool)) {
        toolsNeeded.add(tool);
      }
    }
  }

  if (needsSearch) {
    steps.push('Search for relevant information');
    for (const tool of SEARCH_TOOLS) {
      if (availableTools.includes(tool)) {
        toolsNeeded.add(tool);
      }
    }
  }

  if (needsRead) {
    steps.push('Read and review existing files or data');
    for (const tool of READ_TOOLS) {
      if (availableTools.includes(tool)) {
        toolsNeeded.add(tool);
      }
    }
  }

  if (needsCalc) {
    steps.push('Perform calculations or mathematical operations');
    for (const tool of CALC_TOOLS) {
      if (availableTools.includes(tool)) {
        toolsNeeded.add(tool);
      }
    }
  }

  if (needsConvert) {
    steps.push('Convert or transform the data to the target format');
    for (const tool of CONVERT_TOOLS) {
      if (availableTools.includes(tool)) {
        toolsNeeded.add(tool);
      }
    }
  }

  // If nothing matched, create a generic plan
  if (steps.length === 0) {
    steps.push('Analyze the request');
    steps.push('Identify the best tools to use');
    steps.push('Execute the task');
    steps.push('Verify the result');
  }

  // Add a final verification step
  if (steps.length > 0 && steps[steps.length - 1] !== 'Verify the result') {
    steps.push('Verify the result and present it to the user');
  }

  // Determine complexity
  let complexity: Plan['estimated_complexity'] = 'low';
  if (groupCount >= 3 || toolsNeeded.size >= 5 || messageLower.includes('multiple') || messageLower.includes('several')) {
    complexity = 'high';
  } else if (groupCount >= 2 || toolsNeeded.size >= 3 || messageLower.includes('complex') || messageLower.includes('detailed')) {
    complexity = 'medium';
  }

  return {
    goal,
    steps,
    tools_needed: Array.from(toolsNeeded),
    estimated_complexity: complexity,
  };
}

/**
 * Creates a result summary from completed/failed steps.
 */
export function createResultSummary(
  completedSteps: string[],
  failedSteps: string[],
  result: string,
): PlanResult {
  return {
    completed_steps: completedSteps,
    failed_steps: failedSteps,
    result,
  };
}
