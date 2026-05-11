import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Validate and pretty-print JSON content.
 * Attempts multiple parsing strategies to handle messy input.
 */
export const validateJsonTool = tool(
  async ({ content }: { content: string }): Promise<string> => {
    try {
      if (!content || content.trim().length === 0) {
        return 'Error: No content provided for JSON validation.';
      }

      const trimmed = content.trim();

      // Strategy 1: Direct parse
      let parsed: unknown;
      let parseSuccess = false;
      let usedStrategy = '';

      try {
        parsed = JSON.parse(trimmed);
        parseSuccess = true;
        usedStrategy = 'Standard JSON.parse';
      } catch {
        // Strategy 2: Extract JSON from markdown code blocks
        const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
          try {
            parsed = JSON.parse(codeBlockMatch[1].trim());
            parseSuccess = true;
            usedStrategy = 'Extracted from code block';
          } catch {
            // fall through
          }
        }
      }

      if (!parseSuccess) {
        // Strategy 3: Find first { or [ and try from there
        const startBrace = trimmed.indexOf('{');
        const startBracket = trimmed.indexOf('[');
        let startIndex = -1;

        if (startBrace !== -1 && startBracket !== -1) {
          startIndex = Math.min(startBrace, startBracket);
        } else if (startBrace !== -1) {
          startIndex = startBrace;
        } else if (startBracket !== -1) {
          startIndex = startBracket;
        }

        if (startIndex !== -1) {
          try {
            parsed = JSON.parse(trimmed.slice(startIndex));
            parseSuccess = true;
            usedStrategy = `Extracted from position ${startIndex}`;
          } catch {
            // fall through
          }
        }
      }

      if (!parseSuccess) {
        // Strategy 4: Try fixing common issues
        const fixed = trimmed
          .replace(/'/g, '"')                     // single quotes → double quotes
          .replace(/(\w+)\s*:/g, '"$1":')         // unquoted keys
          .replace(/,\s*([}\]])/g, '$1')          // trailing commas
          .replace(/\\'/g, "'")                   // escaped single quotes
          .replace(/,\s*}/g, '}')                // trailing comma before }
          .replace(/,\s*]/g, ']');               // trailing comma before ]

        try {
          parsed = JSON.parse(fixed);
          parseSuccess = true;
          usedStrategy = 'Fixed common JSON issues';
        } catch {
          // All strategies failed
        }
      }

      if (!parseSuccess) {
        // Provide helpful error info
        let errorMsg = 'Could not parse the input as valid JSON.';
        try {
          JSON.parse(trimmed);
        } catch (parseError) {
          const err = parseError as Error;
          errorMsg = `Invalid JSON: ${err.message}`;

          // Try to locate the error
          const posMatch = err.message.match(/position\s+(\d+)/i);
          if (posMatch) {
            const pos = parseInt(posMatch[1], 10);
            const lines = trimmed.slice(0, pos).split('\n');
            const lineNum = lines.length;
            const colNum = lines[lines.length - 1].length + 1;
            errorMsg += `\nError location: line ${lineNum}, column ${colNum}`;
          }
        }

        return (
          `JSON Validation Result: INVALID\n` +
          `===========================\n` +
          `\n` +
          `${errorMsg}\n` +
          `\n` +
          `Input length: ${trimmed.length} characters\n` +
          `Starts with: ${trimmed.slice(0, 50).replace(/\n/g, '\\n')}\n` +
          `\n` +
          `Tips for fixing:\n` +
          `- Ensure all keys and string values use double quotes\n` +
          `- Remove trailing commas before } or ]\n` +
          `- Ensure all brackets and braces are properly closed\n` +
          `- Check for unescaped special characters in strings`
        );
      }

      // Successfully parsed
      const prettyPrinted = JSON.stringify(parsed, null, 2);

      // Analyze the structure
      const structure = analyzeStructure(parsed);

      return (
        `JSON Validation Result: VALID\n` +
        `==========================\n` +
        `\n` +
        `Parsing method: ${usedStrategy}\n` +
        `Structure: ${structure}\n` +
        `Formatted size: ${prettyPrinted.length} characters\n` +
        `\n` +
        `--- Pretty-Printed JSON ---\n` +
        `\n` +
        prettyPrinted
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error validating JSON: ${msg}`;
    }
  },
  {
    name: 'validate_json',
    description:
      'Validate and pretty-print JSON content. Attempts multiple parsing strategies including extracting JSON from code blocks, fixing common issues like trailing commas and unquoted keys. Returns the validated, formatted JSON or a detailed error message with fix suggestions.',
    schema: z.object({
      content: z.string().describe('The JSON content string to validate'),
    }),
  }
);

function analyzeStructure(data: unknown, depth = 0): string {
  if (data === null) return 'null';
  if (typeof data === 'string') return `string (${data.length} chars)`;
  if (typeof data === 'number') return `number (${data})`;
  if (typeof data === 'boolean') return `boolean`;
  if (Array.isArray(data)) {
    if (depth > 2) return `array[${data.length}]`;
    if (data.length === 0) return 'empty array';
    const itemType = analyzeStructure(data[0], depth + 1);
    return `array of ${data.length} ${itemType}(s)`;
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (depth > 1) return `object {${keys.length} keys}`;
    if (keys.length === 0) return 'empty object';
    const sample = keys.slice(0, 5).join(', ');
    const suffix = keys.length > 5 ? `, ... (${keys.length} total)` : '';
    return `object {${sample}${suffix}}`;
  }
  return typeof data;
}
