import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * extract_json - Extract and parse structured JSON data from unstructured text.
 */
export const extractJsonTool = tool(
  async ({ text }: { text: string }): Promise<string> => {
    try {
      if (!text.trim()) {
        return 'Error: No text provided.';
      }

      // Strategy 1: Try to find JSON within code blocks (```json ... ```)
      const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      if (codeBlockMatch) {
        try {
          const parsed = JSON.parse(codeBlockMatch[1].trim());
          return JSON.stringify(parsed, null, 2);
        } catch {
          // Continue to next strategy
        }
      }

      // Strategy 2: Find JSON objects { ... } or arrays [ ... ]
      const jsonPatterns = [
        // Match JSON objects
        /\{[\s\S]*\}/g,
        // Match JSON arrays
        /\[[\s\S]*\]/g,
      ];

      const foundJsons: unknown[] = [];

      for (const pattern of jsonPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const candidate = match[0];
          // Try to find the largest valid JSON substring
          try {
            // Attempt to parse increasing substrings to find valid JSON
            for (let end = candidate.length; end >= 1; end--) {
              try {
                const parsed = JSON.parse(candidate.slice(0, end));
                // Validate it's an object or array (not just a string or number)
                if (typeof parsed === 'object' && parsed !== null) {
                  // Avoid duplicates
                  const serialized = JSON.stringify(parsed);
                  if (!foundJsons.some((j) => JSON.stringify(j) === serialized)) {
                    foundJsons.push(parsed);
                  }
                }
                break;
              } catch {
                continue;
              }
            }
          } catch {
            continue;
          }
        }
      }

      // Strategy 3: Look for key-value patterns and build JSON
      if (foundJsons.length === 0) {
        const kvPattern = /"?([^"=\n]+)"?\s*[:=]\s*"?([^"\n]+)"?/g;
        const kvData: Record<string, string> = {};
        let kvCount = 0;
        let kvMatch;

        while ((kvMatch = kvPattern.exec(text)) !== null) {
          const key = kvMatch[1].trim();
          const value = kvMatch[2].trim();
          if (key.length > 0 && value.length > 0 && kvCount < 50) {
            kvData[key] = value;
            kvCount++;
          }
        }

        if (Object.keys(kvData).length > 0) {
          return JSON.stringify(kvData, null, 2);
        }
      }

      if (foundJsons.length === 0) {
        return 'No valid JSON data found in the provided text. The text does not contain recognizable JSON objects or arrays.';
      }

      // Return the first (likely most significant) JSON found
      if (foundJsons.length === 1) {
        return JSON.stringify(foundJsons[0], null, 2);
      }

      // Return all found JSON objects
      return `Found ${foundJsons.length} JSON structure(s):\n\n${foundJsons
        .map((j, i) => `--- JSON #${i + 1} ---\n${JSON.stringify(j, null, 2)}`)
        .join('\n\n')}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error extracting JSON: ${msg}`;
    }
  },
  {
    name: 'extract_json',
    description:
      'Extract and parse structured JSON data from messy or unstructured text. Finds JSON objects and arrays embedded in text.',
    schema: z.object({
      text: z.string().describe('The text containing JSON data to extract'),
    }),
  }
);
