/**
 * Minimal structured logger.
 *
 * The codebase previously swallowed errors in silent `catch {}` blocks and had
 * no leveled, correlated logging — making production debugging guesswork. This
 * logger emits single-line JSON with a level, timestamp, message, an optional
 * request-id for correlating everything in one `/api/chat` call, and arbitrary
 * structured fields. It is dependency-free and safe to call from anywhere.
 *
 * Level is controlled by the LOG_LEVEL env var (debug|info|warn|error),
 * defaulting to "info". Set LOG_LEVEL=silent to disable.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function currentLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return (env in LEVEL_ORDER ? env : 'info') as LogLevel;
}

type Fields = Record<string, unknown>;

function emit(level: Exclude<LogLevel, 'silent'>, message: string, fields?: Fields, requestId?: string): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel()]) return;

  const record: Fields = {
    level,
    ts: new Date().toISOString(),
    msg: message,
    ...(requestId ? { requestId } : {}),
    ...(fields ?? {}),
  };

  let line: string;
  try {
    line = JSON.stringify(record);
  } catch {
    line = JSON.stringify({ level, ts: record.ts, msg: message, requestId });
  }

  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

export const logger = {
  debug: (message: string, fields?: Fields) => emit('debug', message, fields),
  info: (message: string, fields?: Fields) => emit('info', message, fields),
  warn: (message: string, fields?: Fields) => emit('warn', message, fields),
  error: (message: string, fields?: Fields) => emit('error', message, fields),
};

/**
 * A logger bound to a request id, so every line in one request is correlated.
 * Usage: `const log = childLogger(requestId); log.info('started', {...});`
 */
export function childLogger(requestId: string) {
  return {
    debug: (message: string, fields?: Fields) => emit('debug', message, fields, requestId),
    info: (message: string, fields?: Fields) => emit('info', message, fields, requestId),
    warn: (message: string, fields?: Fields) => emit('warn', message, fields, requestId),
    error: (message: string, fields?: Fields) => emit('error', message, fields, requestId),
  };
}

/** Generate a short correlation id for a request. */
export function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
