import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * summarize_text - Summarize long text using extractive summarization.
 * Falls back to text truncation when LLM is not available.
 */
export const summarizeTextTool = tool(
  async ({ text, max_length }: { text: string; max_length?: number }): Promise<string> => {
    try {
      const maxLength = max_length || 200;

      if (!text || text.trim().length === 0) {
        return 'Error: No text provided to summarize.';
      }

      // Extractive summarization: pick key sentences
      const sentences = text
        .replace(/\n+/g, '. ')
        .replace(/\s+/g, ' ')
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      if (sentences.length === 0) {
        return text.length > maxLength
          ? text.slice(0, maxLength) + '...'
          : text;
      }

      if (sentences.length <= 3) {
        return sentences.join('. ') + '.';
      }

      // Score sentences by importance (word frequency heuristic)
      const allWords = text.toLowerCase().split(/\s+/);
      const wordFreq: Record<string, number> = {};
      const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
        'before', 'after', 'above', 'below', 'between', 'under', 'and', 'but',
        'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each',
        'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such',
        'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because',
        'if', 'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'this',
        'that', 'these', 'those', 'it', 'its', 'i', 'we', 'you', 'they', 'he',
        'she', 'me', 'us', 'them', 'him', 'her', 'my', 'our', 'your', 'their',
        'also', 'about', 'up', 'out', 'then', 'there', 'here',
      ]);

      for (const word of allWords) {
        const clean = word.replace(/[^a-z0-9]/g, '');
        if (clean.length > 1 && !stopWords.has(clean)) {
          wordFreq[clean] = (wordFreq[clean] || 0) + 1;
        }
      }

      const scoredSentences = sentences.map((sentence, idx) => {
        const words = sentence.toLowerCase().split(/\s+/);
        let score = 0;
        for (const word of words) {
          const clean = word.replace(/[^a-z0-9]/g, '');
          score += wordFreq[clean] || 0;
        }
        // Normalize by sentence length and boost first/last sentences
        score = score / Math.max(words.length, 1);
        if (idx === 0) score *= 1.5;
        if (idx === sentences.length - 1) score *= 1.2;
        return { sentence, score, idx };
      });

      // Sort by score, pick top sentences, then reorder
      const targetCount = Math.max(2, Math.min(5, Math.ceil(sentences.length * 0.3)));
      scoredSentences.sort((a, b) => b.score - a.score);
      const selected = scoredSentences.slice(0, targetCount).sort((a, b) => a.idx - b.idx);

      let summary = selected.map((s) => s.sentence).join('. ') + '.';

      // Truncate to max length if needed
      if (summary.length > maxLength) {
        summary = summary.slice(0, maxLength).replace(/\s+\S*$/, '') + '...';
      }

      return summary;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error summarizing text: ${msg}`;
    }
  },
  {
    name: 'summarize_text',
    description:
      'Summarize long text into a concise summary using extractive summarization. For more intelligent summaries, the AI model will handle summarization through the conversation.',
    schema: z.object({
      text: z.string().describe('The text to summarize'),
      max_length: z
        .number()
        .optional()
        .default(200)
        .describe('Maximum length of the summary in characters'),
    }),
  }
);
