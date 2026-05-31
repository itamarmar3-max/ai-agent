import { describe, it, expect } from 'vitest';
import { windowText, approxTokens, DEFAULT_MAX_CHARS } from '@/agent/tools/_output';

describe('windowText', () => {
  it('returns text unchanged when within the limit and offset 0', () => {
    expect(windowText('short', { maxChars: 100 })).toBe('short');
  });

  it('truncates and adds a continuation notice with the next offset', () => {
    const text = 'a'.repeat(100);
    const out = windowText(text, { maxChars: 40, unit: 'file' });
    expect(out).toContain('Truncated');
    expect(out).toContain('offset=40');
    expect(out.startsWith('a'.repeat(40))).toBe(true);
  });

  it('reports end-of-content for a final non-zero-offset slice', () => {
    const text = 'a'.repeat(50);
    const out = windowText(text, { maxChars: 100, offset: 20, unit: 'file' });
    expect(out).toContain('End of file');
  });

  it('handles an offset past the end gracefully', () => {
    const out = windowText('abc', { offset: 99 });
    expect(out).toContain('past the end');
  });

  it('uses a sensible default ceiling', () => {
    expect(DEFAULT_MAX_CHARS).toBeGreaterThan(10_000);
  });
});

describe('approxTokens', () => {
  it('estimates ~4 chars per token', () => {
    expect(approxTokens('a'.repeat(40))).toBe(10);
  });
});
