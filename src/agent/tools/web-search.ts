import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as cheerio from 'cheerio';

/**
 * web_search — Search the internet for current information.
 *
 * Resolution order (first configured provider wins):
 *   1. Tavily      — env TAVILY_API_KEY      (purpose-built for agents)
 *   2. Brave       — env BRAVE_SEARCH_API_KEY
 *   3. SerpAPI     — env SERPAPI_API_KEY
 *   4. DuckDuckGo  — HTML scrape, no key, last-resort fallback
 *
 * API-based providers are far more reliable than scraping (which breaks the
 * moment the target site changes its markup or rate-limits us), so the agent
 * gets real results whenever a key is present, and still degrades gracefully
 * to the scraper when none is configured.
 */

const MAX_RESULTS = 10;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function formatResults(query: string, results: SearchResult[], provider: string): string {
  if (results.length === 0) {
    return `No search results found for "${query}". Try rephrasing your query.`;
  }
  const body = results
    .slice(0, MAX_RESULTS)
    .map((r, i) => {
      const lines = [`[${i + 1}] ${r.title}`, `    ${r.url}`];
      if (r.snippet) lines.push(`    ${r.snippet}`);
      return lines.join('\n');
    })
    .join('\n\n');
  return `Search results for "${query}" (via ${provider}):\n\n${body}`;
}

async function searchTavily(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: MAX_RESULTS,
      search_depth: 'basic',
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Tavily returned ${response.status}`);
  const data = (await response.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? r.url ?? 'Untitled',
    url: r.url ?? '',
    snippet: (r.content ?? '').slice(0, 300),
  }));
}

async function searchBrave(query: string, apiKey: string): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Brave returned ${response.status}`);
  const data = (await response.json()) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } };
  return (data.web?.results ?? []).map((r) => ({
    title: r.title ?? r.url ?? 'Untitled',
    url: r.url ?? '',
    snippet: (r.description ?? '').replace(/<[^>]+>/g, '').slice(0, 300),
  }));
}

async function searchSerpApi(query: string, apiKey: string): Promise<SearchResult[]> {
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=${MAX_RESULTS}&api_key=${apiKey}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`SerpAPI returned ${response.status}`);
  const data = (await response.json()) as { organic_results?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (data.organic_results ?? []).map((r) => ({
    title: r.title ?? r.link ?? 'Untitled',
    url: r.link ?? '',
    snippet: (r.snippet ?? '').slice(0, 300),
  }));
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`DuckDuckGo returned ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);

  const links: { title: string; url: string }[] = [];
  $('td.result-link a').each((_i, el) => {
    if (links.length >= MAX_RESULTS) return false;
    const link = $(el).attr('href');
    const title = $(el).text().trim();
    if (link && title) links.push({ title, url: link });
  });

  const snippets: string[] = [];
  $('td.result-snippet').each((_i, el) => {
    snippets.push($(el).text().trim());
  });

  return links.map((l, i) => ({ title: l.title, url: l.url, snippet: snippets[i] ?? '' }));
}

export const webSearchTool = tool(
  async ({ query }: { query: string }): Promise<string> => {
    const tavily = process.env.TAVILY_API_KEY;
    const brave = process.env.BRAVE_SEARCH_API_KEY;
    const serp = process.env.SERPAPI_API_KEY;

    // Try the configured API provider first, then always fall back to the
    // DuckDuckGo scraper so the tool keeps working even if the API key is
    // missing, exhausted, or the provider is temporarily down.
    const attempts: Array<{ name: string; run: () => Promise<SearchResult[]> }> = [];
    if (tavily) attempts.push({ name: 'Tavily', run: () => searchTavily(query, tavily) });
    if (brave) attempts.push({ name: 'Brave', run: () => searchBrave(query, brave) });
    if (serp) attempts.push({ name: 'SerpAPI', run: () => searchSerpApi(query, serp) });
    attempts.push({ name: 'DuckDuckGo', run: () => searchDuckDuckGo(query) });

    const errors: string[] = [];
    for (const attempt of attempts) {
      try {
        const results = await attempt.run();
        if (results.length > 0) return formatResults(query, results, attempt.name);
        errors.push(`${attempt.name}: no results`);
      } catch (error) {
        errors.push(`${attempt.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return `No search results for "${query}". Providers tried — ${errors.join('; ')}. Try rephrasing the query.`;
  },
  {
    name: 'web_search',
    description:
      'Search the public internet for current, factual, or time-sensitive information. ' +
      'Use this when the answer depends on recent events, external facts, documentation, ' +
      'or anything outside your training data. Returns up to 10 ranked results, each with a ' +
      'title, URL, and snippet. Prefer several focused queries over one broad query. ' +
      'For the full text of a specific page, follow up with web_scrape on the chosen URL.',
    schema: z.object({
      query: z.string().describe('A focused, keyword-rich search query (e.g. "Next.js 16 app router caching changes")'),
    }),
  }
);
