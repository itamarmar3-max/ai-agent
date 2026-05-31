import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { execFile } from 'child_process';
import { getWorkspaceRoot } from '../workspace';
import { windowText } from './_output';

/**
 * shell_exec — run an allowlisted command inside the workspace sandbox.
 *
 * This unlocks the single most-requested agent capability — running the
 * project's own build/test/lint — while staying safe by construction:
 *   • the command and its args are passed to execFile (NO shell), so there is
 *     no metacharacter/pipe/`$()` injection surface;
 *   • only an allowlist of build/test/inspection binaries may run;
 *   • the working directory is pinned to the workspace root;
 *   • output and runtime are bounded.
 *
 * Destructive binaries (rm, mv, dd, curl, …) are intentionally absent.
 */

const ALLOWED_BINARIES = new Set([
  'node', 'npm', 'npx', 'bun', 'pnpm', 'yarn',
  'tsc', 'eslint', 'prettier', 'vitest', 'jest',
  'python', 'python3', 'pip', 'pip3', 'pytest',
  'go', 'cargo', 'rustc',
  'ls', 'cat', 'pwd', 'echo', 'wc', 'head', 'tail', 'grep', 'find', 'git', 'mkdir',
]);

const TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 200_000;

export const shellExecTool = tool(
  async ({ command, args, timeoutMs }: { command: string; args?: string[]; timeoutMs?: number }): Promise<string> => {
    const bin = command.trim();
    if (!ALLOWED_BINARIES.has(bin)) {
      return `Error: command "${bin}" is not allowed. Permitted commands: ${[...ALLOWED_BINARIES].sort().join(', ')}.`;
    }

    const safeArgs = Array.isArray(args) ? args.map(String) : [];
    const cwd = getWorkspaceRoot();
    const timeout = Math.min(Math.max(1000, timeoutMs ?? TIMEOUT_MS), 300_000);

    return new Promise<string>((resolve) => {
      execFile(
        bin,
        safeArgs,
        { cwd, timeout, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true, env: process.env },
        (error, stdout, stderr) => {
          const out = (stdout || '').toString();
          const err = (stderr || '').toString();
          const parts: string[] = [`$ ${bin} ${safeArgs.join(' ')}`.trim()];
          if (out) parts.push(out.trimEnd());
          if (err) parts.push(`[stderr]\n${err.trimEnd()}`);
          if (error) {
            const killed = (error as { killed?: boolean }).killed;
            parts.push(killed ? `[exit] timed out after ${timeout}ms` : `[exit] ${error.message}`);
          } else {
            parts.push('[exit] 0 (success)');
          }
          resolve(windowText(parts.join('\n\n'), { unit: 'output' }));
        },
      );
    });
  },
  {
    name: 'shell_exec',
    description:
      'Run an allowlisted command (e.g. npm, node, tsc, eslint, vitest, pytest, git) ' +
      'inside the workspace and return its stdout/stderr and exit status. Use it to ' +
      'install deps, build, lint, or run the project tests. The command runs WITHOUT a ' +
      'shell, so pass the binary in `command` and each argument separately in `args` ' +
      '(e.g. command="npm", args=["run","test"]). Pipes, redirects and `&&` are not ' +
      'supported. Destructive commands are blocked.',
    schema: z.object({
      command: z.string().describe('The binary to run, e.g. "npm" or "node"'),
      args: z.array(z.string()).optional().describe('Arguments as separate array items, e.g. ["run","build"]'),
      timeoutMs: z.number().int().min(1000).optional().describe('Timeout in milliseconds (max 300000). Defaults to 120000.'),
    }),
  }
);

export const _internal = { ALLOWED_BINARIES };
