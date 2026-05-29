/**
 * Intent classifier — decides whether a message needs the full agentic
 * pipeline (planning, decomposition, multi-agent, RAG) or just a fast
 * conversational reply.
 *
 * This is pure heuristic (no LLM call) so it adds zero latency.
 */

export type Intent =
  | 'smalltalk'   // hi, thanks, ok — no tools, no planning
  | 'question'    // single Q the LLM can answer directly with maybe one tool
  | 'task';       // multi-step work that benefits from a plan

export interface IntentResult {
  intent: Intent;
  reason: string;
  needsPlanning: boolean;
  needsDecomposition: boolean;
  needsMultiAgent: boolean;
}

const GREETINGS = [
  'hi', 'hello', 'hey', 'yo', 'sup', 'hola', 'שלום', 'היי', 'אהלן',
  'good morning', 'good afternoon', 'good evening', 'good night',
  'בוקר טוב', 'ערב טוב', 'לילה טוב',
];

const SMALLTALK_PHRASES = [
  'thanks', 'thank you', 'ty', 'thx', 'ok', 'okay', 'cool', 'great', 'nice',
  'awesome', 'perfect', 'got it', 'understood', 'noted',
  'תודה', 'תודה רבה', 'מעולה', 'יפה', 'בסדר', 'אוקיי', 'הבנתי',
  'who are you', 'what can you do', 'help', 'מה אתה יודע', 'מי אתה',
];

const TASK_INDICATORS = [
  'build', 'create', 'generate', 'write', 'implement', 'develop', 'scaffold',
  'design', 'refactor', 'migrate', 'analyze', 'audit', 'research',
  'deploy', 'test', 'fix bug', 'fix the', 'debug', 'investigate',
  'compare', 'benchmark', 'optimize', 'translate', 'extract',
  'search the web', 'scrape', 'download', 'crawl',
  'בנה', 'צור', 'תכתוב', 'תיצור', 'חקור', 'תחקור', 'תבדוק',
  'תמצא', 'תייצר', 'תכנן', 'תעצב',
];

const MULTI_STEP_HINTS = [
  ' and then ', ' after that ', ' followed by ', ' step by step ',
  ' multiple ', ' several ', ' all of ', ' entire ',
  '\n', '1.', '2.', '- ',
  'גם', 'בנוסף', 'ואז', 'לאחר מכן',
];

function tokenizeWords(text: string): string[] {
  return text.toLowerCase().replace(/[?!.,;:]/g, ' ').split(/\s+/).filter(Boolean);
}

function matchesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

function isPureGreeting(message: string): boolean {
  const tokens = tokenizeWords(message);
  if (tokens.length === 0) return false;
  if (tokens.length > 4) return false;
  return tokens.every((t) =>
    GREETINGS.includes(t) ||
    SMALLTALK_PHRASES.some((p) => p === t || p.split(' ').includes(t)),
  );
}

/**
 * Classify a user message into an intent category.
 *
 * The output drives whether the agent invokes the planner, task decomposer,
 * multi-agent orchestrator, or RAG retrieval — all of which add latency and
 * tokens for what may be a one-word greeting.
 */
export function classifyIntent(message: string, hasAttachments = false): IntentResult {
  const trimmed = message.trim();

  // Empty / very short — pure smalltalk
  if (trimmed.length === 0) {
    return {
      intent: 'smalltalk',
      reason: 'empty message',
      needsPlanning: false,
      needsDecomposition: false,
      needsMultiAgent: false,
    };
  }

  // Attachments always promote to at least 'question'
  if (hasAttachments) {
    return {
      intent: 'task',
      reason: 'message has attached files',
      needsPlanning: true,
      needsDecomposition: false,
      needsMultiAgent: false,
    };
  }

  // Pure greeting or smalltalk. Must match the WHOLE short message, not merely
  // CONTAIN a smalltalk word — "help me build a website" contains "help" but is
  // clearly a task. (Also fixes the && / || precedence ambiguity.)
  const normalized = trimmed.toLowerCase().replace(/[?!.,;:]/g, '').trim();
  const isShortSmalltalk = trimmed.length < 40 && SMALLTALK_PHRASES.some((p) => p === normalized);
  if (isPureGreeting(trimmed) || isShortSmalltalk) {
    return {
      intent: 'smalltalk',
      reason: 'greeting / acknowledgement',
      needsPlanning: false,
      needsDecomposition: false,
      needsMultiAgent: false,
    };
  }

  const tokens = tokenizeWords(trimmed);
  const wordCount = tokens.length;
  const hasTaskWord = matchesAny(trimmed, TASK_INDICATORS);
  const multiStepHints = MULTI_STEP_HINTS.filter((h) => trimmed.includes(h)).length;

  // Short single question — no planning needed
  if (wordCount <= 12 && !hasTaskWord && multiStepHints === 0) {
    return {
      intent: 'question',
      reason: 'short single-turn question',
      needsPlanning: false,
      needsDecomposition: false,
      needsMultiAgent: false,
    };
  }

  // Heavy multi-step task — full pipeline
  if (hasTaskWord && (wordCount > 25 || multiStepHints >= 2)) {
    return {
      intent: 'task',
      reason: 'multi-step task with explicit action verbs',
      needsPlanning: true,
      needsDecomposition: true,
      needsMultiAgent: wordCount > 40 || multiStepHints >= 3,
    };
  }

  // Single-action task
  if (hasTaskWord) {
    return {
      intent: 'task',
      reason: 'single-action task',
      needsPlanning: true,
      needsDecomposition: false,
      needsMultiAgent: false,
    };
  }

  // Medium-length question — let LLM decide if tools are needed,
  // but skip the heavy planning machinery.
  return {
    intent: 'question',
    reason: 'medium question without explicit task verbs',
    needsPlanning: false,
    needsDecomposition: false,
    needsMultiAgent: false,
  };
}

/**
 * Compact one-line summary for logging / UI.
 */
export function describeIntent(result: IntentResult): string {
  return `[${result.intent}] ${result.reason}`;
}
