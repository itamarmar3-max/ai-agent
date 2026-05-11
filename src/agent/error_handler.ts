/**
 * Smart retry and error handling system.
 * Provides exponential backoff retry, error logging, and input adjustment.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getLogsDir } from './workspace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorLog {
  toolName: string;
  input: Record<string, unknown>;
  error: string;
  timestamp: number;
  retryCount: number;
  resolved: boolean;
}

export interface ErrorConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ErrorConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

function getErrorLogFile(): string {
  return path.join(getLogsDir(), 'errors.json');
}

const SIMPLE_TOOLS = ['math_eval', 'uuid_generate', 'datetime_info', 'get_current_time'];
const FILE_TOOLS = ['read_file', 'write_file', 'list_files', 'delete_file', 'generate_file_structure'];
const WEB_TOOLS = ['web_search', 'web_scrape', 'url_metadata', 'scholar_search'];
const CODE_TOOLS = ['run_javascript'];

const TIMEOUT_SIMPLE = 10_000;
const TIMEOUT_FILE = 30_000;
const TIMEOUT_WEB = 20_000;
const TIMEOUT_CODE = 15_000;
const TIMEOUT_DEFAULT = 20_000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Executes a function with exponential backoff retry.
 */
export async function executeWithRetry(
  fn: () => Promise<string>,
  config?: Partial<ErrorConfig>,
): Promise<{ output: string; retries: number }> {
  const mergedConfig: ErrorConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError = '';

  for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      const output = await fn();
      return { output, retries: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);

      if (attempt < mergedConfig.maxRetries) {
        const delay = Math.min(
          mergedConfig.baseDelayMs * Math.pow(2, attempt) + Math.random() * 500,
          mergedConfig.maxDelayMs,
        );
        await sleep(delay);
      }
    }
  }

  return { output: `Error: ${lastError}`, retries: mergedConfig.maxRetries };
}

/**
 * Appends an error entry to the persistent error log file.
 */
export async function logError(error: ErrorLog): Promise<void> {
  try {
    await mkdir(getLogsDir(), { recursive: true });
    const existing = await loadErrorLog();
    existing.push(error);

    // Keep the log from growing too large — cap at 500 entries
    const trimmed = existing.length > 500 ? existing.slice(-500) : existing;
    await writeFile(getErrorLogFile(), JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch {
    // Silently fail — logging should never break the flow
  }
}

/**
 * Adjusts tool input based on the error that occurred.
 */
export function adjustInputOnError(
  toolName: string,
  input: Record<string, unknown>,
  error: string,
): Record<string, unknown> {
  const lowerError = error.toLowerCase();

  // "not found" → suggest alternative tool
  if (
    lowerError.includes('not found') ||
    lowerError.includes('no such file') ||
    lowerError.includes('enoent') ||
    lowerError.includes('does not exist')
  ) {
    if (toolName === 'read_file') {
      return {
        ...input,
        _suggestedTool: 'list_files',
        _suggestedReason: 'File not found — try listing files first to discover available paths.',
      };
    }
  }

  // "timeout" → return unchanged for retry
  if (
    lowerError.includes('timeout') ||
    lowerError.includes('timed out')
  ) {
    return input;
  }

  // "invalid" → try to fix common issues
  if (lowerError.includes('invalid')) {
    if (lowerError.includes('json')) {
      // If JSON is invalid, there's not much we can do automatically
      return input;
    }
    if (lowerError.includes('path') || lowerError.includes('file')) {
      // Suggest listing files
      return {
        ...input,
        _suggestedTool: 'list_files',
        _suggestedReason: 'Invalid path — try listing files first.',
      };
    }
  }

  // "permission" or "forbidden" — can't fix by adjusting input
  if (
    lowerError.includes('permission') ||
    lowerError.includes('forbidden') ||
    lowerError.includes('unauthorized') ||
    lowerError.includes('eacces')
  ) {
    return input;
  }

  // "rate limit" → return unchanged, backoff will handle it
  if (lowerError.includes('rate limit') || lowerError.includes('429')) {
    return input;
  }

  // Default: return unchanged
  return input;
}

/**
 * Determines whether a tool call should be retried based on the error and retry count.
 */
export function shouldRetry(error: string, retryCount: number): boolean {
  if (retryCount >= 3) return false;

  const lowerError = error.toLowerCase();

  // Never retry permission errors
  if (
    lowerError.includes('permission') ||
    lowerError.includes('forbidden') ||
    lowerError.includes('unauthorized')
  ) {
    return false;
  }

  // Never retry if the tool was not found
  if (lowerError.includes('tool') && lowerError.includes('not found')) {
    return false;
  }

  // Always retry timeout, network, and rate limit errors
  if (
    lowerError.includes('timeout') ||
    lowerError.includes('timed out') ||
    lowerError.includes('network') ||
    lowerError.includes('econnrefused') ||
    lowerError.includes('econnreset') ||
    lowerError.includes('rate limit') ||
    lowerError.includes('429') ||
    lowerError.includes('5xx') ||
    lowerError.includes('500') ||
    lowerError.includes('502') ||
    lowerError.includes('503')
  ) {
    return true;
  }

  // Retry "not found" errors once (might be a race condition)
  if (
    lowerError.includes('not found') &&
    retryCount < 1
  ) {
    return true;
  }

  // Default: allow retry if under limit
  return true;
}

/**
 * Returns the timeout in milliseconds for a given tool name.
 */
export function getToolTimeout(toolName: string): number {
  if (SIMPLE_TOOLS.includes(toolName)) return TIMEOUT_SIMPLE;
  if (FILE_TOOLS.includes(toolName)) return TIMEOUT_FILE;
  if (WEB_TOOLS.includes(toolName)) return TIMEOUT_WEB;
  if (CODE_TOOLS.includes(toolName)) return TIMEOUT_CODE;
  return TIMEOUT_DEFAULT;
}

/**
 * Returns true for destructive tools that require extra confirmation.
 */
export function isDestructiveTool(toolName: string): boolean {
  return toolName === 'delete_file';
}

/**
 * Reads the persistent error log from disk.
 */
export async function loadErrorLog(): Promise<ErrorLog[]> {
  try {
    const raw = await readFile(getErrorLogFile(), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Clears the persistent error log.
 */
export async function clearErrorLog(): Promise<void> {
  try {
    await mkdir(getLogsDir(), { recursive: true });
    await writeFile(getErrorLogFile(), JSON.stringify([], null, 2), 'utf-8');
  } catch {
    // Silently fail
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
