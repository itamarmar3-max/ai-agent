/**
 * Loop guard — detects when the agent is stuck repeating the same action.
 *
 * The single biggest failure mode of autonomous tool-calling loops is the
 * "spin": the model keeps issuing the same tool call (often after an error it
 * cannot resolve), burning iterations, tokens, and money without making
 * progress. A plain iteration cap doesn't catch this early — the agent still
 * wastes every remaining turn. This guard records a signature for each tool
 * call and flags a loop the moment the same signature repeats too often.
 *
 * Pure and dependency-free so it is trivial to unit-test.
 */

export interface LoopGuardOptions {
  /** Flag a loop when the same tool+input is seen this many times. */
  maxRepeats?: number;
  /** Flag a loop when total tool calls exceed this hard ceiling. */
  maxTotalCalls?: number;
}

const DEFAULT_MAX_REPEATS = 3;
const DEFAULT_MAX_TOTAL_CALLS = 200;

/** Stable signature for a tool call — same name + same args ⇒ same signature. */
export function toolCallSignature(name: string, input: unknown): string {
  let argsKey: string;
  try {
    argsKey = stableStringify(input);
  } catch {
    argsKey = String(input);
  }
  return `${name}::${argsKey}`;
}

/** JSON.stringify with sorted object keys so arg order never affects the signature. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export class LoopGuard {
  private readonly counts = new Map<string, number>();
  private total = 0;
  private readonly maxRepeats: number;
  private readonly maxTotalCalls: number;

  constructor(options: LoopGuardOptions = {}) {
    this.maxRepeats = options.maxRepeats ?? DEFAULT_MAX_REPEATS;
    this.maxTotalCalls = options.maxTotalCalls ?? DEFAULT_MAX_TOTAL_CALLS;
  }

  /**
   * Record a tool call and report whether the agent now appears stuck.
   * Returns `{ looping: true, reason }` when a repeat/total threshold is hit.
   */
  record(name: string, input: unknown): { looping: boolean; reason?: string } {
    this.total++;
    if (this.total > this.maxTotalCalls) {
      return { looping: true, reason: `Exceeded ${this.maxTotalCalls} total tool calls without finishing.` };
    }

    const sig = toolCallSignature(name, input);
    const next = (this.counts.get(sig) ?? 0) + 1;
    this.counts.set(sig, next);

    if (next >= this.maxRepeats) {
      return {
        looping: true,
        reason: `Repeated the same "${name}" call ${next} times with identical arguments — stopping to avoid an infinite loop.`,
      };
    }
    return { looping: false };
  }

  /** How many times a given tool+input has been seen so far. */
  repeatsOf(name: string, input: unknown): number {
    return this.counts.get(toolCallSignature(name, input)) ?? 0;
  }

  get totalCalls(): number {
    return this.total;
  }
}
