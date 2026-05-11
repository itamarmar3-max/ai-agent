import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as cheerio from 'cheerio';

/**
 * web_search - Search the internet for information.
 * Uses a fetch-based approach with DuckDuckGo's lite HTML version.
 */
export const webSearchTool = tool(
  async ({ query }: { query: string }): Promise<string> => {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        return `Search request failed with status ${response.status}. Please try again.`;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const results: string[] = [];
      let count = 0;

      // DuckDuckGo lite results are in table rows
      $('td.result-link a').each((_i, el) => {
        if (count >= 10) return false;
        const link = $(el).attr('href');
        const title = $(el).text().trim();
        if (link && title) {
          results.push(`[${count + 1}] ${title}\n    ${link}`);
          count++;
        }
      });

      // Also get snippets
      const snippets: string[] = [];
      $('td.result-snippet').each((_i, el) => {
        snippets.push($(el).text().trim());
      });

      let output = '';
      for (let i = 0; i < results.length; i++) {
        output += results[i] + '\n';
        if (snippets[i]) {
          output += `    ${snippets[i]}\n`;
        }
        output += '\n';
      }

      if (results.length === 0) {
        return `No search results found for "${query}". Try rephrasing your query.`;
      }

      return `Search results for "${query}":\n\n${output.trim()}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error performing web search: ${msg}`;
    }
  },
  {
    name: 'web_search',
    description:
      'Search the internet for information. Returns top results with title, url, and snippet.',
    schema: z.object({
      query: z.string().describe('The search query string'),
    }),
  }
);
