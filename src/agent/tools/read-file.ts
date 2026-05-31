import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { resolveWorkspacePath, isInsideWorkspace } from '../workspace';
import { windowText, DEFAULT_MAX_CHARS } from './_output';

/**
 * read_file - Read the content of a file from the workspace, with paging so a
 * huge file can't flood the context window.
 */
export const readFileTool = tool(
  async ({ path: filePath, offset, maxChars }: { path: string; offset?: number; maxChars?: number }): Promise<string> => {
    try {
      const resolvedPath = resolveWorkspacePath(filePath);

      // Security check: ensure path is within workspace
      if (!isInsideWorkspace(resolvedPath)) {
        return `Error: Path "${filePath}" is outside the workspace directory.`;
      }

      const content = await readFile(resolvedPath, 'utf-8');
      return windowText(content, { offset, maxChars: maxChars ?? DEFAULT_MAX_CHARS, unit: 'file' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('ENOENT')) {
        return `Error: File "${filePath}" not found in workspace. Use list_files to discover available paths.`;
      }
      if (msg.includes('EISDIR')) {
        return `Error: "${filePath}" is a directory, not a file. Use list_files to see directory contents.`;
      }
      return `Error reading file: ${msg}`;
    }
  },
  {
    name: 'read_file',
    description:
      'Read a UTF-8 text file from the workspace. Provide a path relative to the ' +
      'workspace root. Large files are returned in ~100k-character pages; when a ' +
      'result is truncated, call again with the suggested `offset` to read the next ' +
      'page. Use list_files first if you are unsure of the exact path. For targeted ' +
      'changes, prefer edit_file over re-writing the whole file.',
    schema: z.object({
      path: z.string().describe('File path relative to the workspace root, e.g. "src/index.ts"'),
      offset: z.number().int().min(0).optional().describe('Character offset to start reading from (for paging large files). Defaults to 0.'),
      maxChars: z.number().int().min(1).optional().describe('Maximum characters to return in this call. Defaults to ~100,000.'),
    }),
  }
);
