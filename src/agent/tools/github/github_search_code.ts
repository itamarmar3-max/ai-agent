import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_search_code - Search for code across GitHub repositories.
 */
export function createGithubSearchCodeTool(token: string) {
  return tool(
    async ({
      q,
      per_page,
      page,
      sort,
      order,
    }: {
      q: string;
      per_page?: number;
      page?: number;
      sort?: string;
      order?: string;
    }): Promise<string> => {
      if (!token) return 'Error: GitHub token not configured. Please add it in Settings > GitHub Integration.';
      try {
        const octokit = new Octokit({ auth: token });

        const { data } = await octokit.rest.search.code({
          q,
          per_page: per_page || 30,
          page: page || 1,
          sort: (sort as any) || undefined,
          order: (order as any) || undefined,
        });

        const result = {
          total_count: data.total_count,
          items: data.items.map((item) => ({
            name: item.name,
            path: item.path,
            html_url: item.html_url,
            repository: {
              full_name: item.repository.full_name,
            },
            score: item.score,
          })),
        };

        return JSON.stringify(result, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error searching code: ${msg}`;
      }
    },
    {
      name: 'github_search_code',
      description:
        'Search for code across GitHub repositories. Supports GitHub code search syntax (e.g., "language:typescript function_name").',
      schema: z.object({
        q: z.string().describe('Search query using GitHub code search syntax'),
        per_page: z.number().optional().describe('Results per page (max 100, default 30)'),
        page: z.number().optional().describe('Page number'),
        sort: z.string().optional().describe('Sort field: indexed'),
        order: z.string().optional().describe('Sort order: asc or desc'),
      }),
    }
  );
}

export const githubSearchCodeTool = createGithubSearchCodeTool('');
