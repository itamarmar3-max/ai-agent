/**
 * Text Chunker — Splits files into chunks for RAG indexing.
 * Uses a simple token-based approach with configurable chunk size and overlap.
 */

export interface Chunk {
  content: string;
  index: number;
  startLine: number;
  endLine: number;
}

const DEFAULT_CHUNK_SIZE = 500;   // tokens (approximate)
const DEFAULT_OVERLAP = 50;       // tokens overlap between chunks
const CHARS_PER_TOKEN = 4;        // heuristic for English text

/**
 * Supported file extensions for RAG indexing.
 */
export const SUPPORTED_EXTENSIONS = new Set([
  // Android/Kotlin/Java
  '.kt', '.kts', '.java', '.xml',
  // Web
  '.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.scss', '.less',
  // Python
  '.py', '.pyi',
  // Docs
  '.md', '.txt', '.rst',
  // Config
  '.json', '.yaml', '.yml', '.toml', '.gradle', '.properties',
  // Shell
  '.sh', '.bash', '.zsh',
  // Other
  '.sql', '.graphql', '.proto', '.env',
]);

/**
 * Check if a file extension is supported for indexing.
 */
export function isSupportedFile(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Get language identifier from file extension.
 */
export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const languageMap: Record<string, string> = {
    kt: 'kotlin', kts: 'kotlin', java: 'java',
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', pyi: 'python',
    xml: 'xml', html: 'html', css: 'css',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', txt: 'plaintext',
    sql: 'sql', graphql: 'graphql',
    sh: 'shell', bash: 'shell',
    gradle: 'groovy',
  };
  return languageMap[ext] ?? 'plaintext';
}

/**
 * Split text into chunks of approximately `chunkSize` characters
 * with `overlap` characters overlap between consecutive chunks.
 */
export function chunkText(
  content: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE * CHARS_PER_TOKEN,
  overlap: number = DEFAULT_OVERLAP * CHARS_PER_TOKEN,
): Chunk[] {
  if (!content || content.trim().length === 0) return [];

  const lines = content.split('\n');
  const chunks: Chunk[] = [];
  let currentChunk = '';
  let startLine = 1;
  let currentLine = 1;
  let charCount = 0;

  for (const line of lines) {
    const lineLength = line.length + 1; // +1 for newline

    if (charCount + lineLength > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunks.length,
        startLine,
        endLine: currentLine - 1,
      });

      // Calculate overlap: go back and include last N characters
      if (overlap > 0 && currentChunk.length > overlap) {
        const overlapText = currentChunk.slice(-overlap);
        // Find the last complete line in the overlap
        const lastNewline = overlapText.lastIndexOf('\n');
        currentChunk = lastNewline > 0 
          ? overlapText.slice(lastNewline + 1)
          : overlapText;
        startLine = currentLine;
      } else {
        currentChunk = '';
        startLine = currentLine;
      }
      charCount = currentChunk.length;
    }

    currentChunk += line + '\n';
    charCount += lineLength;
    currentLine++;
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunks.length,
      startLine,
      endLine: currentLine - 1,
    });
  }

  return chunks;
}

/**
 * Chunk a file with metadata.
 */
export function chunkFile(
  filePath: string,
  content: string,
  projectName: string,
): Array<{
  id: string;
  content: string;
  chunk_index: number;
  file_path: string;
  start_line: number;
  end_line: number;
  project_name: string;
  language: string;
}> {
  const chunks = chunkText(content);
  const language = getLanguageFromFilename(filePath);

  return chunks.map((chunk) => ({
    id: `${projectName}:${filePath}:${chunk.index}`,
    content: chunk.content,
    chunk_index: chunk.index,
    file_path: filePath,
    start_line: chunk.startLine,
    end_line: chunk.endLine,
    project_name: projectName,
    language,
  }));
}
