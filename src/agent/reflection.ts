/**
 * Self-reflection system that analyzes tool output and decides
 * whether a retry is needed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReflectionResult {
  success: boolean;
  shouldRetry: boolean;
  adjustedInput?: Record<string, unknown>;
  analysis: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNotFoundError(output: string): boolean {
  const lower = output.toLowerCase();
  return (
    lower.includes('not found') ||
    lower.includes('no such file') ||
    lower.includes('enoent') ||
    lower.includes('does not exist') ||
    lower.includes('file not found')
  );
}

function isTimeoutError(output: string): boolean {
  const lower = output.toLowerCase();
  return (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('etimedout') ||
    lower.includes('abort') ||
    lower.includes('deadline exceeded')
  );
}

function isPermissionError(output: string): boolean {
  const lower = output.toLowerCase();
  return (
    lower.includes('permission denied') ||
    lower.includes('eacces') ||
    lower.includes('eperm') ||
    lower.includes('forbidden') ||
    lower.includes('unauthorized')
  );
}

function isRateLimitError(output: string): boolean {
  const lower = output.toLowerCase();
  return (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('429') ||
    lower.includes('throttl')
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reflect on a tool's output to decide if retry is needed.
 *
 * @param toolName  — the tool that was called
 * @param input     — the input that was passed to the tool
 * @param output    — the raw output string from the tool
 * @param retryCount — how many times this tool/input has been retried already
 */
export function reflectOnOutput(
  toolName: string,
  input: Record<string, unknown>,
  output: string,
  retryCount: number = 0,
): ReflectionResult {
  // Hard error: output starts with "Error:"
  if (output.startsWith('Error:')) {
    const errorContent = output.slice('Error:'.length).trim();

    // Not found
    if (isNotFoundError(errorContent)) {
      if (retryCount >= MAX_RETRIES) {
        return {
          success: false,
          shouldRetry: false,
          analysis: `Tool "${toolName}" failed after ${retryCount} retries: ${errorContent}. Giving up.`,
        };
      }
      if (toolName === 'read_file') {
        return {
          success: false,
          shouldRetry: true,
          adjustedInput: { ...input, _suggestedTool: 'list_files' },
          analysis: `File not found. Consider using list_files to discover available files, then retry read_file with a correct path.`,
        };
      }
      return {
        success: false,
        shouldRetry: true,
        analysis: `Resource not found: ${errorContent}. Will retry.`,
      };
    }

    // Timeout
    if (isTimeoutError(errorContent)) {
      if (retryCount >= MAX_RETRIES) {
        return {
          success: false,
          shouldRetry: false,
          analysis: `Tool "${toolName}" timed out after ${retryCount} retries. Giving up.`,
        };
      }
      return {
        success: false,
        shouldRetry: true,
        analysis: `Tool timed out: ${errorContent}. Will retry (attempt ${retryCount + 1}/${MAX_RETRIES}).`,
      };
    }

    // Permission
    if (isPermissionError(errorContent)) {
      return {
        success: false,
        shouldRetry: false,
        analysis: `Permission denied: ${errorContent}. This cannot be resolved by retrying.`,
      };
    }

    // Rate limit
    if (isRateLimitError(errorContent)) {
      if (retryCount >= MAX_RETRIES) {
        return {
          success: false,
          shouldRetry: false,
          analysis: `Tool "${toolName}" rate-limited after ${retryCount} retries. Giving up.`,
        };
      }
      return {
        success: false,
        shouldRetry: true,
        analysis: `Rate limited: ${errorContent}. Will retry after a delay.`,
      };
    }

    // Generic error
    if (retryCount >= MAX_RETRIES) {
      return {
        success: false,
        shouldRetry: false,
        analysis: `Tool "${toolName}" failed after ${retryCount} retries: ${errorContent}. Giving up.`,
      };
    }
    return {
      success: false,
      shouldRetry: true,
      analysis: `Tool error: ${errorContent}. Will retry (attempt ${retryCount + 1}/${MAX_RETRIES}).`,
    };
  }

  // Output does not start with "Error:" — check for embedded error signals
  if (isNotFoundError(output) && toolName === 'read_file') {
    if (retryCount >= MAX_RETRIES) {
      return {
        success: false,
        shouldRetry: false,
        analysis: `File not found in tool "${toolName}" after ${retryCount} retries.`,
      };
    }
    return {
      success: false,
      shouldRetry: true,
      adjustedInput: { ...input, _suggestedTool: 'list_files' },
      analysis: `File not found in read_file output. Consider listing files first to verify the path.`,
    };
  }

  if (isTimeoutError(output)) {
    if (retryCount >= MAX_RETRIES) {
      return {
        success: false,
        shouldRetry: false,
        analysis: `Tool "${toolName}" timed out after ${retryCount} retries.`,
      };
    }
    return {
      success: false,
      shouldRetry: true,
      analysis: `Timeout detected in output. Will retry (attempt ${retryCount + 1}/${MAX_RETRIES}).`,
    };
  }

  // Output contains "not found" but is not read_file — informational, likely success
  if (isNotFoundError(output)) {
    return {
      success: true,
      shouldRetry: false,
      analysis: `Tool "${toolName}" completed, but reported something was not found. This is informational, not an error.`,
    };
  }

  // Successful output
  return {
    success: true,
    shouldRetry: false,
    analysis: `Tool "${toolName}" executed successfully.`,
  };
}
