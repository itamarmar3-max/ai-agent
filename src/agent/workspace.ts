/**
 * Centralized workspace path configuration.
 * All tools and modules reference paths through this module
 * instead of hardcoding `/home/z/my-project/workspace`.
 */

import path from 'path';
import { mkdir } from 'fs/promises';

const DEFAULT_WORKSPACE = path.join(process.cwd(), 'workspace');

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

export function isInsideWorkspace(resolvedPath: string): boolean {
  return resolvedPath.startsWith(workspaceRoot);
}

/**
 * Ensure the workspace directory and its subdirectories exist.
 */
export async function ensureWorkspace(): Promise<void> {
  await mkdir(workspaceRoot, { recursive: true });
  await mkdir(getMemoryDir(), { recursive: true });
  await mkdir(getLogsDir(), { recursive: true });
}
