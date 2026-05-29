/**
 * Security layer for all tool operations.
 * Enforces path safety, input sanitization, rate limiting, and call limits.
 *
 * Uses per-session state via SecuritySession to avoid cross-session leaks.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  sanitizedInput?: Record<string, unknown>;
}

export interface SecurityStats {
  totalCalls: number;
  blockedCalls: number;
  callsThisMinute: number;
  lastCallTime: number;
  sessionStartTime: number;
}

// ---------------------------------------------------------------------------
// Per-session state
// ---------------------------------------------------------------------------

class SecuritySession {
  totalCalls = 0;
  blockedCalls = 0;
  callTimestamps: number[] = [];
  lastCallTime = 0;
  sessionStartTime = Date.now();

  pruneCallTimestamps(): void {
    const oneMinuteAgo = Date.now() - 60_000;
    while (this.callTimestamps.length > 0 && this.callTimestamps[0] < oneMinuteAgo) {
      this.callTimestamps.shift();
    }
  }

  reset(): void {
    this.totalCalls = 0;
    this.blockedCalls = 0;
    this.callTimestamps.length = 0;
    this.lastCallTime = 0;
    this.sessionStartTime = Date.now();
  }
}

// Map of session IDs to their security state
const sessions = new Map<string, SecuritySession>();

export function setSecuritySession(sessionId: string): void {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new SecuritySession());
  }
}

function getSession(sessionId?: string): SecuritySession {
  const id = sessionId ?? 'default';
  let session = sessions.get(id);
  if (!session) {
    session = new SecuritySession();
    sessions.set(id, session);
  }
  return session;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CALLS_PER_SESSION = 200;
const MAX_CALLS_PER_MINUTE = 30;
const MAX_READ_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_WRITE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const BLOCKED_PATH_PATTERNS = [
  '../',
  '~',
  '/etc',
  '/sys',
  '/proc',
  '/dev',
  '/root',
  '/boot',
  '/usr',
];

const DANGEROUS_PATTERNS = [
  'rm -rf',
  'rm -r /',
  'format ',
  'del /f',
  'drop table',
  'DROP DATABASE',
  'DROP TABLE',
  'truncate',
  'shutdown',
  'reboot',
  'mkfs',
  'dd if=',
  '> /dev/sda',
  'chmod -R 777 /',
  'wget | bash',
  'curl | bash',
  'curl | sh',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeString(value: string): string {
  let sanitized = value;
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(pattern), 'gi'), '[REDACTED]');
  }
  return sanitized;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = sanitizeValue(val);
    }
    return result;
  }
  return value;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Checks whether a file path is safe to access.
 */
export function checkPathSafety(filePath: string): SecurityCheckResult {
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (filePath.includes(pattern)) {
      return {
        allowed: false,
        reason: `Path contains blocked pattern "${pattern}". Access denied.`,
      };
    }
  }
  return { allowed: true };
}

/**
 * Checks an input object for dangerous patterns and returns a sanitized version.
 */
export function checkInputSafety(
  toolName: string,
  input: Record<string, unknown>,
  sessionId?: string,
): SecurityCheckResult {
  const inputStr = JSON.stringify(input).toLowerCase();
  const foundPatterns: string[] = [];

  for (const pattern of DANGEROUS_PATTERNS) {
    if (inputStr.includes(pattern.toLowerCase())) {
      foundPatterns.push(pattern);
    }
  }

  if (foundPatterns.length > 0) {
    const session = getSession(sessionId);
    session.blockedCalls++;

    const sanitizedInput: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitizedInput[key] = sanitizeValue(value);
    }

    return {
      allowed: false,
      reason: `Input contains dangerous patterns: ${foundPatterns.join(', ')}. Access denied.`,
      sanitizedInput,
    };
  }

  return { allowed: true, sanitizedInput: input };
}

/**
 * Enforces a maximum number of tool calls per session.
 */
export function checkToolCallLimit(sessionId?: string): SecurityCheckResult {
  const session = getSession(sessionId);
  if (session.totalCalls >= MAX_CALLS_PER_SESSION) {
    session.blockedCalls++;
    return {
      allowed: false,
      reason: `Tool call limit reached (${MAX_CALLS_PER_SESSION} per session).`,
    };
  }
  session.totalCalls++;
  session.lastCallTime = Date.now();
  return { allowed: true };
}

/**
 * Enforces a maximum number of tool calls per minute.
 */
export function checkRateLimit(sessionId?: string): SecurityCheckResult {
  const session = getSession(sessionId);
  const now = Date.now();
  session.pruneCallTimestamps();

  if (session.callTimestamps.length >= MAX_CALLS_PER_MINUTE) {
    session.blockedCalls++;
    return {
      allowed: false,
      reason: `Rate limit exceeded (${MAX_CALLS_PER_MINUTE} calls per minute).`,
    };
  }

  session.callTimestamps.push(now);
  session.lastCallTime = now;
  return { allowed: true };
}

/**
 * Checks whether a file size is within the read limit (5 MB).
 */
export function checkFileSizeForRead(sizeBytes: number): SecurityCheckResult {
  if (sizeBytes > MAX_READ_SIZE_BYTES) {
    return {
      allowed: false,
      reason: `File size (${formatBytes(sizeBytes)}) exceeds read limit (${formatBytes(MAX_READ_SIZE_BYTES)}).`,
    };
  }
  return { allowed: true };
}

/**
 * Checks whether a file size is within the write limit (10 MB).
 */
export function checkFileSizeForWrite(sizeBytes: number): SecurityCheckResult {
  if (sizeBytes > MAX_WRITE_SIZE_BYTES) {
    return {
      allowed: false,
      reason: `File size (${formatBytes(sizeBytes)}) exceeds write limit (${formatBytes(MAX_WRITE_SIZE_BYTES)}).`,
    };
  }
  return { allowed: true };
}

/**
 * Returns current security statistics.
 */
export function getSecurityStats(sessionId?: string): SecurityStats {
  const session = getSession(sessionId);
  session.pruneCallTimestamps();
  return {
    totalCalls: session.totalCalls,
    blockedCalls: session.blockedCalls,
    callsThisMinute: session.callTimestamps.length,
    lastCallTime: session.lastCallTime,
    sessionStartTime: session.sessionStartTime,
  };
}

/**
 * Resets all security stats for a session.
 */
export function resetSecurityStats(sessionId?: string): void {
  getSession(sessionId).reset();
}

/**
 * Clean up a session's security state (call when session ends).
 */
export function cleanupSession(sessionId: string): void {
  sessions.delete(sessionId);
}
