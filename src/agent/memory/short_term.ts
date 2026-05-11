/**
 * Short-term session memory.
 * Stores tool outputs, decisions, and created files for the current session.
 *
 * Uses per-session state via a Map to avoid cross-session leaks.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShortTermMemory {
  toolOutputs: Array<{
    tool: string;
    input: Record<string, unknown>;
    output: string;
    timestamp: number;
  }>;
  decisions: string[];
  filesCreated: string[];
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// Per-session state
// ---------------------------------------------------------------------------

const sessions = new Map<string, ShortTermMemory>();
let currentSessionId = 'default';

function createEmptyMemory(): ShortTermMemory {
  return {
    toolOutputs: [],
    decisions: [],
    filesCreated: [],
    lastUpdated: Date.now(),
  };
}

export function setMemorySession(sessionId: string): void {
  currentSessionId = sessionId;
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, createEmptyMemory());
  }
}

function getMemory(): ShortTermMemory {
  let memory = sessions.get(currentSessionId);
  if (!memory) {
    memory = createEmptyMemory();
    sessions.set(currentSessionId, memory);
  }
  return memory;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the current session memory.
 */
export function getShortTermMemory(): ShortTermMemory {
  return getMemory();
}

/**
 * Records a tool output in session memory.
 */
export function addToolOutput(
  tool: string,
  input: Record<string, unknown>,
  output: string,
): void {
  const memory = getMemory();
  memory.toolOutputs.push({
    tool,
    input,
    output: truncate(output, 2000),
    timestamp: Date.now(),
  });
  memory.lastUpdated = Date.now();
}

/**
 * Records a decision made during the session.
 */
export function addDecision(decision: string): void {
  const memory = getMemory();
  memory.decisions.push(decision);
  memory.lastUpdated = Date.now();
}

/**
 * Records a file that was created during the session.
 */
export function addFileCreated(filePath: string): void {
  const memory = getMemory();
  if (!memory.filesCreated.includes(filePath)) {
    memory.filesCreated.push(filePath);
  }
  memory.lastUpdated = Date.now();
}

/**
 * Returns a formatted summary of all short-term memory for injection into LLM context.
 */
export function getMemoryContext(): string {
  const memory = getMemory();
  const lines: string[] = [];
  lines.push('=== Short-Term Memory (Current Session) ===');
  lines.push('');

  if (memory.decisions.length > 0) {
    lines.push('Key Decisions:');
    for (const d of memory.decisions) {
      lines.push(`  - ${d}`);
    }
    lines.push('');
  }

  if (memory.filesCreated.length > 0) {
    lines.push('Files Created This Session:');
    for (const f of memory.filesCreated) {
      lines.push(`  - ${f}`);
    }
    lines.push('');
  }

  if (memory.toolOutputs.length > 0) {
    lines.push(`Recent Tool Outputs (${memory.toolOutputs.length} total):`);
    const recentOutputs = memory.toolOutputs.slice(-5);
    for (const entry of recentOutputs) {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      lines.push(`  [${time}] ${entry.tool}: ${entry.output.substring(0, 200)}`);
    }
    lines.push('');
  }

  lines.push(`(Last updated: ${new Date(memory.lastUpdated).toISOString()})`);
  return lines.join('\n');
}

/**
 * Clears all short-term memory for the current session.
 */
export function clearMemory(): void {
  sessions.set(currentSessionId, createEmptyMemory());
}

/**
 * Returns true every 10 messages, signaling that memory should be summarized.
 */
export function shouldSummarize(messageCount: number): boolean {
  return messageCount > 0 && messageCount % 10 === 0;
}

/**
 * Trims old entries, keeping only the last 5 tool outputs and last 10 decisions.
 */
export function summarizeMemory(): void {
  const memory = getMemory();
  if (memory.toolOutputs.length > 5) {
    memory.toolOutputs = memory.toolOutputs.slice(-5);
  }
  if (memory.decisions.length > 10) {
    memory.decisions = memory.decisions.slice(-10);
  }
  memory.lastUpdated = Date.now();
}

/**
 * Clean up a session's memory (call when session ends).
 */
export function cleanupSession(sessionId: string): void {
  sessions.delete(sessionId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '... [truncated]';
}
