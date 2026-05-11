/**
 * RAG Retriever — Retrieves relevant context from indexed project files
 * and formats it for injection into the agent's context.
 */

import { searchIndex, hasIndex } from './indexer';

export interface RetrievalResult {
  query: string;
  projectName: string;
  chunks: Array<{
    content: string;
    score: number;
    file_path: string;
    start_line: number;
    end_line: number;
    language: string;
  }>;
  formattedContext: string;
}

/**
 * Retrieve relevant context for a query from a project's RAG index.
 */
export async function retrieveContext(
  query: string,
  projectName: string,
  topK: number = 5,
): Promise<RetrievalResult | null> {
  if (!hasIndex(projectName)) {
    return null;
  }

  const results = await searchIndex(projectName, query, topK);
  
  if (results.length === 0) {
    return null;
  }

  const chunks = results.map(r => ({
    content: r.content,
    score: r.score,
    file_path: r.metadata.file_path,
    start_line: r.metadata.start_line,
    end_line: r.metadata.end_line,
    language: r.metadata.language,
  }));

  // Format context for injection
  const formattedContext = formatRetrievedChunks(chunks, projectName);

  return {
    query,
    projectName,
    chunks,
    formattedContext,
  };
}

/**
 * Format retrieved chunks into a clear, labeled context string
 * for injection into the LLM prompt.
 */
function formatRetrievedChunks(
  chunks: RetrievalResult['chunks'],
  projectName: string,
): string {
  const parts: string[] = [
    `--- Retrieved Context from project "${projectName}" ---`,
    '',
  ];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    parts.push(
      `[${i + 1}] From: ${chunk.file_path}, lines ${chunk.start_line}-${chunk.end_line} (relevance: ${(chunk.score * 100).toFixed(0)}%)`,
    );
    parts.push('```' + chunk.language);
    parts.push(chunk.content);
    parts.push('```');
    parts.push('');
  }

  parts.push('--- End Retrieved Context ---');

  return parts.join('\n');
}

/**
 * Build a RAG-augmented query by combining the user's message
 * with retrieved project context.
 */
export function buildRAGQuery(userMessage: string): string {
  // Extract key terms from the user message for search
  // Simple approach: use the full message as query
  // More sophisticated: extract nouns, verbs, code identifiers
  return userMessage;
}
