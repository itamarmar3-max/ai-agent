import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';
import { resolveWorkspacePath, isInsideWorkspace } from '../workspace';

/**
 * edit_file — apply a precise find-and-replace edit to a workspace file.
 *
 * Rewriting a whole file with write_file is wasteful (tokens) and risky (the
 * model can accidentally drop unrelated code). edit_file lets the agent change
 * exactly one region by matching an `oldString` and swapping in `newString`,
 * refusing ambiguous edits where the match isn't unique — the same contract
 * that makes coding agents reliable.
 */
export const editFileTool = tool(
  async ({ path: filePath, oldString, newString, replaceAll }: { path: string; oldString: string; newString: string; replaceAll?: boolean }): Promise<string> => {
    try {
      const resolved = resolveWorkspacePath(filePath);
      if (!isInsideWorkspace(resolved)) {
        return `Error: Path "${filePath}" is outside the workspace directory.`;
      }

      if (oldString === newString) {
        return 'Error: oldString and newString are identical — nothing to change.';
      }

      let content: string;
      try {
        content = await readFile(resolved, 'utf-8');
      } catch {
        return `Error: File "${filePath}" not found. Use write_file to create a new file, or list_files to find the right path.`;
      }

      const occurrences = content.split(oldString).length - 1;
      if (occurrences === 0) {
        return `Error: oldString not found in "${filePath}". Read the file first to copy the exact text (including whitespace).`;
      }
      if (occurrences > 1 && !replaceAll) {
        return `Error: oldString appears ${occurrences} times in "${filePath}". Provide more surrounding context to make it unique, or set replaceAll=true.`;
      }

      const updated = replaceAll
        ? content.split(oldString).join(newString)
        : content.replace(oldString, newString);

      await writeFile(resolved, updated, 'utf-8');
      return `Edited "${filePath}" — replaced ${replaceAll ? occurrences : 1} occurrence(s).`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error editing file: ${msg}`;
    }
  },
  {
    name: 'edit_file',
    description:
      'Make a targeted edit to an existing workspace file by replacing an exact ' +
      'snippet (`oldString`) with `newString`. Prefer this over write_file for changes ' +
      'to existing files — it is token-efficient and safe. `oldString` must match the ' +
      'file exactly (including indentation) and be unique unless replaceAll is true. ' +
      'Read the file first to copy the exact text.',
    schema: z.object({
      path: z.string().describe('File path relative to the workspace root'),
      oldString: z.string().describe('The exact existing text to replace (include enough context to be unique)'),
      newString: z.string().describe('The replacement text'),
      replaceAll: z.boolean().optional().describe('Replace every occurrence instead of requiring a unique match. Defaults to false.'),
    }),
  }
);
