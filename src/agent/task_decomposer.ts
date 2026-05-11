/**
 * Task decomposition system that breaks complex user requests
 * into ordered subtasks using heuristic pattern matching.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Subtask {
  id: number;
  task: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTool?: string;
}

export interface TaskDecomposition {
  mainTask: string;
  complexity: 'low' | 'medium' | 'high';
  subtasks: Subtask[];
}

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

interface DecompositionPattern {
  match: (message: string) => boolean;
  subtasks: Array<{ task: string; tool?: string }>;
  complexity: 'low' | 'medium' | 'high';
}

const PATTERNS: DecompositionPattern[] = [
  {
    match: (msg) => /\b(build|create|make)\b.*\b(app|application|website|web app)\b/i.test(msg),
    subtasks: [
      { task: 'Plan the application structure and architecture' },
      { task: 'Create the project file structure', tool: 'generate_file_structure' },
      { task: 'Write the core application logic' },
      { task: 'Create the UI components' },
      { task: 'Add styling and assets' },
      { task: 'Test and verify the application works' },
    ],
    complexity: 'high',
  },
  {
    match: (msg) => /\b(create|start|init|scaffold)\b.*\b(project|repo|workspace)\b/i.test(msg),
    subtasks: [
      { task: 'Determine the project type and tech stack' },
      { task: 'Create the project directory structure', tool: 'generate_file_structure' },
      { task: 'Write the initial configuration files' },
      { task: 'Add starter code and templates' },
    ],
    complexity: 'medium',
  },
  {
    match: (msg) => /\b(research|investigate)\b.*\b(summarize|report|document)\b/i.test(msg),
    subtasks: [
      { task: 'Search for relevant information', tool: 'web_search' },
      { task: 'Collect additional details from sources', tool: 'web_scrape' },
      { task: 'Analyze and organize the findings' },
      { task: 'Write a summary report' },
    ],
    complexity: 'medium',
  },
  {
    match: (msg) => /\b(convert|transform|change)\b/i.test(msg),
    subtasks: [
      { task: 'Read the source file or data', tool: 'read_file' },
      { task: 'Convert to the target format', tool: 'file_format_converter' },
      { task: 'Write the converted output', tool: 'write_file' },
      { task: 'Verify the conversion was successful' },
    ],
    complexity: 'low',
  },
  {
    match: (msg) => /\b(analyze|review|inspect)\b/i.test(msg),
    subtasks: [
      { task: 'Read the files or data to analyze', tool: 'read_file' },
      { task: 'Perform the analysis' },
      { task: 'Present findings and recommendations' },
    ],
    complexity: 'medium',
  },
  {
    match: (msg) => /\b(fix|debug|troubleshoot|repair)\b/i.test(msg),
    subtasks: [
      { task: 'Identify the problem area', tool: 'read_file' },
      { task: 'Analyze the root cause' },
      { task: 'Apply the fix' },
      { task: 'Verify the fix works' },
    ],
    complexity: 'medium',
  },
  {
    match: (msg) => /\b(search|find|look)\b.*\b(and|then|also)\b/i.test(msg),
    subtasks: [
      { task: 'Search for information', tool: 'web_search' },
      { task: 'Perform additional lookup if needed', tool: 'web_search' },
      { task: 'Compile and present results' },
    ],
    complexity: 'low',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countActionWords(message: string): number {
  const actionWords = [
    'create', 'build', 'write', 'read', 'search', 'find', 'convert',
    'transform', 'analyze', 'fix', 'update', 'delete', 'generate',
    'download', 'upload', 'calculate', 'summarize', 'translate',
    'format', 'refactor', 'test', 'deploy', 'install', 'configure',
  ];
  const lower = message.toLowerCase();
  return actionWords.filter((w) => lower.includes(w)).length;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decomposes a complex user message into ordered subtasks using pattern matching.
 */
export function decomposeTask(userMessage: string): TaskDecomposition {
  // Try to match a known pattern
  for (const pattern of PATTERNS) {
    if (pattern.match(userMessage)) {
      const subtasks: Subtask[] = pattern.subtasks.map((s, i) => ({
        id: i + 1,
        task: s.task,
        status: 'pending' as const,
        assignedTool: s.tool,
      }));

      return {
        mainTask: userMessage.trim(),
        complexity: pattern.complexity,
        subtasks,
      };
    }
  }

  // Fallback: count action words to estimate complexity
  const actionCount = countActionWords(userMessage);

  if (actionCount <= 1) {
    // Simple task — single subtask
    return {
      mainTask: userMessage.trim(),
      complexity: 'low',
      subtasks: [
        { id: 1, task: userMessage.trim(), status: 'pending' },
      ],
    };
  }

  // Multi-action task — create one subtask per action word
  const subtasks: Subtask[] = [];
  const lower = userMessage.toLowerCase();
  const actionWords = [
    'create', 'build', 'write', 'read', 'search', 'find', 'convert',
    'transform', 'analyze', 'fix', 'update', 'delete', 'generate',
    'download', 'upload', 'calculate', 'summarize', 'translate',
    'format', 'refactor', 'test', 'deploy', 'install', 'configure',
  ];

  let id = 1;
  for (const word of actionWords) {
    if (lower.includes(word)) {
      subtasks.push({
        id: id++,
        task: `Perform action: ${word}`,
        status: 'pending',
      });
    }
  }

  // Always end with a verification step for multi-action tasks
  if (subtasks.length > 0) {
    subtasks.push({
      id: id++,
      task: 'Verify all steps completed successfully',
      status: 'pending',
    });
  }

  const complexity: TaskDecomposition['complexity'] =
    subtasks.length >= 5 ? 'high' : subtasks.length >= 3 ? 'medium' : 'low';

  return {
    mainTask: userMessage.trim(),
    complexity,
    subtasks,
  };
}

/**
 * Updates the status of a specific subtask and returns a new decomposition.
 */
export function updateSubtaskStatus(
  decomposition: TaskDecomposition,
  subtaskId: number,
  status: Subtask['status'],
): TaskDecomposition {
  return {
    ...decomposition,
    subtasks: decomposition.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, status } : st,
    ),
  };
}

/**
 * Calculates progress of a task decomposition.
 */
export function getProgress(decomposition: TaskDecomposition): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = decomposition.subtasks.length;
  const completed = decomposition.subtasks.filter(
    (st) => st.status === 'completed',
  ).length;
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Returns the next pending subtask, or null if none remain.
 */
export function getNextPendingSubtask(
  decomposition: TaskDecomposition,
): Subtask | null {
  return decomposition.subtasks.find((st) => st.status === 'pending') ?? null;
}

/**
 * Formats a task decomposition for injection into LLM context.
 */
export function formatDecompositionForLLM(
  decomposition: TaskDecomposition,
): string {
  const lines: string[] = [];
  lines.push(`=== Task Plan: ${decomposition.mainTask} ===`);
  lines.push(`Complexity: ${decomposition.complexity}`);
  lines.push(`Progress: ${getProgress(decomposition).percent}%`);
  lines.push('');

  for (const st of decomposition.subtasks) {
    const statusIcon =
      st.status === 'completed' ? '[x]' :
      st.status === 'in_progress' ? '[>]' :
      st.status === 'failed' ? '[!]' :
      '[ ]';
    const toolInfo = st.assignedTool ? ` (tool: ${st.assignedTool})` : '';
    lines.push(`  ${statusIcon} Step ${st.id}: ${st.task}${toolInfo}`);
  }

  return lines.join('\n');
}
