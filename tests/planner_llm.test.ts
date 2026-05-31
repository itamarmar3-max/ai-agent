import { describe, it, expect } from 'vitest';
import { parsePlanJson } from '@/agent/planner_llm';

const TOOLS = ['web_search', 'write_file', 'read_file'];

describe('parsePlanJson', () => {
  it('parses a clean JSON plan', () => {
    const raw = JSON.stringify({
      goal: 'Build X',
      steps: ['step 1', 'step 2', 'step 3'],
      tools_needed: ['web_search', 'write_file'],
      estimated_complexity: 'high',
    });
    const plan = parsePlanJson(raw, TOOLS);
    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(3);
    expect(plan!.estimated_complexity).toBe('high');
  });

  it('strips code fences and surrounding prose', () => {
    const raw = 'Here is the plan:\n```json\n{"goal":"G","steps":["a","b"],"tools_needed":[],"estimated_complexity":"low"}\n```\nDone.';
    const plan = parsePlanJson(raw, TOOLS);
    expect(plan).not.toBeNull();
    expect(plan!.goal).toBe('G');
  });

  it('filters tools_needed to the available set', () => {
    const raw = JSON.stringify({
      goal: 'G',
      steps: ['a'],
      tools_needed: ['web_search', 'not_a_real_tool'],
      estimated_complexity: 'medium',
    });
    const plan = parsePlanJson(raw, TOOLS);
    expect(plan!.tools_needed).toEqual(['web_search']);
  });

  it('defaults an invalid complexity to medium', () => {
    const raw = JSON.stringify({ goal: 'G', steps: ['a'], tools_needed: [], estimated_complexity: 'bogus' });
    expect(parsePlanJson(raw, TOOLS)!.estimated_complexity).toBe('medium');
  });

  it('returns null for unparseable or empty-step input', () => {
    expect(parsePlanJson('not json at all', TOOLS)).toBeNull();
    expect(parsePlanJson(JSON.stringify({ goal: 'G', steps: [] }), TOOLS)).toBeNull();
    expect(parsePlanJson('', TOOLS)).toBeNull();
  });
});
