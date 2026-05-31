import { describe, it, expect } from 'vitest';
import { Bm25, tokenize, normalizeScores } from '@/agent/rag/bm25';

describe('tokenize', () => {
  it('lowercases and drops short tokens and punctuation', () => {
    expect(tokenize('The Quick, brown FOX!')).toEqual(['the', 'quick', 'brown', 'fox']);
  });
});

describe('Bm25', () => {
  it('ranks the most relevant document first', () => {
    const bm = new Bm25();
    bm.add('d1', tokenize('the cat sat on the mat'));
    bm.add('d2', tokenize('financial markets and stock trading'));
    bm.add('d3', tokenize('a cat and a dog playing'));
    const scores = bm.scoreAll(tokenize('cat'));
    // d1 and d3 mention cat, d2 does not.
    expect(scores.has('d2')).toBe(false);
    expect((scores.get('d1') ?? 0)).toBeGreaterThan(0);
    expect((scores.get('d3') ?? 0)).toBeGreaterThan(0);
  });

  it('rewards rarer terms via idf', () => {
    const bm = new Bm25();
    bm.add('common', tokenize('data data data data data'));
    bm.add('rare', tokenize('data quantum'));
    // "quantum" is rare → the doc containing it should score for that query.
    const scores = bm.scoreAll(tokenize('quantum'));
    expect(scores.get('rare')).toBeGreaterThan(0);
    expect(scores.has('common')).toBe(false);
  });
});

describe('normalizeScores', () => {
  it('scales values into [0,1]', () => {
    const out = normalizeScores(new Map([['a', 2], ['b', 4], ['c', 6]]));
    expect(out.get('a')).toBeCloseTo(0, 5);
    expect(out.get('c')).toBeCloseTo(1, 5);
  });

  it('maps a single value to 1', () => {
    const out = normalizeScores(new Map([['a', 7]]));
    expect(out.get('a')).toBe(1);
  });
});
