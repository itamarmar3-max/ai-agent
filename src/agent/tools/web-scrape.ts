import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as cheerio from 'cheerio';

/**
 * web_scrape - Scrape and extract text content from any URL.
 */
export const webScrapeTool = tool(
  async ({ url }: { url: string }): Promise<string> => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return `Failed to fetch URL: HTTP ${response.status} ${response.statusText}`;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove unwanted elements
      $('script, style, nav, footer, header, aside, iframe, noscript, svg, form, button').remove();

      // Get the main content - try common content containers first
      let text = '';
      const mainContent =
        $('article').first().text() ||
        $('main').first().text() ||
        $('[role="main"]').first().text() ||
        $('.content, .post, .entry, #content, #main').first().text() ||
        $('body').text();

      text = mainContent;

      // Clean up whitespace
      text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      // Truncate if too long (max ~50k chars)
      if (text.length > 50000) {
        text = text.slice(0, 50000) + '\n\n... [Content truncated at 50,000 characters]';
      }

      if (!text || text.length < 10) {
        return `Could not extract meaningful text content from ${url}. The page may be dynamically rendered or empty.`;
      }

      return `Content from ${url}:\n\n${text}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error scraping URL: ${msg}`;
    }
  },
  {
    name: 'web_scrape',
    description:
      'Scrape and extract text content from any URL. Returns the full clean text content.',
    schema: z.object({
      url: z.string().url().describe('The URL to scrape'),
    }),
  }
);
