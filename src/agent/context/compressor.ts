/**
 * Context Compression System
 * 
 * Monitors token count and compresses old messages when approaching
 * the context window limit. Uses heuristic token estimation.
 */

interface CompressedHistory {
  type: 'compressed_history';
  summary: string;
  original_message_count: number;
  compressed_at: number;
  retained_messages: Array<{ role: string; content: string }>;
}

// Estimate tokens using a simple heuristic (~4 chars per token for English)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Context limit (conservative estimate for most models)
const CONTEXT_LIMIT = 120000;  // tokens
const COMPRESSION_THRESHOLD = 0.7;  // compress at 70%
const COMPRESSION_TARGET = 0.5;  // compress oldest 50%

/**
 * Check if context compression is needed and compress if so.
 * Returns the potentially compressed message array.
 */
export function compressIfNeeded(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemPromptTokens?: number
): Array<{ role: 'user' | 'assistant' | 'system'; content: string; isCompressed?: boolean }> {
  const systemTokens = systemPromptTokens ?? estimateTokens('system prompt ~500 tokens');
  
  // Count total tokens
  let totalTokens = systemTokens;
  for (const msg of messages) {
    totalTokens += estimateTokens(msg.content);
  }
  
  const threshold = CONTEXT_LIMIT * COMPRESSION_THRESHOLD;
  if (totalTokens < threshold) {
    return messages;
  }
  
  // Need compression. Always keep a window of the most recent turns intact
  // (which includes the active user request at the tail) so compression can
  // never summarize away the message the agent is supposed to answer.
  const MIN_KEEP = 6;
  const splitPoint = Math.min(
    Math.floor(messages.length * COMPRESSION_TARGET),
    Math.max(0, messages.length - MIN_KEEP),
  );
  if (splitPoint <= 0) {
    return messages;
  }
  const toCompress = messages.slice(0, splitPoint);
  const toKeep = messages.slice(splitPoint);
  
  // Build summary from old messages
  const summary = buildCompressionSummary(toCompress);
  
  const compressedMsg: { role: 'system'; content: string; isCompressed: boolean } = {
    role: 'system',
    content: `[Context Compression] The following is a summary of ${toCompress.length} earlier messages:\n\n${summary}`,
    isCompressed: true,
  };
  
  return [compressedMsg, ...toKeep];
}

/**
 * Build a summary from an array of messages.
 * Extracts key information from user requests and assistant responses.
 */
function buildCompressionSummary(
  messages: Array<{ role: string; content: string }>
): string {
  const parts: string[] = [];
  
  // Summarize user messages (what was asked)
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length > 0) {
    const userSummary = userMessages
      .map((m, i) => {
        const truncated = m.content.length > 100 
          ? m.content.slice(0, 100) + '...'
          : m.content;
        return `${i + 1}. User asked: ${truncated}`;
      })
      .join('\n');
    parts.push(`Earlier in this conversation, the user made ${userMessages.length} requests:\n${userSummary}`);
  }
  
  // Note tool usage
  const toolPatterns = /\[Tool: (\w+)\]/g;
  const toolsUsed = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'assistant') {
      let match;
      while ((match = toolPatterns.exec(msg.content)) !== null) {
        toolsUsed.add(match[1]);
      }
    }
  }
  if (toolsUsed.size > 0) {
    parts.push(`Tools used: ${[...toolsUsed].join(', ')}`);
  }
  
  // Summarize assistant responses (brief)
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  if (assistantMessages.length > 0) {
    const responseCount = assistantMessages.length;
    const lastResponse = assistantMessages[assistantMessages.length - 1];
    const truncatedLast = lastResponse.content.length > 150
      ? lastResponse.content.slice(0, 150) + '...'
      : lastResponse.content;
    parts.push(`The agent provided ${responseCount} responses. The last compressed response was about: ${truncatedLast}`);
  }
  
  return parts.join('\n\n');
}

/**
 * Get current token estimate for a message array.
 */
export function getTokenCount(
  messages: Array<{ content: string }>,
  systemPrompt?: string
): { total: number; system: number; messages: number; percentage: number } {
  const systemTokens = systemPrompt ? estimateTokens(systemPrompt) : 500;
  let messageTokens = 0;
  for (const msg of messages) {
    messageTokens += estimateTokens(msg.content);
  }
  const total = systemTokens + messageTokens;
  return {
    total,
    system: systemTokens,
    messages: messageTokens,
    percentage: Math.round((total / CONTEXT_LIMIT) * 100),
  };
}
