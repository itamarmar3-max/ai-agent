import { describe, it, expect } from 'vitest';
import { cosineSim, embeddingsEnabled } from '@/agent/rag/embeddings';

describe('cosineSim', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSim([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('returns 0 for mismatched lengths or empty input', () => {
    expect(cosineSim([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSim([], [])).toBe(0);
  });
});

describe('embeddingsEnabled', () => {
  it('reflects the EMBEDDINGS_API_KEY env var', () => {
    const prev = process.env.EMBEDDINGS_API_KEY;
    delete process.env.EMBEDDINGS_API_KEY;
    expect(embeddingsEnabled()).toBe(false);
    process.env.EMBEDDINGS_API_KEY = 'test-key';
    expect(embeddingsEnabled()).toBe(true);
    if (prev === undefined) delete process.env.EMBEDDINGS_API_KEY;
    else process.env.EMBEDDINGS_API_KEY = prev;
  });
});
