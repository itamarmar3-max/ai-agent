import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { setWorkspaceRoot } from '@/agent/workspace';
import { editFileTool } from '@/agent/tools/edit-file';
import { codeSearchTool } from '@/agent/tools/code-search';
import { readFileTool } from '@/agent/tools/read-file';

let workspace: string;

beforeAll(async () => {
  workspace = await mkdtemp(path.join(os.tmpdir(), 'ai-agent-test-'));
  setWorkspaceRoot(workspace);
  await mkdir(path.join(workspace, 'src'), { recursive: true });
  await writeFile(path.join(workspace, 'src', 'a.ts'), 'export const hello = "world";\nconst x = 1;\n', 'utf-8');
  await writeFile(path.join(workspace, 'src', 'b.ts'), 'function classifyIntent() { return 1; }\n', 'utf-8');
});

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

async function invoke(tool: { invoke: (i: any) => Promise<unknown> }, input: Record<string, unknown>): Promise<string> {
  return String(await tool.invoke(input));
}

describe('edit_file', () => {
  it('replaces a unique snippet', async () => {
    const out = await invoke(editFileTool, { path: 'src/a.ts', oldString: '"world"', newString: '"earth"' });
    expect(out).toContain('Edited');
    const content = await readFile(path.join(workspace, 'src', 'a.ts'), 'utf-8');
    expect(content).toContain('"earth"');
  });

  it('refuses when the snippet is not found', async () => {
    const out = await invoke(editFileTool, { path: 'src/a.ts', oldString: 'nonexistent-text', newString: 'x' });
    expect(out).toMatch(/not found/i);
  });

  it('blocks paths outside the workspace', async () => {
    const out = await invoke(editFileTool, { path: '../escape.ts', oldString: 'a', newString: 'b' });
    expect(out).toMatch(/outside the workspace/i);
  });
});

describe('code_search', () => {
  it('finds a literal symbol with path:line output', async () => {
    const out = await invoke(codeSearchTool, { pattern: 'classifyIntent' });
    expect(out).toContain('b.ts');
    expect(out).toMatch(/b\.ts:1:/);
  });

  it('reports no matches cleanly', async () => {
    const out = await invoke(codeSearchTool, { pattern: 'zzz_not_here_zzz' });
    expect(out).toMatch(/no matches/i);
  });

  it('respects the fileExt filter', async () => {
    const out = await invoke(codeSearchTool, { pattern: 'hello', fileExt: 'md' });
    expect(out).toMatch(/no matches/i);
  });
});

describe('read_file paging', () => {
  it('pages large files and signals continuation', async () => {
    await writeFile(path.join(workspace, 'big.txt'), 'x'.repeat(500), 'utf-8');
    const out = await invoke(readFileTool, { path: 'big.txt', maxChars: 100 });
    expect(out).toContain('offset=100');
  });
});
