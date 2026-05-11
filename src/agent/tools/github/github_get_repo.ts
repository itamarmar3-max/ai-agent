import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_get_repo - Get detailed information about a specific repository.
 */
export function createGithubGetRepoTool(token: string) {
  return tool(
    async ({
      owner,
      repo,
    }: {
      owner: string;
      repo: string;
    }): Promise<string> => {
      if (!token) return 'Error: GitHub token not configured. Please add it in Settings > GitHub Integration.';
      try {
        const octokit = new Octokit({ auth: token });

        const { data } = await octokit.rest.repos.get({
          owner,
          repo,
        });

        const result = {
          name: data.name,
          full_name: data.full_name,
          description: data.description,
          html_url: data.html_url,
          language: data.language,
          stargazers_count: data.stargazers_count,
          forks_count: data.forks_count,
          open_issues_count: data.open_issues_count,
          default_branch: data.default_branch,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        return JSON.stringify(result, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error getting repository: ${msg}`;
      }
    },
    {
      name: 'github_get_repo',
      description:
        'Get detailed information about a specific GitHub repository including stars, forks, issues, and metadata.',
      schema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
      }),
    }
  );
}

export const githubGetRepoTool = createGithubGetRepoTool('');
