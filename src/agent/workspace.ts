/**
 * Centralized workspace path configuration.
 * All tools and modules reference paths through this module
 * instead of hardcoding `/home/z/my-project/workspace`.
 */

import path from 'path';
import { mkdir } from 'fs/promises';

const DEFAULT_WORKSPACE = path.resolve('workspace');

let workspaceRoot: string = process.env.WORKSPACE_ROOT || DEFAULT_WORKSPACE;

export function getWorkspaceRoot(): string {
  return workspaceRoot;
}

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root;
}

export function getMemoryDir(): string {
  return path.join(workspaceRoot, 'memory');
}

export function getLogsDir(): string {
  return path.join(workspaceRoot, 'logs');
}

export function getMemoryFile(): string {
  return path.join(workspaceRoot, '.memory.json');
}

export function resolveWorkspacePath(relativePath: string): string {
  return path.resolve(workspaceRoot, relativePath);
}

export function getProjectsDir(): string {
  return path.join(workspaceRoot, 'projects');
}

export function getChatsDir(): string {
  return path.join(workspaceRoot, 'chats');
}

export function resolveInsideRoot(root: string, relativePath: string): string | null {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relativePath);
  if (target === resolvedRoot) return target;
  const rel = path.relative(resolvedRoot, target);
  return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel) ? target : null;
}

export function sanitizeWorkspaceName(name: string, label = 'name'): string {
  const trimmed = name.trim();
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(trimmed) || trimmed === '.' || trimmed === '..') {
    throw new Error(`Invalid ${label}: only letters, numbers, dot, underscore, and dash are allowed`);
  }
  return trimmed;
}

export function isInsideWorkspace(resolvedPath: string): boolean {
  // Use path.relative instead of a raw prefix check: a naive startsWith()
  // wrongly accepts sibling directories that merely share the prefix
  // (e.g. "<root>-evil"). A path is inside the workspace iff the relative
  // path neither escapes upward ("..") nor is absolute.
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(resolvedPath);
  if (target === root) return true;
  const rel = path.relative(root, target);
  return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Ensure the workspace directory and its subdirectories exist.
 */
export async function ensureWorkspace(): Promise<void> {
  await mkdir(workspaceRoot, { recursive: true });
  await mkdir(getMemoryDir(), { recursive: true });
  await mkdir(getLogsDir(), { recursive: true });
  await mkdir(getProjectsDir(), { recursive: true });
  await mkdir(getChatsDir(), { recursive: true });
}
