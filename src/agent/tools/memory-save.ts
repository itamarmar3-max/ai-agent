import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getMemoryFile } from '../workspace';

/**
 * Read or initialize the memory store.
 */
async function readMemory(): Promise<Record<string, string>> {
  try {
    const content = await readFile(getMemoryFile(), 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Write the memory store to disk.
 */
async function writeMemory(memory: Record<string, string>): Promise<void> {
  const memFile = getMemoryFile();
  const dir = path.dirname(memFile);
  await mkdir(dir, { recursive: true });
  await writeFile(memFile, JSON.stringify(memory, null, 2), 'utf-8');
}

/**
 * memory_save - Save a note or fact to persistent memory.
 */
export const memorySaveTool = tool(
  async ({ key, value }: { key: string; value: string }): Promise<string> => {
    try {
      if (!key.trim()) {
        return 'Error: Memory key cannot be empty.';
      }
      if (!value.trim()) {
        return 'Error: Memory value cannot be empty.';
      }

      const memory = await readMemory();

      // Check if key already exists
      const isUpdate = key in memory;
      memory[key] = value;

      await writeMemory(memory);

      const totalEntries = Object.keys(memory).length;
      return `Memory ${isUpdate ? 'updated' : 'saved'} successfully!\n- Key: "${key}"\n- Value: "${value}"\n- Total memories stored: ${totalEntries}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error saving memory: ${msg}`;
    }
  },
  {
    name: 'memory_save',
    description:
      'Save a note, fact, or piece of information to persistent memory for later retrieval. Use meaningful keys for easy retrieval.',
    schema: z.object({
      key: z.string().describe('A unique key to identify this memory (e.g., "user_name", "project_preference")'),
      value: z.string().describe('The value or information to remember'),
    }),
  }
);
