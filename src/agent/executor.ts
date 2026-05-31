/**
 * Parallel tool execution engine.
 * Supports concurrency-limited parallel execution and dependency grouping.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolExecution {
  toolName: string;
  input: Record<string, unknown>;
  isParallel: boolean;
  batchId?: string;
}

export interface ToolExecutionResult {
  toolName: string;
  output: string;
  duration: number;
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONCURRENCY = 10;

const SIMPLE_TOOLS = ['math_eval', 'uuid_generate', 'datetime_info', 'get_current_time'];
const FILE_TOOLS = ['read_file', 'write_file', 'list_files', 'delete_file', 'generate_file_structure', 'edit_file', 'code_search'];
const WEB_TOOLS = ['web_search', 'web_scrape', 'url_metadata', 'scholar_search'];
const CODE_TOOLS = ['run_javascript'];
const LONG_TOOLS = ['shell_exec'];

const TIMEOUT_SIMPLE = 10_000;
const TIMEOUT_FILE = 30_000;
const TIMEOUT_WEB = 20_000;
const TIMEOUT_CODE = 15_000;
const TIMEOUT_LONG = 300_000;
const TIMEOUT_DEFAULT = 20_000;

// ---------------------------------------------------------------------------
// Timeout helpers
// ---------------------------------------------------------------------------

function getToolTimeoutMs(toolName: string): number {
  if (LONG_TOOLS.includes(toolName)) return TIMEOUT_LONG;
  if (SIMPLE_TOOLS.includes(toolName)) return TIMEOUT_SIMPLE;
  if (FILE_TOOLS.includes(toolName)) return TIMEOUT_FILE;
  if (WEB_TOOLS.includes(toolName)) return TIMEOUT_WEB;
  if (CODE_TOOLS.includes(toolName)) return TIMEOUT_CODE;
  return TIMEOUT_DEFAULT;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Executes multiple tool calls in parallel with a concurrency limit of 10.
 */
export async function executeToolsInParallel(
  executions: ToolExecution[],
  toolMap: Map<string, any>,
): Promise<ToolExecutionResult[]> {
  // Results are written back by *input index* so the caller can safely match
  // results[i] to executions[i] (and their tool_call_id). A previous version
  // pushed in completion order, which silently attached a tool's output to a
  // sibling tool's tool_call_id when calls finished out of order.
  const results: ToolExecutionResult[] = new Array(executions.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const current = nextIndex++;
      if (current >= executions.length) return;
      // executeSingleTool never rejects — it captures errors into the result.
      results[current] = await executeSingleTool(executions[current], toolMap);
    }
  }

  const workerCount = Math.min(MAX_CONCURRENCY, executions.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}

/**
 * Analyzes tool calls and groups them into parallel batches.
 * Tools that don't depend on each other are grouped together.
 */
export function determineParallelGroups(
  toolCalls: Array<{ name: string; input: any }>,
): Array<Array<{ name: string; input: any }>> {
  if (toolCalls.length === 0) return [];

  // Separate by dependency characteristics
  const parallelCapable: Array<{ name: string; input: any }> = [];
  const writeOps: Map<string, { name: string; input: any }> = new Map();
  const sequentialOps: Array<{ name: string; input: any }> = [];

  for (const tc of toolCalls) {
    const isWriteFile = tc.name === 'write_file' || tc.name === 'generate_file_structure';
    const isRead = tc.name === 'read_file' || tc.name === 'list_files';
    const isParallelSafe = ['read_file', 'list_files', 'web_search', 'scholar_search', 'url_metadata', 'math_eval', 'uuid_generate', 'datetime_info', 'get_current_time'].includes(tc.name);

    if (isWriteFile) {
      // write_file calls can run in parallel only if they target different paths.
      // Conflicting-path writes are moved to sequential so neither is dropped.
      const targetPath = tc.input?.file_path ?? tc.input?.path ?? '';
      if (!targetPath) {
        sequentialOps.push(tc);
      } else if (!writeOps.has(targetPath)) {
        writeOps.set(targetPath, tc);
      } else {
        // Same path — serialize to avoid lost writes
        sequentialOps.push(tc);
      }
    } else if (isParallelSafe) {
      parallelCapable.push(tc);
    } else {
      sequentialOps.push(tc);
    }
  }

  const groups: Array<Array<{ name: string; input: any }>> = [];

  // Group 1: All parallel-safe reads/searches
  if (parallelCapable.length > 0) {
    groups.push(parallelCapable);
  }

  // Group 2: Write operations to different paths
  const writeOpsArray = Array.from(writeOps.values());
  if (writeOpsArray.length > 0) {
    groups.push(writeOpsArray);
  }

  // Groups 3+: Sequential operations — each gets its own group
  for (const op of sequentialOps) {
    groups.push([op]);
  }

  return groups.length > 0 ? groups : [toolCalls];
}

/**
 * Wraps a single tool invocation with a timeout.
 */
export async function executeToolWithTimeout(
  tool: any,
  input: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ output: string; duration: number }> {
  const start = Date.now();

  const toolPromise = tool.invoke(input).then((result: any) => {
    return typeof result === 'string' ? result : JSON.stringify(result);
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const output = await Promise.race([toolPromise, timeoutPromise]);
    return { output, duration: Date.now() - start };
  } catch (err) {
    const duration = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { output: `Error: ${errorMsg}`, duration };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function executeSingleTool(
  execution: ToolExecution,
  toolMap: Map<string, any>,
): Promise<ToolExecutionResult> {
  const tool = toolMap.get(execution.toolName);
  if (!tool) {
    return {
      toolName: execution.toolName,
      output: `Error: Tool "${execution.toolName}" not found in tool map.`,
      duration: 0,
      success: false,
      error: `Tool "${execution.toolName}" not found`,
    };
  }

  const timeoutMs = getToolTimeoutMs(execution.toolName);
  const { output, duration } = await executeToolWithTimeout(tool, execution.input, timeoutMs);

  const success = !output.startsWith('Error:');
  return {
    toolName: execution.toolName,
    output,
    duration,
    success,
    error: success ? undefined : output,
  };
}

/**
 * Returns the timeout in milliseconds for a given tool name.
 */
export function getToolTimeout(toolName: string): number {
  return getToolTimeoutMs(toolName);
}
