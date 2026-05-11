/**
 * RAG Indexer — Indexes project files into a vector store.
 * Uses vectra (local vector database) for embeddings storage.
 */

import { chunkFile, isSupportedFile, type Chunk } from './chunker';

/**
 * In-memory vector store for RAG.
 * Uses simple TF-IDF-like scoring for relevance when no embedding API is available.
 * Falls back gracefully if vectra is not installed.
 */

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
  // Simple term frequency vector for basic search
  termFreq: Map<string, number>;
}

// Global in-memory store (persists for the lifetime of the server process)
const indices: Map<string, Map<string, StoredDocument>> = new Map();

/**
 * Generate a simple bag-of-words representation for text.
 */
function buildTermFreq(text: string): Map<string, number> {
  const terms = new Map<string, number>();
  // Tokenize: lowercase, split on non-alphanumeric, filter short tokens
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  for (const word of words) {
    terms.set(word, (terms.get(word) ?? 0) + 1);
  }
  return terms;
}

/**
 * Calculate cosine similarity between two term frequency vectors.
 */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, freqA] of a) {
    normA += freqA * freqA;
    const freqB = b.get(term) ?? 0;
    dotProduct += freqA * freqB;
  }

  for (const freqB of b.values()) {
    normB += freqB * freqB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Index files for a project.
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
  const projectIndex = new Map<string, StoredDocument>();
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
      const termFreq = buildTermFreq(chunk.content);
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
        termFreq,
      };
      projectIndex.set(chunk.id, doc);
      totalChunks++;
    }
    indexedFiles++;
  }

  indices.set(projectName, projectIndex);

  return {
    totalFiles: files.length,
    indexedFiles,
    skippedFiles,
    totalChunks,
  };
}

/**
 * Search the index for relevant chunks.
 */
export async function searchIndex(
  projectName: string,
  query: string,
  topK: number = 5,
): Promise<Array<{
  id: string;
  content: string;
  score: number;
  metadata: {
    file_path: string;
    chunk_index: number;
    project_name: string;
    language: string;
    start_line: number;
    end_line: number;
  };
}>> {
  const projectIndex = indices.get(projectName);
  if (!projectIndex || projectIndex.size === 0) {
    return [];
  }

  const queryTerms = buildTermFreq(query);
  const results: Array<{
    id: string;
    content: string;
    score: number;
    metadata: StoredDocument['metadata'];
  }> = [];

  for (const [id, doc] of projectIndex) {
    const score = cosineSimilarity(queryTerms, doc.termFreq);
    if (score > 0.05) { // Minimum threshold
      results.push({
        id,
        content: doc.content,
        score,
        metadata: doc.metadata,
      });
    }
  }

  // Sort by score descending and return top K
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

/**
 * Check if a project index exists.
 */
export function hasIndex(projectName: string): boolean {
  const projectIndex = indices.get(projectName);
  return projectIndex !== undefined && projectIndex.size > 0;
}

/**
 * Get index stats.
 */
export function getIndexStats(projectName: string): {
  documentCount: number;
  projects: string[];
} {
  return {
    documentCount: indices.get(projectName)?.size ?? 0,
    projects: [...indices.keys()],
  };
}

/**
 * Clear a project index.
 */
export function clearIndex(projectName: string): void {
  indices.delete(projectName);
}
