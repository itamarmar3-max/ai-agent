import { describe, it, expect } from 'vitest';
import { LoopGuard, toolCallSignature } from '@/agent/loop_guard';

describe('toolCallSignature', () => {
  it('is stable regardless of argument key order', () => {
    expect(toolCallSignature('read_file', { a: 1, b: 2 })).toBe(
      toolCallSignature('read_file', { b: 2, a: 1 }),
    );
  });

  it('differs when the tool name or args differ', () => {
    expect(toolCallSignature('read_file', { p: 'x' })).not.toBe(
      toolCallSignature('read_file', { p: 'y' }),
    );
    expect(toolCallSignature('read_file', { p: 'x' })).not.toBe(
      toolCallSignature('write_file', { p: 'x' }),
    );
  });
});

describe('LoopGuard', () => {
  it('flags a loop after the same call repeats maxRepeats times', () => {
    const guard = new LoopGuard({ maxRepeats: 3 });
    expect(guard.record('web_search', { query: 'x' }).looping).toBe(false);
    expect(guard.record('web_search', { query: 'x' }).looping).toBe(false);
    const third = guard.record('web_search', { query: 'x' });
    expect(third.looping).toBe(true);
    expect(third.reason).toMatch(/web_search/);
  });

  it('does not flag distinct calls', () => {
    const guard = new LoopGuard({ maxRepeats: 3 });
    for (let i = 0; i < 10; i++) {
      expect(guard.record('web_search', { query: `q${i}` }).looping).toBe(false);
    }
  });

  it('enforces a hard total-call ceiling', () => {
    const guard = new LoopGuard({ maxRepeats: 100, maxTotalCalls: 5 });
    let looped = false;
    for (let i = 0; i < 10; i++) {
      if (guard.record('t', { i }).looping) looped = true;
    }
    expect(looped).toBe(true);
  });

  it('tracks repeat counts', () => {
    const guard = new LoopGuard({ maxRepeats: 100 });
    guard.record('t', { a: 1 });
    guard.record('t', { a: 1 });
    expect(guard.repeatsOf('t', { a: 1 })).toBe(2);
  });
});
