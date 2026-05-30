import { promises as fs } from 'fs';
import path from 'path';
import type { WorkspaceFile } from '@/types';
import { getWorkspaceRoot, resolveInsideRoot } from '@/agent/workspace';

/**
 * Workspace root — all file operations are sandboxed here.
 */
const WORKSPACE_ROOT = getWorkspaceRoot();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure resolved path stays inside WORKSPACE_ROOT (path traversal guard).
 */
function safePath(userPath: string): string {
  const resolved = resolveInsideRoot(WORKSPACE_ROOT, userPath);
  if (!resolved) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

/**
 * Recursively build a WorkspaceFile tree from the filesystem.
 */
async function buildTree(dir: string, relative: string): Promise<WorkspaceFile[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes: WorkspaceFile[] = [];

  for (const entry of entries) {
    // Skip hidden files/dirs
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = relative ? `${relative}/${entry.name}` : entry.name;
    const stat = await fs.stat(fullPath);

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, relPath);
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'directory',
        children,
        size: stat.size,
      });
    } else {
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'file',
        size: stat.size,
      });
    }
  }

  // Sort: directories first, then alphabetical
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

// ---------------------------------------------------------------------------
// GET /api/workspace — Return file tree
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    await fs.mkdir(WORKSPACE_ROOT, { recursive: true });
    const tree = await buildTree(WORKSPACE_ROOT, '');
    return Response.json(tree);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/workspace — Create or delete a file/directory
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: 'write' | 'delete' | 'read';
      path?: string;
      content?: string;
    };

    if (!body.action || !body.path) {
      return Response.json({ error: 'action and path are required' }, { status: 400 });
    }

    const targetPath = safePath(body.path);

    switch (body.action) {
      case 'write': {
        // If content is provided → write a file.
        // If content is omitted → create a directory.
        if (body.content !== undefined && body.content !== null) {
          // Ensure parent directories exist.
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, body.content, 'utf-8');
          return Response.json({ success: true, path: body.path, type: 'file' });
        } else {
          await fs.mkdir(targetPath, { recursive: true });
          return Response.json({ success: true, path: body.path, type: 'directory' });
        }
      }

      case 'delete': {
        const stat = await fs.stat(targetPath).catch(() => null);
        if (!stat) {
          return Response.json({ error: 'Path not found' }, { status: 404 });
        }
        if (stat.isDirectory()) {
          await fs.rm(targetPath, { recursive: true, force: true });
        } else {
          await fs.unlink(targetPath);
        }
        return Response.json({ success: true, path: body.path });
      }

      case 'read': {
        const stat = await fs.stat(targetPath).catch(() => null);
        if (!stat) {
          return Response.json({ error: 'File not found' }, { status: 404 });
        }
        if (stat.isDirectory()) {
          return Response.json({ error: 'Cannot read a directory' }, { status: 400 });
        }
        const content = await fs.readFile(targetPath, 'utf-8');
        return Response.json({ content });
      }

      default:
        return Response.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
