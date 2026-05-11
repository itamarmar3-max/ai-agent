/**
 * RAG (Retrieval-Augmented Generation) Module
 *
 * Provides in-memory indexing and search over project files.
 * This module is the public API — all indexing and retrieval is delegated
 * to indexer.ts and retriever.ts to maintain a single data store.
 */

import fs from 'fs';
import path from 'path';
import { indexProject as indexerIndexProject, searchIndex as indexerSearchIndex, hasIndex as indexerHasIndex, getIndexStats as indexerGetIndexStats, clearIndex as indexerClearIndex } from './indexer';
import { retrieveContext } from './retriever';

export { retrieveContext } from './retriever';
export type { RetrievalResult } from './retriever';

import { getWorkspaceRoot } from '../workspace';

const PROJECTS_DIR = path.join(getWorkspaceRoot(), 'projects');

/**
 * Index all files in a project.
 * If `files` are provided, indexes them directly.
 * Otherwise, reads all files from the project directory on disk.
 */
export async function indexProject(
  projectName: string,
  files?: Array<{ path: string; content: string }>,
): Promise<{ success: boolean; chunks: number; files: number }> {
  if (files && files.length > 0) {
    // Index provided files directly via indexer
    const result = await indexerIndexProject(projectName, files);
    return { success: true, chunks: result.totalChunks, files: result.indexedFiles };
  }

  // Read files from disk and pass to indexer
  const projectPath = path.join(PROJECTS_DIR, projectName);
  if (!fs.existsSync(projectPath)) {
    return { success: false, chunks: 0, files: 0 };
  }

  const projectFiles = getAllProjectFiles(projectPath, '');
  const diskFiles: Array<{ path: string; content: string }> = [];

  for (const filePath of projectFiles) {
    try {
      const fullPath = path.join(projectPath, filePath);
      const stat = fs.statSync(fullPath);
      if (stat.size > 500_000) continue;

      const content = fs.readFileSync(fullPath, 'utf-8');
      if (!isTextContent(content)) continue;

      diskFiles.push({ path: filePath, content });
    } catch {
      // Skip unreadable files
    }
  }

  if (diskFiles.length === 0) {
    return { success: true, chunks: 0, files: 0 };
  }

  const result = await indexerIndexProject(projectName, diskFiles);
  return { success: true, chunks: result.totalChunks, files: result.indexedFiles };
}

/**
 * Search the index for relevant chunks (delegates to indexer).
 */
export async function searchIndex(
  projectName: string,
  query: string,
  topK: number = 5,
) {
  return indexerSearchIndex(projectName, query, topK);
}

/**
 * Check if a project has been indexed (delegates to indexer).
 */
export function hasIndex(projectName: string): boolean {
  return indexerHasIndex(projectName);
}

/**
 * Get index statistics for a project (delegates to indexer).
 */
export function getIndexStats(projectName: string) {
  return indexerGetIndexStats(projectName);
}

/**
 * Clear the index for a project (delegates to indexer).
 */
export function clearIndex(projectName: string): void {
  indexerClearIndex(projectName);
}

/**
 * Recursively get all files in a directory.
 */
function getAllProjectFiles(dirPath: string, basePath: string): string[] {
  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', 'bin', 'gen'].includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        results.push(...getAllProjectFiles(path.join(dirPath, entry.name), relativePath));
      } else {
        const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
        const binaryExtensions = [
          'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'svg', 'webp',
          'mp3', 'mp4', 'wav', 'avi', 'mov', 'flac', 'ogg',
          'zip', 'tar', 'gz', 'rar', '7z', 'bz2',
          'exe', 'dll', 'so', 'dylib', 'class', 'dex', 'apk',
          'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
          'ttf', 'otf', 'woff', 'woff2', 'eot',
        ];
        if (!binaryExtensions.includes(ext)) {
          results.push(relativePath);
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return results;
}

/**
 * Simple heuristic to check if content is text (not binary).
 */
function isTextContent(content: string): boolean {
  if (content.includes('\x00')) return false;
  const printable = content.slice(0, 512).replace(/[^\x20-\x7E\t\n\r]/g, '');
  return printable.length / Math.max(content.slice(0, 512).length, 1) > 0.85;
}
