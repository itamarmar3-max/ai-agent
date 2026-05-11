import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_get_commits - Get commit history for a repository.
 */
export function createGithubGetCommitsTool(token: string) {
  return tool(
    async ({
      owner,
      repo,
      per_page,
      page,
      sha,
    }: {
      owner: string;
      repo: string;
      per_page?: number;
      page?: number;
      sha?: string;
    }): Promise<string> => {
      if (!token) return 'Error: GitHub token not configured. Please add it in Settings > GitHub Integration.';
      try {
        const octokit = new Octokit({ auth: token });

        const { data } = await octokit.rest.repos.listCommits({
          owner,
          repo,
          per_page: per_page || 30,
          page: page || 1,
          sha,
        });

        const result = data.map((commit) => ({
          sha: commit.sha,
          message: commit.commit.message,
          author: {
            name: commit.commit.author?.name,
            date: commit.commit.author?.date,
          },
          html_url: commit.html_url,
        }));

        return JSON.stringify(result, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error getting commits: ${msg}`;
      }
    },
    {
      name: 'github_get_commits',
      description:
        'Get commit history for a GitHub repository. Returns commit SHAs, messages, authors, and dates.',
      schema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        per_page: z.number().optional().describe('Results per page (max 100, default 30)'),
        page: z.number().optional().describe('Page number'),
        sha: z.string().optional().describe('Branch or SHA to start from'),
      }),
    }
  );
}

export const githubGetCommitsTool = createGithubGetCommitsTool('');
