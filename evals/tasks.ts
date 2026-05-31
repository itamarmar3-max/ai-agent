/**
 * Standard eval tasks — a small, representative benchmark covering the agent's
 * core competencies (math, file I/O, code search, web research, multi-step
 * work). Each task's `check` asserts on the END STATE (output / tool usage)
 * rather than exact text, following ReliabilityBench's action-based correctness.
 *
 * Extend this list over time; keep checks robust to phrasing so they measure
 * capability, not wording.
 */

import type { EvalTask } from './harness';

export const EVAL_TASKS: EvalTask[] = [
  {
    id: 'math-basic',
    prompt: 'What is 1234 * 5678? Use a tool to be exact and give just the number.',
    mode: 'smart',
    check: (r) => {
      const passed = r.text.includes('7006652');
      return { passed, notes: passed ? undefined : `expected 7006652 in: ${r.text.slice(0, 120)}` };
    },
  },
  {
    id: 'file-write-read',
    prompt: 'Create a file named eval-note.txt in the workspace containing the text "hello-eval", then read it back to confirm.',
    mode: 'smart',
    check: (r) => {
      const wrote = r.toolCalls.some((c) => c.name === 'write_file');
      const read = r.toolCalls.some((c) => c.name === 'read_file' || c.name === 'code_search');
      return { passed: wrote && read, notes: `wrote=${wrote} read=${read}` };
    },
  },
  {
    id: 'web-research',
    prompt: 'Search the web for the latest stable Node.js LTS version and cite a source URL.',
    mode: 'smart',
    check: (r) => {
      const searched = r.toolCalls.some((c) => c.name === 'web_search' || c.name === 'web_scrape');
      const hasUrl = /https?:\/\//.test(r.text);
      return { passed: searched && hasUrl, notes: `searched=${searched} hasUrl=${hasUrl}` };
    },
  },
  {
    id: 'code-search',
    prompt: 'Find where the function classifyIntent is defined in the connected project using a search tool.',
    mode: 'smart',
    check: (r) => {
      const used = r.toolCalls.some((c) => c.name === 'code_search' || c.name === 'web_search');
      return { passed: used, notes: `usedSearch=${used}` };
    },
  },
  {
    id: 'multistep-build',
    prompt:
      'Build a tiny project: create package.json and an index.js that prints "ok", then list the workspace files to confirm both exist.',
    mode: 'deep',
    check: (r) => {
      const writes = r.toolCalls.filter((c) => c.name === 'write_file').length;
      const listed = r.toolCalls.some((c) => c.name === 'list_files');
      return { passed: writes >= 2 && listed, notes: `writes=${writes} listed=${listed}` };
    },
  },
];
