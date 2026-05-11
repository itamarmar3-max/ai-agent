import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Search academic papers using the Semantic Scholar API.
 * Free, no API key required.
 */
export const scholarSearchTool = tool(
  async ({ query, limit }: { query: string; limit?: number }): Promise<string> => {
    try {
      const maxResults = Math.min(limit || 5, 20);
      const params = new URLSearchParams({
        query: query.trim(),
        limit: String(maxResults),
        fields: 'title,authors,year,abstract,url,externalIds,citationCount',
      });

      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return `Error: Semantic Scholar API returned HTTP ${response.status}. ${errorText}`;
      }

      const data = await response.json() as {
        total?: number;
        offset?: number;
        data?: Array<{
          paperId?: string;
          title?: string;
          abstract?: string;
          year?: number;
          citationCount?: number;
          url?: string;
          authors?: Array<{ name?: string }>;
          externalIds?: { DOI?: string; ArXiv?: string };
        }>;
      };

      if (!data.data || data.data.length === 0) {
        return `No academic papers found for "${query}". Try different keywords or a broader search query.`;
      }

      const results = data.data.map((paper, idx) => {
        const authors = paper.authors
          ?.map((a) => a.name)
          .filter(Boolean)
          .slice(0, 5)
          .join(', ') || 'Unknown authors';
        const moreAuthors = paper.authors && paper.authors.length > 5
          ? ` et al. (${paper.authors.length} authors total)`
          : '';

        const identifiers: string[] = [];
        if (paper.externalIds?.DOI) identifiers.push(`DOI: ${paper.externalIds.DOI}`);
        if (paper.externalIds?.ArXiv) identifiers.push(`ArXiv: ${paper.externalIds.ArXiv}`);

        const abstract = paper.abstract
          ? (paper.abstract.length > 300 ? paper.abstract.slice(0, 300) + '...' : paper.abstract)
          : 'No abstract available.';

        return [
          `[${idx + 1}] ${paper.title || 'Untitled'}`,
          `    Authors: ${authors}${moreAuthors}`,
          `    Year: ${paper.year || 'N/A'} | Citations: ${paper.citationCount ?? 'N/A'}`,
          `    Abstract: ${abstract}`,
          `    URL: ${paper.url || 'N/A'}`,
          ...(identifiers.length > 0 ? [`    IDs: ${identifiers.join(' | ')}`] : []),
        ].join('\n');
      });

      return [
        `Found ${data.total ?? data.data.length} papers for "${query}". Showing top ${data.data.length} results:`,
        '',
        ...results,
      ].join('\n');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error searching academic papers: ${msg}`;
    }
  },
  {
    name: 'scholar_search',
    description:
      'Search academic papers and scholarly articles using Semantic Scholar. Returns titles, authors, publication year, abstracts, and URLs. No API key required. Great for literature reviews, finding research papers, and exploring academic topics.',
    schema: z.object({
      query: z.string().describe('The search query for academic papers'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(5)
        .describe('Maximum number of results to return (1-20)'),
    }),
  }
);
