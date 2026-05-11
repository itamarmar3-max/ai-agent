import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_delete_file - Delete a file from a repository.
 */
export function createGithubDeleteFileTool(token: string) {
  return tool(
    async ({
      owner,
      repo,
      path: filePath,
      message,
      sha,
      branch,
    }: {
      owner: string;
      repo: string;
      path: string;
      message: string;
      sha: string;
      branch?: string;
    }): Promise<string> => {
      if (!token) return 'Error: GitHub token not configured. Please add it in Settings > GitHub Integration.';
      try {
        const octokit = new Octokit({ auth: token });

        const { data } = await octokit.rest.repos.deleteFile({
          owner,
          repo,
          path: filePath,
          message,
          sha,
          branch,
        });

        const result = {
          commit: {
            sha: data.commit.sha,
            message: data.commit.message,
          },
          content: {
            path: data.content?.path ?? filePath,
            status: 'deleted' as const,
          },
        };

        return JSON.stringify(result, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error deleting file: ${msg}`;
      }
    },
    {
      name: 'github_delete_file',
      description:
        'Delete a file from a GitHub repository. Requires the file blob SHA and a commit message.',
      schema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        path: z.string().describe('File path to delete'),
        message: z.string().describe('Commit message'),
        sha: z.string().describe('Blob SHA of the file to delete'),
        branch: z.string().optional().describe('Branch name (defaults to repository default branch)'),
      }),
    }
  );
}

export const githubDeleteFileTool = createGithubDeleteFileTool('');
