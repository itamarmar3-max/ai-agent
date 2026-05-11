import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as prettier from 'prettier';

/**
 * Map language names to Prettier parser names.
 */
const LANGUAGE_TO_PARSER: Record<string, string> = {
  typescript: 'typescript',
  ts: 'typescript',
  javascript: 'babel',
  js: 'babel',
  jsx: 'babel',
  tsx: 'typescript',
  html: 'html',
  json: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  markdown: 'markdown',
  md: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  graphql: 'graphql',
  gql: 'graphql',
  vue: 'vue',
  angular: 'angular',
  xml: 'xml',
};

/**
 * format_code - Format source code using Prettier.
 */
export const formatCodeTool = tool(
  async ({ code, language }: { code: string; language?: string }): Promise<string> => {
    try {
      if (!code.trim()) {
        return 'Error: No code provided to format.';
      }

      const lang = (language || 'typescript').toLowerCase();
      const parser = LANGUAGE_TO_PARSER[lang];

      if (!parser) {
        return `Error: Unsupported language "${language}". Supported languages: ${Object.keys(LANGUAGE_TO_PARSER).join(', ')}`;
      }

      const options: prettier.Options = {
        parser: parser as unknown as prettier.SupportLanguage,
        semi: true,
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'all',
        printWidth: 80,
        bracketSpacing: true,
        arrowParens: 'always',
        endOfLine: 'lf',
      };

      try {
        const formatted = await prettier.format(code, options);
        return formatted.trimEnd();
      } catch (formatError) {
        const msg = formatError instanceof Error ? formatError.message : String(formatError);
        // If formatting fails, return original code with error info
        return `Prettier could not format this code (possibly syntax errors).\n\nFormatting error: ${msg.slice(0, 300)}\n\nOriginal code:\n${code}`;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error formatting code: ${msg}`;
    }
  },
  {
    name: 'format_code',
    description:
      'Format source code using Prettier. Supports JavaScript, TypeScript, HTML, CSS, JSON, Markdown, YAML, GraphQL, and more.',
    schema: z.object({
      code: z.string().describe('The source code to format'),
      language: z
        .string()
        .optional()
        .default('typescript')
        .describe('Programming language (e.g., "typescript", "javascript", "html", "css", "json", "markdown")'),
    }),
  }
);
