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
 * Convert a Zod schema to a JSON Schema object for LLM function calling.
 */
function zodSchemaToJsonSchema(schema: unknown): Record<string, unknown> {
  try {
    const s = schema as {
      _def?: {
        shape?: () => Record<string, { _def?: { typeName?: string; innerType?: unknown; values?: unknown[]; optional?: unknown } }> | Record<string, unknown>;
        typeName?: string;
      };
    };

    if (!s?._def) return { type: 'object', properties: {} };

    let shape: Record<string, unknown>;
    if (typeof s._def.shape === 'function') {
      shape = s._def.shape() as Record<string, unknown>;
    } else if (s._def.shape && typeof s._def.shape === 'object') {
      shape = s._def.shape as Record<string, unknown>;
    } else {
      return { type: 'object', properties: {} };
    }

    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldDef = value as {
        _def?: {
          typeName?: string;
          innerType?: { _def?: { typeName?: string; values?: unknown[] } };
          values?: unknown[];
          optional?: boolean;
          description?: string;
        };
        description?: string;
      };

      if (fieldDef?._def) {
        const fieldSchema: Record<string, unknown> = {};

        switch (fieldDef._def.typeName) {
          case 'ZodString':
            fieldSchema.type = 'string';
            break;
          case 'ZodNumber':
            fieldSchema.type = 'number';
            break;
          case 'ZodBoolean':
            fieldSchema.type = 'boolean';
            break;
          case 'ZodArray':
            fieldSchema.type = 'array';
            if (fieldDef._def.innerType?._def) {
              const innerType = fieldDef._def.innerType._def;
              if (innerType.typeName === 'ZodString') fieldSchema.items = { type: 'string' };
              else if (innerType.typeName === 'ZodNumber') fieldSchema.items = { type: 'number' };
              else if (innerType.typeName === 'ZodObject') fieldSchema.items = zodSchemaToJsonSchema(fieldDef._def.innerType);
            }
            break;
          case 'ZodOptional':
            // For optional fields, unwrap inner type
            if (fieldDef._def.innerType?._def) {
              const inner = fieldDef._def.innerType._def;
              switch (inner.typeName) {
                case 'ZodString': fieldSchema.type = 'string'; break;
                case 'ZodNumber': fieldSchema.type = 'number'; break;
                case 'ZodBoolean': fieldSchema.type = 'boolean'; break;
                default: fieldSchema.type = 'string';
              }
            } else {
              fieldSchema.type = 'string';
            }
            break;
          case 'ZodDefault':
            if (fieldDef._def.innerType?._def) {
              const inner = fieldDef._def.innerType._def;
              switch (inner.typeName) {
                case 'ZodString': fieldSchema.type = 'string'; break;
                case 'ZodNumber': fieldSchema.type = 'number'; break;
                case 'ZodBoolean': fieldSchema.type = 'boolean'; break;
                default: fieldSchema.type = 'string';
              }
            } else {
              fieldSchema.type = 'string';
            }
            break;
          case 'ZodEnum':
            fieldSchema.type = 'string';
            if (fieldDef._def.values) {
              fieldSchema.enum = fieldDef._def.values;
            }
            break;
          default:
            fieldSchema.type = 'string';
        }

        properties[key] = fieldSchema;

        if (!fieldDef._def.optional && fieldDef._def.typeName !== 'ZodOptional' && fieldDef._def.typeName !== 'ZodDefault') {
          required.push(key);
        }
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
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
    parameters: (tool as unknown as { schema?: { _def?: { shape?: Record<string, unknown> } } }).schema
      ? zodSchemaToJsonSchema((tool as unknown as { schema?: unknown }).schema)
      : {},
  }));
}
