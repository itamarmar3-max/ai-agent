import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFile, readdir, stat } from 'fs/promises';
import path from 'path';
import { getWorkspaceRoot, isInsideWorkspace } from '../workspace';
import { windowText } from './_output';

/**
 * code_search — fast content search across workspace files (a ripgrep-style
 * grep implemented in pure Node, no external binary). This lets the agent
 * locate where a symbol/string lives without reading whole files one by one —
 * far more token-efficient than repeated read_file calls.
 */

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', 'bin', 'gen', 'coverage', '.cache']);
const BINARY_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'svg', 'webp', 'mp3', 'mp4', 'wav', 'avi', 'mov',
  'zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll', 'so', 'dylib', 'pdf', 'woff', 'woff2', 'ttf', 'otf',
]);
const MAX_FILE_BYTES = 1_000_000;
const MAX_MATCHES = 200;

async function walk(dir: string, out: string[], globExt?: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, out, globExt);
    } else {
      const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
      if (BINARY_EXT.has(ext)) continue;
      if (globExt && ext !== globExt.replace(/^\./, '').toLowerCase()) continue;
      out.push(full);
    }
  }
}

export const codeSearchTool = tool(
  async ({ pattern, regex, fileExt, caseSensitive }: { pattern: string; regex?: boolean; fileExt?: string; caseSensitive?: boolean }): Promise<string> => {
    const root = getWorkspaceRoot();
    let matcher: RegExp;
    try {
      matcher = regex
        ? new RegExp(pattern, caseSensitive ? 'g' : 'gi')
        : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
    } catch (e) {
      return `Error: invalid regular expression — ${e instanceof Error ? e.message : String(e)}`;
    }

    const files: string[] = [];
    await walk(root, files, fileExt);

    const lines: string[] = [];
    let matchCount = 0;
    for (const file of files) {
      if (matchCount >= MAX_MATCHES) break;
      try {
        const info = await stat(file);
        if (info.size > MAX_FILE_BYTES) continue;
        const content = await readFile(file, 'utf-8');
        if (content.includes('\x00')) continue;
        const rel = path.relative(root, file);
        const fileLines = content.split('\n');
        for (let i = 0; i < fileLines.length; i++) {
          matcher.lastIndex = 0;
          if (matcher.test(fileLines[i])) {
            lines.push(`${rel}:${i + 1}: ${fileLines[i].trim().slice(0, 200)}`);
            matchCount++;
            if (matchCount >= MAX_MATCHES) break;
          }
        }
      } catch {
        // skip unreadable file
      }
    }

    if (lines.length === 0) {
      return `No matches for ${regex ? 'regex' : 'text'} "${pattern}"${fileExt ? ` in *.${fileExt} files` : ''}.`;
    }

    const header = `Found ${lines.length}${matchCount >= MAX_MATCHES ? '+' : ''} match(es) for "${pattern}":\n\n`;
    return windowText(header + lines.join('\n'), { unit: 'results' });
  },
  {
    name: 'code_search',
    description:
      'Search the contents of all workspace files for a string or regular expression, ' +
      'returning matching `path:line: text` results (like ripgrep). Use this to locate ' +
      'where a symbol, function, or string is defined or used before reading whole files. ' +
      'Skips binaries and dependency folders (node_modules, .git, dist, …).',
    schema: z.object({
      pattern: z.string().describe('Text or regex to search for'),
      regex: z.boolean().optional().describe('Treat `pattern` as a regular expression. Defaults to false (literal text).'),
      fileExt: z.string().optional().describe('Limit search to files with this extension, e.g. "ts" or "py".'),
      caseSensitive: z.boolean().optional().describe('Case-sensitive match. Defaults to false.'),
    }),
  }
);

// Exposed for unit testing the traversal/skip logic.
export const _internal = { walk, SKIP_DIRS, BINARY_EXT };
