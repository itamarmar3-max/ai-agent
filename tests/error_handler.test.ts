import { describe, it, expect } from 'vitest';
import {
  shouldRetry,
  getToolTimeout,
  adjustInputOnError,
  executeWithRetry,
} from '@/agent/error_handler';

describe('shouldRetry', () => {
  it('retries transient failures', () => {
    expect(shouldRetry('Request timed out', 0)).toBe(true);
    expect(shouldRetry('network ECONNRESET', 0)).toBe(true);
    expect(shouldRetry('429 rate limit', 1)).toBe(true);
    expect(shouldRetry('503 service unavailable', 0)).toBe(true);
  });

  it('never retries permission / auth errors', () => {
    expect(shouldRetry('permission denied', 0)).toBe(false);
    expect(shouldRetry('Unauthorized', 0)).toBe(false);
    expect(shouldRetry('Tool "x" not found', 0)).toBe(false);
  });

  it('stops retrying once the count is exhausted', () => {
    expect(shouldRetry('timeout', 3)).toBe(false);
  });
});

describe('getToolTimeout', () => {
  it('assigns longer timeouts to file tools than simple tools', () => {
    expect(getToolTimeout('read_file')).toBeGreaterThan(getToolTimeout('math_eval'));
    expect(getToolTimeout('web_search')).toBeGreaterThan(0);
    expect(getToolTimeout('unknown_tool')).toBeGreaterThan(0);
  });
});

describe('adjustInputOnError', () => {
  it('suggests list_files when a read target is missing', () => {
    const adjusted = adjustInputOnError('read_file', { path: 'nope.txt' }, 'ENOENT: no such file');
    expect(adjusted._suggestedTool).toBe('list_files');
  });

  it('leaves input unchanged for permission errors', () => {
    const input = { path: 'a.txt' };
    expect(adjustInputOnError('read_file', input, 'permission denied')).toEqual(input);
  });
});

describe('executeWithRetry', () => {
  it('returns immediately on success', async () => {
    let calls = 0;
    const r = await executeWithRetry(async () => {
      calls++;
      return 'ok';
    });
    expect(r.output).toBe('ok');
    expect(r.retries).toBe(0);
    expect(calls).toBe(1);
  });

  it('retries then succeeds', async () => {
    let calls = 0;
    const r = await executeWithRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error('temporary failure');
        return 'recovered';
      },
      { baseDelayMs: 1, maxDelayMs: 5 },
    );
    expect(r.output).toBe('recovered');
    expect(r.retries).toBe(2);
  });

  it('reports an error after exhausting retries', async () => {
    const r = await executeWithRetry(
      async () => {
        throw new Error('always fails');
      },
      { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 5 },
    );
    expect(r.output).toMatch(/always fails/);
    expect(r.retries).toBe(2);
  });
});
