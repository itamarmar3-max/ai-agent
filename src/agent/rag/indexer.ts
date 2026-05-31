/**
 * RAG Indexer — indexes project files and ranks them with a hybrid retriever.
 *
 * Scoring combines two signals:
 *   • BM25 lexical relevance (rare-term weighting + length normalisation), and
 *   • semantic cosine similarity over embeddings, when an embeddings endpoint
 *     is configured (EMBEDDINGS_API_KEY).
 * When embeddings are unavailable the retriever degrades gracefully to BM25
 * alone — already a clear improvement over the previous raw TF-cosine.
 */

import { chunkFile, isSupportedFile } from './chunker';
import { Bm25, tokenize, normalizeScores } from './bm25';
import { embedTexts, embedText, embeddingsEnabled, cosineSim } from './embeddings';

interface StoredDocument {
  id: string;
  content: string;
  metadata: {
    file_path: string;
    chunk_index: number;
    project_name: string;
    language: string;
    start_line: number;
    end_line: number;
  };
  tokens: string[];
  embedding?: number[];
}

interface ProjectIndex {
  docs: Map<string, StoredDocument>;
  bm25: Bm25;
  hasEmbeddings: boolean;
}

// Weight of the semantic signal in the hybrid score (rest goes to BM25).
const SEMANTIC_WEIGHT = 0.6;
const SCORE_THRESHOLD = 0.05;
const EMBED_BATCH = 64;

// Global in-memory store (persists for the lifetime of the server process).
const indices: Map<string, ProjectIndex> = new Map();

/**
 * Index files for a project. Embeds chunk contents in batches when embeddings
 * are enabled; otherwise stores lexical data only.
 */
export async function indexProject(
  projectName: string,
  files: Array<{ path: string; content: string }>,
): Promise<{
  totalFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  totalChunks: number;
}> {
  const docs = new Map<string, StoredDocument>();
  const bm25 = new Bm25();
  let indexedFiles = 0;
  let skippedFiles = 0;
  let totalChunks = 0;

  for (const file of files) {
    if (!isSupportedFile(file.path)) {
      skippedFiles++;
      continue;
    }

    const chunks = chunkFile(file.path, file.content, projectName);
    for (const chunk of chunks) {
      const tokens = tokenize(chunk.content);
      const doc: StoredDocument = {
        id: chunk.id,
        content: chunk.content,
        metadata: {
          file_path: chunk.file_path,
          chunk_index: chunk.chunk_index,
          project_name: chunk.project_name,
          language: chunk.language,
          start_line: chunk.start_line,
          end_line: chunk.end_line,
        },
        tokens,
      };
      docs.set(chunk.id, doc);
      bm25.add(chunk.id, tokens);
      totalChunks++;
    }
    indexedFiles++;
  }

  // Best-effort semantic embeddings (batched). Failure ⇒ lexical-only index.
  let hasEmbeddings = false;
  if (embeddingsEnabled() && docs.size > 0) {
    const allDocs = [...docs.values()];
    for (let i = 0; i < allDocs.length; i += EMBED_BATCH) {
      const batch = allDocs.slice(i, i + EMBED_BATCH);
      const vectors = await embedTexts(batch.map((d) => d.content));
      if (!vectors) break;
      batch.forEach((d, j) => {
        if (vectors[j]) d.embedding = vectors[j];
      });
      hasEmbeddings = true;
    }
  }

  indices.set(projectName, { docs, bm25, hasEmbeddings });

  return {
    totalFiles: files.length,
    indexedFiles,
    skippedFiles,
    totalChunks,
  };
}

/**
 * Search the index for relevant chunks using the hybrid scorer.
 */
export async function searchIndex(
  projectName: string,
  query: string,
  topK: number = 5,
): Promise<Array<{
  id: string;
  content: string;
  score: number;
  metadata: StoredDocument['metadata'];
}>> {
  const index = indices.get(projectName);
  if (!index || index.docs.size === 0) return [];

  // --- Lexical (BM25), normalised to [0,1] -------------------------------
  const queryTokens = tokenize(query);
  const lexical = normalizeScores(index.bm25.scoreAll(queryTokens));

  // --- Semantic (embeddings cosine), normalised to [0,1] -----------------
  let semantic = new Map<string, number>();
  if (index.hasEmbeddings) {
    const queryVec = await embedText(query);
    if (queryVec) {
      const raw = new Map<string, number>();
      for (const doc of index.docs.values()) {
        if (doc.embedding) raw.set(doc.id, Math.max(0, cosineSim(queryVec, doc.embedding)));
      }
      semantic = normalizeScores(raw);
    }
  }

  // --- Combine -----------------------------------------------------------
  const useHybrid = semantic.size > 0;
  const ids = new Set<string>([...lexical.keys(), ...semantic.keys()]);
  const results: Array<{ id: string; content: string; score: number; metadata: StoredDocument['metadata'] }> = [];

  for (const id of ids) {
    const lex = lexical.get(id) ?? 0;
    const sem = semantic.get(id) ?? 0;
    const score = useHybrid ? SEMANTIC_WEIGHT * sem + (1 - SEMANTIC_WEIGHT) * lex : lex;
    if (score <= SCORE_THRESHOLD) continue;
    const doc = index.docs.get(id)!;
    results.push({ id, content: doc.content, score, metadata: doc.metadata });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

export function hasIndex(projectName: string): boolean {
  const index = indices.get(projectName);
  return index !== undefined && index.docs.size > 0;
}

export function getIndexStats(projectName: string): {
  documentCount: number;
  projects: string[];
  semantic: boolean;
} {
  return {
    documentCount: indices.get(projectName)?.docs.size ?? 0,
    projects: [...indices.keys()],
    semantic: indices.get(projectName)?.hasEmbeddings ?? false,
  };
}

export function clearIndex(projectName: string): void {
  indices.delete(projectName);
}
