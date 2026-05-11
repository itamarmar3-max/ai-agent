import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * uuid_generate - Generate unique UUID identifiers.
 */
export const uuidGenerateTool = tool(
  async ({ count }: { count?: number }): Promise<string> => {
    try {
      const num = Math.min(Math.max(count || 1, 1), 100);

      if (num === 1) {
        return uuidv4();
      }

      const uuids: string[] = [];
      for (let i = 0; i < num; i++) {
        uuids.push(`${i + 1}. ${uuidv4()}`);
      }

      return `Generated ${num} UUID(s):\n\n${uuids.join('\n')}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error generating UUID: ${msg}`;
    }
  },
  {
    name: 'uuid_generate',
    description:
      'Generate one or more unique UUID (v4) identifiers. Useful for creating unique IDs for resources.',
    schema: z.object({
      count: z
        .number()
        .optional()
        .default(1)
        .describe('Number of UUIDs to generate (1-100, default 1)'),
    }),
  }
);
