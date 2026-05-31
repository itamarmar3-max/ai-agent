import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import { windowText } from './_output';

/**
 * web_scrape - Scrape and extract text content from any URL.
 */
const BLOCKED_HOSTNAMES = /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1|fc00:|fe80:)/i;

function isPrivateUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    return BLOCKED_HOSTNAMES.test(hostname);
  } catch {
    return true;
  }
}

export const webScrapeTool = tool(
  async ({ url, offset, maxChars }: { url: string; offset?: number; maxChars?: number }): Promise<string> => {
    if (isPrivateUrl(url)) {
      return `Error: Requests to private/internal network addresses are not allowed.`;
    }
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

      if (!text || text.length < 10) {
        return `Could not extract meaningful text content from ${url}. The page may be dynamically rendered or empty.`;
      }

      // Page large pages instead of hard-cutting at a fixed size, so the model
      // can keep reading via `offset` when it needs more.
      const windowed = windowText(text, { offset, maxChars: maxChars ?? 50_000, unit: 'page' });
      return `Content from ${url}:\n\n${windowed}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error scraping URL: ${msg}`;
    }
  },
  {
    name: 'web_scrape',
    description:
      'Fetch a URL and extract its clean, readable text (scripts, nav, ads removed). ' +
      'Use after web_search to read the full content of a specific result. Returns ~50k ' +
      'characters per call; when truncated, call again with the suggested `offset`. ' +
      'Private/internal network addresses are blocked.',
    schema: z.object({
      url: z.string().url().describe('The absolute URL to scrape (must be http/https)'),
      offset: z.number().int().min(0).optional().describe('Character offset to resume from for long pages. Defaults to 0.'),
      maxChars: z.number().int().min(1).optional().describe('Maximum characters to return this call. Defaults to ~50,000.'),
    }),
  }
);
