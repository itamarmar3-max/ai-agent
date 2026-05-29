/**
 * HealthMonitor - Real-time health tracking for the AI agent system.
 *
 * Maintains rolling windows for API response times, tool success rates,
 * token usage, and error frequency. Exposes a single health-status endpoint
 * and detailed metrics for UI dashboards.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  apiAvgResponseMs: number;
  apiP95ResponseMs: number;
  apiErrorRate: number;
  toolSuccessRate: number;
  tokensUsed: number;
  errorsPerMinute: number;
  mostFailingTool: string | null;
  uptime: number;
  totalToolCalls: number;
  totalAPICalls: number;
}

// ---------------------------------------------------------------------------
// Internal record types
// ---------------------------------------------------------------------------

interface APICallRecord {
  durationMs: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

interface ToolCallRecord {
  toolName: string;
  durationMs: number;
  success: boolean;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_API_HISTORY = 100;
const MAX_TOOL_HISTORY = 500;
const ERROR_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// HealthMonitor
// ---------------------------------------------------------------------------

export class HealthMonitor {
  private apiCallHistory: APICallRecord[] = [];
  private toolCallHistory: ToolCallRecord[] = [];
  private totalTokensUsed: number = 0;
  private startTime: number;
  private errorTimestamps: number[] = [];

  constructor() {
    this.startTime = Date.now();
  }

  // ── Ingestion API ──────────────────────────────────────────────────────

  /**
   * Record an API call outcome.
   */
  recordAPICall(durationMs: number, success: boolean, error?: string): void {
    this.apiCallHistory.push({
      durationMs,
      success,
      error,
      timestamp: Date.now(),
    });

    // Trim to rolling window
    if (this.apiCallHistory.length > MAX_API_HISTORY) {
      this.apiCallHistory = this.apiCallHistory.slice(-MAX_API_HISTORY);
    }

    if (!success) {
      this.errorTimestamps.push(Date.now());
    }
  }

  /**
   * Record a tool call outcome.
   */
  recordToolCall(toolName: string, durationMs: number, success: boolean): void {
    this.toolCallHistory.push({
      toolName,
      durationMs,
      success,
      timestamp: Date.now(),
    });
    if (this.toolCallHistory.length > MAX_TOOL_HISTORY) {
      this.toolCallHistory = this.toolCallHistory.slice(-MAX_TOOL_HISTORY);
    }

    if (!success) {
      this.errorTimestamps.push(Date.now());
    }
  }

  /**
   * Record token usage for a session.
   */
  recordTokenUsage(tokens: number): void {
    this.totalTokensUsed += tokens;
  }

  // ── Query API ──────────────────────────────────────────────────────────

  /**
   * Get full metrics for UI display.
   * Shape matches types/index.ts HealthMetrics exactly.
   */
  getMetrics(): HealthMetrics {
    const computed = this.computeDetails();

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (computed.apiErrorRate < 0.05) {
      status = 'healthy';
    } else if (computed.apiErrorRate < 0.2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      ...computed,
      uptime: Date.now() - this.startTime,
      totalToolCalls: this.toolCallHistory.length,
      totalAPICalls: this.apiCallHistory.length,
    };
  }

  /**
   * Reset all recorded data (useful for testing or new sessions).
   */
  reset(): void {
    this.apiCallHistory = [];
    this.toolCallHistory = [];
    this.totalTokensUsed = 0;
    this.startTime = Date.now();
    this.errorTimestamps = [];
  }

  // ── private helpers ─────────────────────────────────────────────────

  private computeDetails(): Omit<HealthMetrics, 'status' | 'uptime' | 'totalToolCalls' | 'totalAPICalls'> {
    // ── API metrics ───────────────────────────────────────────────────
    let apiAvgResponseMs = 0;
    let apiP95ResponseMs = 0;
    let apiErrorRate = 0;

    if (this.apiCallHistory.length > 0) {
      const durations = this.apiCallHistory.map((r) => r.durationMs).sort((a, b) => a - b);
      apiAvgResponseMs =
        durations.reduce((sum, d) => sum + d, 0) / durations.length;

      const p95Idx = Math.ceil(durations.length * 0.95) - 1;
      apiP95ResponseMs = durations[Math.max(0, p95Idx)];

      const failures = this.apiCallHistory.filter((r) => !r.success).length;
      apiErrorRate = failures / this.apiCallHistory.length;
    }

    // ── Tool metrics ──────────────────────────────────────────────────
    let toolSuccessRate = 1;
    let mostFailingTool: string | null = null;

    if (this.toolCallHistory.length > 0) {
      const successes = this.toolCallHistory.filter((r) => r.success).length;
      toolSuccessRate = successes / this.toolCallHistory.length;

      // Find the tool with the most failures
      const failureCounts = new Map<string, number>();
      for (const record of this.toolCallHistory) {
        if (!record.success) {
          failureCounts.set(record.toolName, (failureCounts.get(record.toolName) ?? 0) + 1);
        }
      }

      let maxFailures = 0;
      for (const [name, count] of failureCounts) {
        if (count > maxFailures) {
          maxFailures = count;
          mostFailingTool = name;
        }
      }
    }

    // ── Error frequency (errors per minute over last 5 min) ──────────
    const cutoff = Date.now() - ERROR_WINDOW_MS;
    this.errorTimestamps = this.errorTimestamps.filter((ts) => ts >= cutoff);
    const errorsPerMinute =
      ERROR_WINDOW_MS > 0
        ? (this.errorTimestamps.length / ERROR_WINDOW_MS) * 60_000
        : 0;

    return {
      apiAvgResponseMs: Math.round(apiAvgResponseMs),
      apiP95ResponseMs: Math.round(apiP95ResponseMs),
      apiErrorRate: Math.round(apiErrorRate * 1000) / 1000,
      toolSuccessRate: Math.round(toolSuccessRate * 1000) / 1000,
      tokensUsed: this.totalTokensUsed,
      errorsPerMinute: Math.round(errorsPerMinute * 100) / 100,
      mostFailingTool,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const healthMonitor = new HealthMonitor();
