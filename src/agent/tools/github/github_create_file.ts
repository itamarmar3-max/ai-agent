import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_create_file - Create a new file in a repository.
 */
export function createGithubCreateFileTool(token: string) {
  return tool(
    async ({
      owner,
      repo,
      path: filePath,
      content,
      message,
      branch,
    }: {
      owner: string;
      repo: string;
      path: string;
      content: string;
      message: string;
      branch?: string;
    }): Promise<string> => {
      if (!token) return 'Error: GitHub token not configured. Please add it in Settings > GitHub Integration.';
      try {
        const octokit = new Octokit({ auth: token });

        const { data } = await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: filePath,
          message,
          content: Buffer.from(content, 'utf-8').toString('base64'),
          branch,
        });

        const result = {
          commit: {
            sha: data.commit.sha,
            message: data.commit.message,
            html_url: data.commit.html_url,
          },
          content: {
            path: data.content?.path ?? filePath,
            sha: data.content?.sha ?? '',
          },
        };

        return JSON.stringify(result, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error creating file: ${msg}`;
      }
    },
    {
      name: 'github_create_file',
      description:
        'Create a new file in a GitHub repository. Do not provide sha - this is for creating new files only. For updates use github_update_file.',
      schema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        path: z.string().describe('File path within the repository'),
        content: z.string().describe('File content to create'),
        message: z.string().describe('Commit message'),
        branch: z.string().optional().describe('Branch name (defaults to repository default branch)'),
      }),
    }
  );
}

export const githubCreateFileTool = createGithubCreateFileTool('');
