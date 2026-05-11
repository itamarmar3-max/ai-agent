import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { rm } from 'fs/promises';
import path from 'path';

const WORKSPACE_ROOT = '/home/z/my-project/workspace';

/**
 * delete_file - Delete a file from the workspace.
 */
export const deleteFileTool = tool(
  async ({ path: filePath }: { path: string }): Promise<string> => {
    try {
      const resolvedPath = path.resolve(WORKSPACE_ROOT, filePath);

      // Security check: ensure path is within workspace
      if (!resolvedPath.startsWith(WORKSPACE_ROOT)) {
        return `Error: Path "${filePath}" is outside the workspace directory.`;
      }

      await rm(resolvedPath, { recursive: true, force: true });
      return `Successfully deleted "${filePath}" from workspace.`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('ENOENT')) {
        return `Error: File or directory "${filePath}" not found in workspace.`;
      }
      return `Error deleting file: ${msg}`;
    }
  },
  {
    name: 'delete_file',
    description:
      'Delete a file or directory from the workspace. Provide the file path relative to workspace root.',
    schema: z.object({
      path: z.string().describe('The file path relative to workspace root'),
    }),
  }
);
