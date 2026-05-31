/**
 * Embeddings client for semantic RAG.
 *
 * The previous retriever scored chunks with plain term-frequency cosine, which
 * misses anything phrased differently from the query. When an embeddings
 * endpoint is configured (any OpenAI-compatible `/embeddings` API), this module
 * turns text into dense vectors so retrieval becomes truly semantic; without a
 * key, the retriever transparently falls back to lexical BM25 scoring.
 *
 * Configure via env:
 *   EMBEDDINGS_API_KEY   — required to enable semantic mode
 *   EMBEDDINGS_BASE_URL  — defaults to https://api.openai.com/v1
 *   EMBEDDINGS_MODEL     — defaults to text-embedding-3-small
 */

export function embeddingsEnabled(): boolean {
  return !!process.env.EMBEDDINGS_API_KEY;
}

function config() {
  return {
    apiKey: process.env.EMBEDDINGS_API_KEY ?? '',
    baseUrl: (process.env.EMBEDDINGS_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.EMBEDDINGS_MODEL ?? 'text-embedding-3-small',
  };
}

/**
 * Embed a batch of texts. Returns one vector per input, or null for the whole
 * batch if embeddings are disabled or the request fails (caller falls back to
 * lexical scoring).
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!embeddingsEnabled() || texts.length === 0) return null;
  const { apiKey, baseUrl, model } = config();

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: texts }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { data?: Array<{ embedding?: number[]; index?: number }> };
    if (!data.data || data.data.length === 0) return null;

    // Preserve input order (the API echoes an `index` per item).
    const out: number[][] = new Array(texts.length);
    data.data.forEach((item, i) => {
      const idx = typeof item.index === 'number' ? item.index : i;
      if (item.embedding) out[idx] = item.embedding;
    });
    return out.every((v) => Array.isArray(v)) ? out : null;
  } catch {
    return null;
  }
}

/** Embed a single text (convenience wrapper). */
export async function embedText(text: string): Promise<number[] | null> {
  const res = await embedTexts([text]);
  return res ? res[0] : null;
}

/** Cosine similarity between two equal-length dense vectors. */
export function cosineSim(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
