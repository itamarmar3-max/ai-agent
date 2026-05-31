import { describe, it, expect } from 'vitest';
import {
  checkPathSafety,
  checkInputSafety,
  checkToolCallLimit,
  checkRateLimit,
  getSecurityStats,
  cleanupSession,
  setSecuritySession,
} from '@/agent/security';

describe('checkPathSafety', () => {
  it('blocks directory traversal and sensitive system paths', () => {
    for (const p of ['../etc/passwd', '~/.ssh/id_rsa', '/etc/shadow', '/proc/self', '/root/.bashrc']) {
      expect(checkPathSafety(p).allowed).toBe(false);
    }
  });

  it('allows ordinary workspace-relative paths', () => {
    expect(checkPathSafety('src/index.ts').allowed).toBe(true);
    expect(checkPathSafety('notes/todo.md').allowed).toBe(true);
  });
});

describe('checkInputSafety', () => {
  it('blocks dangerous shell/database patterns', () => {
    const r = checkInputSafety('run_javascript', { code: 'rm -rf /' }, 'sess-danger');
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/dangerous/i);
    cleanupSession('sess-danger');
  });

  it('allows benign input', () => {
    const r = checkInputSafety('write_file', { path: 'a.txt', content: 'hello world' }, 'sess-ok');
    expect(r.allowed).toBe(true);
    cleanupSession('sess-ok');
  });
});

describe('rate / call limits are per-session', () => {
  it('isolates counters between sessions', () => {
    setSecuritySession('A');
    setSecuritySession('B');
    for (let i = 0; i < 5; i++) checkToolCallLimit('A');
    const a = getSecurityStats('A');
    const b = getSecurityStats('B');
    expect(a.totalCalls).toBe(5);
    expect(b.totalCalls).toBe(0);
    cleanupSession('A');
    cleanupSession('B');
  });

  it('enforces the per-minute rate limit', () => {
    setSecuritySession('R');
    let blocked = false;
    for (let i = 0; i < 40; i++) {
      const r = checkRateLimit('R');
      if (!r.allowed) blocked = true;
    }
    expect(blocked).toBe(true);
    cleanupSession('R');
  });
});
