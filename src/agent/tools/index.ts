import { z } from 'zod';
import type { ImageApiConfig } from './generate-image';

// Import all tool implementations
import { webSearchTool } from './web-search';
import { webScrapeTool } from './web-scrape';
import { readFileTool } from './read-file';
import { writeFileTool } from './write-file';
import { listFilesTool } from './list-files';
import { deleteFileTool } from './delete-file';
import { createZipTool } from './create-zip';
import { runJavascriptTool } from './run-javascript';
import { createGenerateImageTool } from './generate-image';
import { fetchApiTool } from './fetch-api';
import { summarizeTextTool } from './summarize-text';
import { translateTextTool } from './translate-text';
import { extractJsonTool } from './extract-json';
import { mathEvalTool } from './math-eval';
import { generateFileStructureTool } from './generate-file-structure';
import { memorySaveTool } from './memory-save';
import { memoryReadTool } from './memory-read';
import { datetimeInfoTool } from './datetime-info';
import { uuidGenerateTool } from './uuid-generate';
import { formatCodeTool } from './format-code';
import { scholarSearchTool } from './scholar-search';
import { webpageScreenshotTool } from './webpage-screenshot';
import { urlMetadataTool } from './url-metadata';
import { fileFormatConverterTool } from './file-format-converter';
import { extractTextFromPdfTool } from './extract-text-from-pdf';
import { extractZipTool } from './extract-zip';
import { validateJsonTool } from './validate-json';
import { regexTestTool } from './regex-test';
import { getCurrentTimeTool } from './get-current-time';
import { codeSearchTool } from './code-search';
import { editFileTool } from './edit-file';
import { shellExecTool } from './shell-exec';
import { gitStatusTool, gitDiffTool, gitLogTool } from './git-tools';

import { createGithubAuthCheckTool } from './github/github_auth_check';
import { createGithubListReposTool } from './github/github_list_repos';
import { createGithubGetRepoTool } from './github/github_get_repo';
import { createGithubGetFileTreeTool } from './github/github_get_file_tree';
import { createGithubReadFileTool } from './github/github_read_file';
import { createGithubReadMultipleFilesTool } from './github/github_read_multiple_files';
import { createGithubUpdateFileTool } from './github/github_update_file';
import { createGithubCreateFileTool } from './github/github_create_file';
import { createGithubDeleteFileTool } from './github/github_delete_file';
import { createGithubSearchCodeTool } from './github/github_search_code';
import { createGithubGetCommitsTool } from './github/github_get_commits';
import { createGithubAnalyzeRepoTool } from './github/github_analyze_repo';

import type { StructuredToolInterface } from '@langchain/core/tools';

/**
 * Re-export individual tools for direct imports.
 */
export { webSearchTool } from './web-search';
export { webScrapeTool } from './web-scrape';
export { readFileTool } from './read-file';
export { writeFileTool } from './write-file';
export { listFilesTool } from './list-files';
export { deleteFileTool } from './delete-file';
export { createZipTool } from './create-zip';
export { runJavascriptTool } from './run-javascript';
export { createGenerateImageTool } from './generate-image';
export { fetchApiTool } from './fetch-api';
export { summarizeTextTool } from './summarize-text';
export { translateTextTool } from './translate-text';
export { extractJsonTool } from './extract-json';
export { mathEvalTool } from './math-eval';
export { generateFileStructureTool } from './generate-file-structure';
export { memorySaveTool } from './memory-save';
export { memoryReadTool } from './memory-read';
export { datetimeInfoTool } from './datetime-info';
export { uuidGenerateTool } from './uuid-generate';
export { formatCodeTool } from './format-code';
export { scholarSearchTool } from './scholar-search';
export { webpageScreenshotTool } from './webpage-screenshot';
export { urlMetadataTool } from './url-metadata';
export { fileFormatConverterTool } from './file-format-converter';
export { extractTextFromPdfTool } from './extract-text-from-pdf';
export { extractZipTool } from './extract-zip';
export { validateJsonTool } from './validate-json';
export { regexTestTool } from './regex-test';
export { getCurrentTimeTool } from './get-current-time';
export { codeSearchTool } from './code-search';
export { editFileTool } from './edit-file';
export { shellExecTool } from './shell-exec';
export { gitStatusTool, gitDiffTool, gitLogTool } from './git-tools';

export { createGithubAuthCheckTool } from './github/github_auth_check';
export { createGithubListReposTool } from './github/github_list_repos';
export { createGithubGetRepoTool } from './github/github_get_repo';
export { createGithubGetFileTreeTool } from './github/github_get_file_tree';
export { createGithubReadFileTool } from './github/github_read_file';
export { createGithubReadMultipleFilesTool } from './github/github_read_multiple_files';
export { createGithubUpdateFileTool } from './github/github_update_file';
export { createGithubCreateFileTool } from './github/github_create_file';
export { createGithubDeleteFileTool } from './github/github_delete_file';
export { createGithubSearchCodeTool } from './github/github_search_code';
export { createGithubGetCommitsTool } from './github/github_get_commits';
export { createGithubAnalyzeRepoTool } from './github/github_analyze_repo';

/**
 * Tool definition for LLM function calling (without implementation).
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Get all tools with optional image API config for generate_image.
 */
export function getAllTools(imageApiConfig?: ImageApiConfig, githubToken?: string): StructuredToolInterface[] {
  const tools: StructuredToolInterface[] = [
    webSearchTool,
    webScrapeTool,
    readFileTool,
    writeFileTool,
    listFilesTool,
    deleteFileTool,
    createZipTool,
    runJavascriptTool,
    createGenerateImageTool(imageApiConfig),
    fetchApiTool,
    summarizeTextTool,
    translateTextTool,
    extractJsonTool,
    mathEvalTool,
    generateFileStructureTool,
    memorySaveTool,
    memoryReadTool,
    datetimeInfoTool,
    uuidGenerateTool,
    formatCodeTool,
    scholarSearchTool,
    webpageScreenshotTool,
    urlMetadataTool,
    fileFormatConverterTool,
    extractTextFromPdfTool,
    extractZipTool,
    validateJsonTool,
    regexTestTool,
    getCurrentTimeTool,
    codeSearchTool,
    editFileTool,
    shellExecTool,
    gitStatusTool,
    gitDiffTool,
    gitLogTool,
  ];

  // Only include GitHub tools when a token is provided
  if (githubToken) {
    tools.push(
      createGithubAuthCheckTool(githubToken),
      createGithubListReposTool(githubToken),
      createGithubGetRepoTool(githubToken),
      createGithubGetFileTreeTool(githubToken),
      createGithubReadFileTool(githubToken),
      createGithubReadMultipleFilesTool(githubToken),
      createGithubUpdateFileTool(githubToken),
      createGithubCreateFileTool(githubToken),
      createGithubDeleteFileTool(githubToken),
      createGithubSearchCodeTool(githubToken),
      createGithubGetCommitsTool(githubToken),
      createGithubAnalyzeRepoTool(githubToken),
    );
  }

  return tools;
}



/**
 * Convert a tool's Zod schema to a JSON Schema object for LLM function calling.
 *
 * Uses Zod v4's native `z.toJSONSchema()`, which preserves field descriptions
 * (`.describe(...)`), nested objects, arrays, enums and defaults — none of which
 * the previous hand-rolled converter handled. Richer schemas mean the model
 * picks the right tool with the right arguments far more often.
 *
 * Falls back gracefully when the schema is already plain JSON Schema, or when
 * conversion throws for an unexpected shape.
 */
function toJsonSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {} };
  }

  // Already a JSON Schema (LangChain accepts plain objects too) — pass through.
  if (!(schema instanceof z.ZodType)) {
    const maybe = schema as Record<string, unknown>;
    if (maybe.type || maybe.properties) return maybe;
    return { type: 'object', properties: {} };
  }

  try {
    // `io: 'input'` makes optional/defaulted fields non-required, matching how
    // an LLM supplies arguments.
    return z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  } catch {
    return { type: 'object', properties: {} };
  }
}

/**
 * Get tool definitions for LLM function calling (no implementation attached).
 * Accepts optional configs for full tool list.
 */
export function getToolDefinitions(imageApiConfig?: ImageApiConfig, githubToken?: string): ToolDefinition[] {
  const tools = getAllTools(imageApiConfig, githubToken);
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: toJsonSchema((tool as unknown as { schema?: unknown }).schema),
  }));
}
