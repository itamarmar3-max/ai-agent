/**
 * BM25 lexical ranking.
 *
 * BM25 is the proven, parameter-light upgrade over the raw term-frequency
 * cosine the indexer used before: it rewards rare query terms (IDF) and
 * normalises for document length, so a short, on-topic chunk isn't buried by a
 * long one that merely repeats a common word. It is the lexical half of the
 * hybrid (semantic + lexical) retriever.
 *
 * Pure and dependency-free for straightforward unit testing.
 */

const K1 = 1.5;
const B = 0.75;

/** Tokenize text into lowercase alphanumeric terms (>2 chars). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

export class Bm25 {
  private readonly tf = new Map<string, Map<string, number>>(); // id -> term -> count
  private readonly len = new Map<string, number>();
  private readonly df = new Map<string, number>();
  private avgdl = 0;
  private built = false;

  /** Add a document by id with its already-tokenized terms. */
  add(id: string, tokens: string[]): void {
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    this.tf.set(id, counts);
    this.len.set(id, tokens.length);
    for (const term of counts.keys()) {
      this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }
    this.built = false;
  }

  private build(): void {
    let total = 0;
    for (const l of this.len.values()) total += l;
    this.avgdl = this.len.size > 0 ? total / this.len.size : 0;
    this.built = true;
  }

  private idf(term: string): number {
    const n = this.len.size;
    const df = this.df.get(term) ?? 0;
    // Standard BM25 idf with +1 to stay non-negative.
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /** BM25 score of a document for a tokenized query. */
  score(queryTokens: string[], id: string): number {
    if (!this.built) this.build();
    const counts = this.tf.get(id);
    if (!counts) return 0;
    const dl = this.len.get(id) ?? 0;
    let score = 0;
    for (const term of queryTokens) {
      const f = counts.get(term) ?? 0;
      if (f === 0) continue;
      const idf = this.idf(term);
      const denom = f + K1 * (1 - B + (B * dl) / (this.avgdl || 1));
      score += idf * ((f * (K1 + 1)) / denom);
    }
    return score;
  }

  /** Score every document for a query, returning id -> score (>0 only). */
  scoreAll(queryTokens: string[]): Map<string, number> {
    if (!this.built) this.build();
    const out = new Map<string, number>();
    for (const id of this.tf.keys()) {
      const s = this.score(queryTokens, id);
      if (s > 0) out.set(id, s);
    }
    return out;
  }

  get size(): number {
    return this.tf.size;
  }
}

/** Min-max normalise a score map into [0,1]. */
export function normalizeScores(scores: Map<string, number>): Map<string, number> {
  const values = [...scores.values()];
  if (values.length === 0) return new Map();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const out = new Map<string, number>();
  for (const [id, v] of scores) {
    out.set(id, range === 0 ? 1 : (v - min) / range);
  }
  return out;
}
