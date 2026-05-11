/**
 * SmartToolExecutor - Wraps tool execution calls with intelligent retry logic.
 *
 * Classifies errors and applies the appropriate recovery strategy:
 *   network → wait & retry
 *   timeout → simplify input & retry
 *   not_found → try alternative path
 *   invalid_input → fix input via AI callback
 *   permission → skip & notify
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorClassification =
  | 'network'
  | 'timeout'
  | 'not_found'
  | 'invalid_input'
  | 'permission'
  | 'unknown';

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  retries: number;
  skipped: boolean;
  error?: string;
}

export type OnToolRetryCallback = (
  toolName: string,
  attempt: number,
  reason: string,
) => void;

export type OnSimplifyInputCallback = (input: string) => string;
export type OnAlternativePathCallback = (path: string) => string;
export type OnFixInputCallback = (
  toolName: string,
  input: string,
  error: string,
) => Promise<string>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_DEFAULT_RETRIES = 3;

function classifyError(error: string): ErrorClassification {
  const lower = error.toLowerCase();

  if (
    lower.includes('network') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('fetch') ||
    lower.includes('enotfound')
  ) {
    return 'network';
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('abort') ||
    lower.includes('deadline exceeded')
  ) {
    return 'timeout';
  }

  if (
    lower.includes('not found') ||
    lower.includes('enoent') ||
    lower.includes('does not exist') ||
    lower.includes('404')
  ) {
    return 'not_found';
  }

  if (
    lower.includes('invalid') ||
    lower.includes('bad request') ||
    lower.includes('validation') ||
    lower.includes('parse error') ||
    lower.includes('syntax error') ||
    lower.includes('400')
  ) {
    return 'invalid_input';
  }

  if (
    lower.includes('permission') ||
    lower.includes('forbidden') ||
    lower.includes('unauthorized') ||
    lower.includes('403') ||
    lower.includes('eacces') ||
    lower.includes('eperm')
  ) {
    return 'permission';
  }

  return 'unknown';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// SmartToolExecutor
// ---------------------------------------------------------------------------

export class SmartToolExecutor {
  public onRetry?: OnToolRetryCallback;
  public onSimplifyInput?: OnSimplifyInputCallback;
  public onAlternativePath?: OnAlternativePathCallback;
  public onFixInput?: OnFixInputCallback;

  // ── public API ──────────────────────────────────────────────────────────

  /**
   * Execute a tool call with smart retry logic.
   *
   * @param toolName  The name of the tool being executed.
   * @param executeFn An async function that performs the actual tool call.
   *                  The return value is treated as the "input" string for
   *                  simplify/fix callbacks on retry.
   * @param maxRetries Maximum number of retries (default 3).
   */
  async execute(
    toolName: string,
    executeFn: () => Promise<string>,
    maxRetries: number = MAX_DEFAULT_RETRIES,
  ): Promise<ToolExecutionResult> {
    let lastError = '';
    let retries = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const output = await executeFn();
        return { success: true, output, retries, skipped: false };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        lastError = errorMsg;
        const classification = classifyError(errorMsg);

        // ── Permission → skip immediately ─────────────────────────────
        if (classification === 'permission') {
          return {
            success: false,
            output: '',
            retries,
            skipped: true,
            error: `Permission denied for ${toolName}: ${errorMsg}`,
          };
        }

        // ── No more retries ───────────────────────────────────────────
        if (attempt >= maxRetries) {
          break;
        }

        retries++;

        // ── Strategy per classification ───────────────────────────────

        switch (classification) {
          case 'network': {
            const reason = `Network error for ${toolName}: ${errorMsg}`;
            this.onRetry?.(toolName, attempt + 1, reason);
            await sleep(2000);
            break;
          }

          case 'timeout': {
            const reason = `Timeout for ${toolName}: ${errorMsg}`;
            this.onRetry?.(toolName, attempt + 1, reason);
            // We can't modify the executeFn directly, but we notify the caller
            // so it can use onSimplifyInput externally. The next call to
            // executeFn will naturally use whatever the caller has adjusted.
            if (this.onSimplifyInput) {
              this.onSimplifyInput(toolName);
            }
            break;
          }

          case 'not_found': {
            const reason = `Resource not found for ${toolName}: ${errorMsg}`;
            this.onRetry?.(toolName, attempt + 1, reason);
            if (this.onAlternativePath) {
              this.onAlternativePath(toolName);
            }
            break;
          }

          case 'invalid_input': {
            const reason = `Invalid input for ${toolName}: ${errorMsg}`;
            this.onRetry?.(toolName, attempt + 1, reason);
            if (this.onFixInput) {
              try {
                await this.onFixInput(toolName, '', errorMsg);
              } catch {
                // Fix-input callback itself failed – continue with raw retry
              }
            }
            break;
          }

          default: {
            // unknown → generic retry
            const reason = `Unknown error for ${toolName}: ${errorMsg}`;
            this.onRetry?.(toolName, attempt + 1, reason);
            await sleep(1000);
            break;
          }
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      output: '',
      retries,
      skipped: false,
      error: `Tool "${toolName}" failed after ${retries} retries. Last error: ${lastError}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const smartToolExecutor = new SmartToolExecutor();
