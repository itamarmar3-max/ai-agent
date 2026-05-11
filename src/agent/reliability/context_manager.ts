/**
 * ContextManager - Token tracking, compression, and summarization utilities.
 *
 * Uses a character-based heuristic (≈4 chars per token) as a fallback when
 * tiktoken is not available. Keeps conversation size within limits.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenUsage {
  total: number;
  max: number;
  percentage: number;
  level: 'normal' | 'warning' | 'critical';
}

export interface CompressionResult {
  should: boolean;
  level: 'warning' | 'critical';
}

export interface Message {
  role: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHARS_PER_TOKEN = 4;

// ---------------------------------------------------------------------------
// ContextManager
// ---------------------------------------------------------------------------

export class ContextManager {
  private charsPerToken: number;

  constructor() {
    // If tiktoken or a compatible tokenizer is available, use it.
    // Otherwise fall back to the character heuristic.
    this.charsPerToken = CHARS_PER_TOKEN;
  }

  // ── public API ──────────────────────────────────────────────────────────

  /**
   * Estimate the number of tokens in a string.
   */
  countTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / this.charsPerToken);
  }

  /**
   * Total estimated tokens across all messages in a conversation.
   */
  getConversationTokens(messages: Message[]): number {
    return messages.reduce((sum, msg) => sum + this.countTokens(msg.content), 0);
  }

  /**
   * Determine whether the conversation should be compressed.
   *
   * - **warning**  at 70% usage
   * - **critical** at 90% usage
   */
  shouldCompress(usedTokens: number, maxTokens: number): CompressionResult {
    const pct = maxTokens > 0 ? usedTokens / maxTokens : 0;
    if (pct >= 0.9) return { should: true, level: 'critical' };
    if (pct >= 0.7) return { should: true, level: 'warning' };
    return { should: false, level: 'warning' };
  }

  /**
   * Build a `TokenUsage` summary.
   */
  getTokenUsage(usedTokens: number, maxTokens: number): TokenUsage {
    const percentage = maxTokens > 0 ? Math.round((usedTokens / maxTokens) * 100) : 0;
    let level: TokenUsage['level'] = 'normal';
    if (percentage >= 90) level = 'critical';
    else if (percentage >= 70) level = 'warning';

    return { total: usedTokens, max: maxTokens, percentage, level };
  }

  /**
   * Summarize a potentially large tool output by keeping the beginning and
   * the end, and collapsing the middle with `"..."`.
   */
  summarizeToolOutput(output: string, maxLength: number = 400): string {
    if (!output) return '';
    if (output.length <= maxLength) return output;

    const headLen = Math.floor(maxLength / 2);
    const tailLen = maxLength - headLen;

    const head = output.slice(0, headLen);
    const tail = output.slice(-tailLen);

    return `${head}\n\n... (${output.length - headLen - tailLen} characters omitted) ...\n\n${tail}`;
  }

  /**
   * Compress a message list to fit within a token budget.
   *
   * Strategy:
   * 1. Always keep the **system prompt** (first message with role "system").
   * 2. Always keep the **last 5 messages** (recent context).
   * 3. Summarize old assistant messages' content to ≤200 tokens each.
   * 4. Summarize old user messages' content to ≤100 tokens each.
   * 5. Drop the oldest messages if still over budget.
   */
  compressMessages(messages: Message[], maxTokens: number): Message[] {
    if (messages.length === 0) return [];

    const systemMessages: Message[] = [];
    const nonSystemMessages: Message[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push({ ...msg });
      } else {
        nonSystemMessages.push({ ...msg });
      }
    }

    // Always keep the last 5 non-system messages intact
    const recentCount = Math.min(5, nonSystemMessages.length);
    const oldMessages = nonSystemMessages.slice(0, -recentCount);
    const recentMessages = nonSystemMessages.slice(-recentCount);

    // Summarize old messages
    const summarizedOld: Message[] = oldMessages.map((msg) => {
      const maxContentTokens = msg.role === 'assistant' ? 200 : 100;
      const maxContentChars = maxContentTokens * this.charsPerToken;
      return {
        ...msg,
        content: this.summarizeToolOutput(msg.content, maxContentChars),
      };
    });

    // Compose: system + summarized old + recent
    const result = [...systemMessages, ...summarizedOld, ...recentMessages];

    // If still over budget, drop oldest messages until it fits
    let tokens = this.getConversationTokens(result);
    while (tokens > maxTokens && result.length > systemMessages.length + recentCount) {
      // Remove the oldest non-system message (index after system messages)
      const removeIdx = systemMessages.length;
      result.splice(removeIdx, 1);
      tokens = this.getConversationTokens(result);
    }

    return result;
  }

  /**
   * Format a token count for display, e.g. `"2,847 / 128,000 tokens"`.
   */
  formatTokenCount(used: number, max: number): string {
    const fmt = (n: number) => n.toLocaleString('en-US');
    return `${fmt(used)} / ${fmt(max)} tokens`;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const contextManager = new ContextManager();
