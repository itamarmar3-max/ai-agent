import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { getWorkspaceRoot, resolveWorkspacePath, isInsideWorkspace } from '../workspace';

/**
 * read_file - Read the content of a file from the workspace.
 */
export const readFileTool = tool(
  async ({ path: filePath }: { path: string }): Promise<string> => {
    try {
      const resolvedPath = resolveWorkspacePath(filePath);

      // Security check: ensure path is within workspace
      if (!isInsideWorkspace(resolvedPath)) {
        return `Error: Path "${filePath}" is outside the workspace directory.`;
      }

      const content = await readFile(resolvedPath, 'utf-8');
      return content;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('ENOENT')) {
        return `Error: File "${filePath}" not found in workspace.`;
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
      'Read the content of a file from the workspace. Provide the file path relative to workspace root.',
    schema: z.object({
      path: z.string().describe('The file path relative to workspace root'),
    }),
  }
);
