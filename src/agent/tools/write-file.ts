import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { resolveWorkspacePath, isInsideWorkspace } from '../workspace';

/**
 * write_file - Write content to a file in the workspace.
 */
export const writeFileTool = tool(
  async ({ path: filePath, content }: { path: string; content: string }): Promise<string> => {
    try {
      const resolvedPath = resolveWorkspacePath(filePath);

      // Security check: ensure path is within workspace
      if (!isInsideWorkspace(resolvedPath)) {
        return `Error: Path "${filePath}" is outside the workspace directory.`;
      }

      // Create parent directories if needed
      const dir = path.dirname(resolvedPath);
      await mkdir(dir, { recursive: true });

      await writeFile(resolvedPath, content, 'utf-8');
      return `File "${filePath}" written successfully (${content.length} characters).`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error writing file: ${msg}`;
    }
  },
  {
    name: 'write_file',
    description:
      'Write content to a file in the workspace. Creates parent directories automatically. Provide file path relative to workspace root.',
    schema: z.object({
      path: z.string().describe('The file path relative to workspace root'),
      content: z.string().describe('The content to write to the file'),
    }),
  }
);
