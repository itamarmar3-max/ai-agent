/**
 * SmartAPIClient - Wraps all API calls with intelligent retry logic.
 *
 * Handles rate limits, server errors, timeouts, context overflow,
 * auth failures, and network errors with appropriate strategies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface APICallParams {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  signal?: AbortSignal;
  maxRetries?: number;
}

export interface RetryState {
  attempt: number;
  maxRetries: number;
  reason: string;
  waitMs?: number;
}

export interface APICallResult {
  ok: boolean;
  data: unknown;
  error?: string;
  suggestion?: string;
}

/** Callback invoked on every retry so the UI can show progress. */
export type OnRetryCallback = (
  attempt: number,
  maxRetries: number,
  reason: string,
  waitMs?: number,
) => void;

/** Callback invoked when context_length_exceeded is detected. */
export type OnContextOverflowCallback = () => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_DEFAULT_RETRIES = 5;
const MAX_TOTAL_WAIT_MS = 30_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch TypeError = network failure
  if (err instanceof DOMException && err.name === 'AbortError') return false; // intentional abort
  if (err instanceof Error && err.message.toLowerCase().includes('network')) return true;
  if (err instanceof Error && err.message.toLowerCase().includes('fetch')) return true;
  return false;
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error && err.message.toLowerCase().includes('timeout')) return true;
  if (err instanceof Error && err.message.toLowerCase().includes('timed out')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// SmartAPIClient
// ---------------------------------------------------------------------------

export class SmartAPIClient {
  /** Exposed for UI consumption – the state of the last (or current) retry. */
  public lastRetryState: RetryState | null = null;

  public onRetry?: OnRetryCallback;
  public onContextOverflow?: OnContextOverflowCallback;

  // ── public API ──────────────────────────────────────────────────────────

  /**
   * Execute an API call with full smart-retry logic.
   *
   * @returns `APICallResult` – always resolves (never throws for retryable errors).
   */
  async call(params: APICallParams): Promise<APICallResult> {
    const maxRetries = params.maxRetries ?? MAX_DEFAULT_RETRIES;
    let totalWaited = 0;
    let lastError = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // ── Abort check ──────────────────────────────────────────────────
      if (params.signal?.aborted) {
        return {
          ok: false,
          data: null,
          error: 'Request aborted by user.',
          suggestion: 'The request was cancelled. No action needed.',
        };
      }

      // ── Execute the fetch ────────────────────────────────────────────
      let response: Response;
      try {
        response = await fetch(params.url, {
          method: 'POST',
          headers: params.headers,
          body: typeof params.body === 'string' ? params.body : JSON.stringify(params.body),
          signal: params.signal,
        });
      } catch (err: unknown) {
        if (isNetworkError(err)) {
          const reason = 'Network error – unable to reach the API.';
          this.lastRetryState = { attempt, maxRetries, reason };

          if (attempt < maxRetries) {
            const waitMs = 1000;
            if (totalWaited + waitMs > MAX_TOTAL_WAIT_MS) {
              break; // would exceed budget
            }
            this.onRetry?.(attempt + 1, maxRetries, reason, waitMs);
            await sleep(waitMs, params.signal);
            totalWaited += waitMs;
            continue;
          }

          return {
            ok: false,
            data: null,
            error: reason,
            suggestion:
              'Check your internet connection. If using a VPN, try disabling it temporarily.',
          };
        }

        if (isTimeoutError(err)) {
          const reason = 'Request timed out.';
          this.lastRetryState = { attempt, maxRetries, reason };

          if (attempt < maxRetries) {
            // Retry with a reduced max_tokens to hopefully get a faster response
            const adjustedBody = this.reduceMaxTokens(params.body);
            const waitMs = 1000;
            if (totalWaited + waitMs > MAX_TOTAL_WAIT_MS) break;
            this.onRetry?.(attempt + 1, maxRetries, reason, waitMs);
            await sleep(waitMs, params.signal);
            totalWaited += waitMs;
            params = { ...params, body: adjustedBody };
            continue;
          }

          return {
            ok: false,
            data: null,
            error: reason,
            suggestion:
              'The request is timing out. Try a shorter prompt or reduce max_tokens.',
          };
        }

        // Unknown fetch error
        const message = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          data: null,
          error: `Unexpected error: ${message}`,
          suggestion: 'Please try again. If the issue persists, contact support.',
        };
      }

      // ── Parse response body ──────────────────────────────────────────
      let data: unknown;
      let bodyText = '';
      try {
        bodyText = await response.text();
        data = JSON.parse(bodyText);
      } catch {
        data = bodyText;
      }

      // ── Success ──────────────────────────────────────────────────────
      if (response.ok) {
        this.lastRetryState = null;
        return { ok: true, data };
      }

      // ── Status-based handling ────────────────────────────────────────
      const status = response.status;
      lastError = `HTTP ${status}: ${response.statusText}`;

      // 429 Rate limit
      if (status === 429) {
        const retryAfterSec = response.headers.get('retry-after');
        const waitMs = retryAfterSec ? parseFloat(retryAfterSec) * 1000 : 2000;
        const reason = `Rate limited (429). Waiting ${waitMs}ms.`;
        this.lastRetryState = { attempt, maxRetries, reason, waitMs };

        if (attempt < maxRetries && totalWaited + waitMs <= MAX_TOTAL_WAIT_MS) {
          this.onRetry?.(attempt + 1, maxRetries, reason, waitMs);
          await sleep(waitMs, params.signal);
          totalWaited += waitMs;
          continue;
        }

        return {
          ok: false,
          data,
          error: 'Rate limit exceeded. All retries exhausted.',
          suggestion:
            'Wait a minute before sending another request, or upgrade your API plan for higher rate limits.',
        };
      }

      // 401 / 403 – invalid API key – stop immediately
      if (status === 401 || status === 403) {
        this.lastRetryState = null;
        return {
          ok: false,
          data,
          error: 'Authentication failed. Invalid or expired API key.',
          suggestion:
            'Check your API key in settings. Make sure it is correct and has not been revoked.',
        };
      }

      // 400 Bad request (may include context_length_exceeded)
      if (status === 400) {
        const errStr = typeof data === 'object' && data !== null
          ? JSON.stringify(data).toLowerCase()
          : String(data).toLowerCase();

        if (
          errStr.includes('context_length_exceeded') ||
          errStr.includes('maximum context length') ||
          errStr.includes('token limit')
        ) {
          this.lastRetryState = null;
          this.onContextOverflow?.();
          return {
            ok: false,
            data,
            error: 'Context length exceeded.',
            suggestion:
              'Your conversation is too long. Try starting a new conversation or use the /clear command.',
          };
        }

        this.lastRetryState = null;
        return {
          ok: false,
          data,
          error: `Bad request (400): ${lastError}`,
          suggestion: 'Review your request parameters and try again.',
        };
      }

      // 500 / 502 / 503 – server errors – exponential backoff
      if (status === 500 || status === 502 || status === 503) {
        const backoffMs = Math.min(2 ** attempt * 1000, 8000); // 1s, 2s, 4s, 8s capped
        const reason = `Server error (${status}). Backoff ${backoffMs}ms.`;
        this.lastRetryState = { attempt, maxRetries, reason, waitMs: backoffMs };

        if (attempt < maxRetries && totalWaited + backoffMs <= MAX_TOTAL_WAIT_MS) {
          this.onRetry?.(attempt + 1, maxRetries, reason, backoffMs);
          await sleep(backoffMs, params.signal);
          totalWaited += backoffMs;
          continue;
        }

        return {
          ok: false,
          data,
          error: `Server error (${status}). All retries exhausted.`,
          suggestion:
            'The API server is temporarily unavailable. Please wait a moment and try again.',
        };
      }

      // Any other non-retryable status
      this.lastRetryState = null;
      return {
        ok: false,
        data,
        error: lastError,
        suggestion: 'Check the request parameters and try again.',
      };
    }

    // All retries exhausted (loop exited via break)
    this.lastRetryState = null;
    return {
      ok: false,
      data: null,
      error: `All ${maxRetries} retries exhausted. Last error: ${lastError}`,
      suggestion:
        'The API is currently unavailable. Please wait a few moments and try again.',
    };
  }

  // ── private helpers ─────────────────────────────────────────────────

  /**
   * Attempt to reduce `max_tokens` in the request body so subsequent
   * retries are more likely to complete before timeout.
   */
  private reduceMaxTokens(body: unknown): unknown {
    if (typeof body !== 'object' || body === null) return body;
    const cloned = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;

    // OpenAI-style body
    if (typeof cloned.max_tokens === 'number' && cloned.max_tokens > 256) {
      cloned.max_tokens = Math.floor(cloned.max_tokens * 0.6);
      return cloned;
    }

    // Anthropic-style body
    if (
      cloned.max_tokens !== undefined &&
      typeof (cloned as Record<string, unknown>).max_tokens === 'number'
    ) {
      const mt = (cloned as Record<string, number>).max_tokens;
      if (mt > 256) {
        (cloned as Record<string, number>).max_tokens = Math.floor(mt * 0.6);
      }
    }

    return cloned;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const smartAPIClient = new SmartAPIClient();
