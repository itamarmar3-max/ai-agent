import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { getWorkspaceRoot } from '../workspace';

/**
 * Recursively build a tree of files/directories.
 */
async function buildTree(dirPath: string, prefix: string = '', isRoot: boolean = true): Promise<string> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  // Filter out hidden files/dirs (starting with .) except .memory.json
  const filtered = entries.filter(
    (entry) => entry.name !== '.memory.json' && !entry.name.startsWith('.')
  );

  // Sort: directories first, then files
  filtered.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  let result = '';
  for (let i = 0; i < filtered.length; i++) {
    const entry = filtered[i];
    const isLast = i === filtered.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    if (entry.isDirectory()) {
      result += `${prefix}${connector}📁 ${entry.name}/\n`;
      try {
        const childTree = await buildTree(
          path.join(dirPath, entry.name),
          prefix + childPrefix,
          false
        );
        result += childTree;
      } catch {
        // Skip directories we can't read
      }
    } else {
      const size = await stat(path.join(dirPath, entry.name)).catch(() => null);
      const sizeStr = size ? ` (${formatSize(size.size)})` : '';
      result += `${prefix}${connector}📄 ${entry.name}${sizeStr}\n`;
    }
  }

  return result;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * list_files - List all files and folders in the workspace directory.
 */
export const listFilesTool = tool(
  async (): Promise<string> => {
    try {
      const WORKSPACE_ROOT = getWorkspaceRoot();
      let result = '📂 Workspace File Tree:\n';
      result += `    ${WORKSPACE_ROOT}/\n`;

      try {
        const tree = await buildTree(WORKSPACE_ROOT);
        result += tree;
      } catch {
        // If reading fails, workspace might be empty
      }

      if (result === `📂 Workspace File Tree:\n    ${WORKSPACE_ROOT}/\n`) {
        return result + '\n    (workspace is empty)';
      }

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error listing files: ${msg}`;
    }
  },
  {
    name: 'list_files',
    description:
      'List all files and folders in the workspace directory in a tree format.',
    schema: z.object({}),
  }
);
