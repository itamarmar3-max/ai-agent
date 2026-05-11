import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * fetch_api - Make HTTP GET or POST requests to any external API URL.
 */
export const fetchApiTool = tool(
  async ({
    url,
    method,
    headers,
    body,
  }: {
    url: string;
    method?: string;
    headers?: string;
    body?: string;
  }): Promise<string> => {
    try {
      const reqMethod = (method || 'GET').toUpperCase();
      const parsedHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (compatible; AI-Agent/1.0)',
      };

      if (headers) {
        try {
          const parsed = JSON.parse(headers);
          Object.assign(parsedHeaders, parsed);
        } catch {
          return `Error: Invalid headers JSON format. Headers must be a valid JSON string.`;
        }
      }

      const fetchOptions: RequestInit = {
        method: reqMethod,
        headers: parsedHeaders,
        signal: AbortSignal.timeout(30000),
      };

      if (body && reqMethod !== 'GET') {
        fetchOptions.body = body;
      }

      const startTime = Date.now();
      const response = await fetch(url, fetchOptions);
      const elapsed = Date.now() - startTime;

      const contentType = response.headers.get('content-type') || '';
      let responseBody: string;

      if (contentType.includes('application/json')) {
        const json = await response.json();
        responseBody = JSON.stringify(json, null, 2);
      } else {
        responseBody = await response.text();
        // Truncate long text responses
        if (responseBody.length > 10000) {
          responseBody = responseBody.slice(0, 10000) + '\n\n... [Response truncated at 10,000 characters]';
        }
      }

      const statusText = response.statusText || '';
      return `HTTP ${response.status} ${statusText} (${elapsed}ms)\n\n${responseBody}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error making API request: ${msg}`;
    }
  },
  {
    name: 'fetch_api',
    description:
      'Make HTTP GET or POST requests to any external API URL. Returns the response data.',
    schema: z.object({
      url: z.string().describe('The API URL to request'),
      method: z
        .string()
        .optional()
        .default('GET')
        .describe('HTTP method (GET, POST, PUT, DELETE, etc.)'),
      headers: z
        .string()
        .optional()
        .describe('JSON string of HTTP headers to include'),
      body: z.string().optional().describe('Request body (for POST/PUT requests)'),
    }),
  }
);
