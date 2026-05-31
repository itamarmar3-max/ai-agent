import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { execFile } from 'child_process';
import { resolveWorkspacePath, isInsideWorkspace, getWorkspaceRoot } from '../workspace';
import { windowText } from './_output';

/**
 * Local git tools — read-only inspection of a git repository inside the
 * workspace (status, diff, log). Complements the remote GitHub API tools with
 * local source-control awareness, so the agent can see uncommitted changes and
 * recent history of a connected project. Runs git via execFile (no shell).
 */

function runGit(args: string[], subPath?: string): Promise<string> {
  let cwd = getWorkspaceRoot();
  if (subPath) {
    const resolved = resolveWorkspacePath(subPath);
    if (!isInsideWorkspace(resolved)) {
      return Promise.resolve(`Error: path "${subPath}" is outside the workspace.`);
    }
    cwd = resolved;
  }
  return new Promise<string>((resolve) => {
    execFile('git', args, { cwd, timeout: 30_000, maxBuffer: 200_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error && !stdout) {
        const msg = (stderr || error.message || '').toString().trim();
        resolve(`Error running "git ${args.join(' ')}": ${msg || 'unknown error'}`);
        return;
      }
      const out = (stdout || '').toString().trim();
      resolve(windowText(out || '(no output)', { unit: 'output' }));
    });
  });
}

export const gitStatusTool = tool(
  async ({ path: subPath }: { path?: string }): Promise<string> => runGit(['status', '--short', '--branch'], subPath),
  {
    name: 'git_status',
    description:
      'Show the local git working-tree status (current branch, staged, modified and ' +
      'untracked files) for a repository in the workspace. Read-only.',
    schema: z.object({
      path: z.string().optional().describe('Optional sub-path of the repo within the workspace. Defaults to the workspace root.'),
    }),
  }
);

export const gitDiffTool = tool(
  async ({ path: subPath, staged, file }: { path?: string; staged?: boolean; file?: string }): Promise<string> => {
    const args = ['diff'];
    if (staged) args.push('--staged');
    if (file) args.push('--', file);
    return runGit(args, subPath);
  },
  {
    name: 'git_diff',
    description:
      'Show the local git diff of uncommitted changes. Use it to review exactly what ' +
      'changed before committing or summarizing work. Read-only.',
    schema: z.object({
      path: z.string().optional().describe('Optional repo sub-path within the workspace.'),
      staged: z.boolean().optional().describe('Show staged (index) changes instead of working-tree changes.'),
      file: z.string().optional().describe('Limit the diff to a single file path.'),
    }),
  }
);

export const gitLogTool = tool(
  async ({ path: subPath, limit }: { path?: string; limit?: number }): Promise<string> => {
    const n = Math.min(Math.max(1, limit ?? 15), 100);
    return runGit(['log', `-n${n}`, '--pretty=format:%h %ad %an %s', '--date=short'], subPath);
  },
  {
    name: 'git_log',
    description:
      'Show recent local git commit history (hash, date, author, subject) for a ' +
      'repository in the workspace. Read-only.',
    schema: z.object({
      path: z.string().optional().describe('Optional repo sub-path within the workspace.'),
      limit: z.number().int().min(1).max(100).optional().describe('Number of commits to show (1–100). Defaults to 15.'),
    }),
  }
);
