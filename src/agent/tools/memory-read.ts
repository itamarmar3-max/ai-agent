import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { getMemoryFile } from '../workspace';

/**
 * memory_read - Read all saved memory notes and facts.
 */
export const memoryReadTool = tool(
  async (): Promise<string> => {
    try {
      const content = await readFile(getMemoryFile(), 'utf-8');
      const memory = JSON.parse(content) as Record<string, string>;

      const entries = Object.entries(memory);

      if (entries.length === 0) {
        return 'No memories stored yet. Use memory_save to save information for later retrieval.';
      }

      const formatted = entries
        .map(([key, value], idx) => `${idx + 1}. [${key}]: ${value}`)
        .join('\n');

      return `Stored memories (${entries.length} entries):\n\n${formatted}`;
    } catch {
      return 'No memories stored yet. Use memory_save to save information for later retrieval.';
    }
  },
  {
    name: 'memory_read',
    description:
      'Read all saved memory notes and facts. Returns all key-value pairs stored in persistent memory.',
    schema: z.object({}),
  }
);
