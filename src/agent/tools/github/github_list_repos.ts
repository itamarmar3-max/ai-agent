import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_list_repos - List repositories for the authenticated user or a specific owner.
 */
export function createGithubListReposTool(token: string) {
  return tool(
    async ({
      owner,
      sort,
      per_page,
      page,
    }: {
      owner?: string;
      sort?: string;
      per_page?: number;
      page?: number;
    }): Promise<string> => {
      if (!token) return 'Error: GitHub token not configured. Please add it in Settings > GitHub Integration.';
      try {
        const octokit = new Octokit({ auth: token });

        let repos: Array<{
          name: string;
          full_name: string;
          description: string | null;
          html_url: string;
          language: string | null;
          stargazers_count: number;
          fork: boolean;
        }>;

        if (owner) {
          const { data } = await octokit.rest.repos.listForOrg({
            org: owner,
            sort: (sort as any) || 'updated',
            per_page: per_page || 30,
            page: page || 1,
          });
          repos = data as any;
        } else {
          const { data } = await octokit.rest.repos.listForAuthenticatedUser({
            sort: (sort as any) || 'updated',
            per_page: per_page || 30,
            page: page || 1,
          });
          repos = data as any;
        }

        const result = repos.map((repo) => ({
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          fork: repo.fork,
        }));

        return JSON.stringify(result, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error listing repositories: ${msg}`;
      }
    },
    {
      name: 'github_list_repos',
      description:
        'List repositories for the authenticated user or a specific owner/org. Returns repo names, descriptions, languages, and star counts.',
      schema: z.object({
        owner: z.string().optional().describe('Owner or org name (omit for authenticated user)'),
        sort: z.string().optional().describe('Sort field: created, updated, pushed, full_name'),
        per_page: z.number().optional().describe('Results per page (max 100, default 30)'),
        page: z.number().optional().describe('Page number'),
      }),
    }
  );
}

export const githubListReposTool = createGithubListReposTool('');
