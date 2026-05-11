import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_update_file - Update or create a file in a repository (commit changes).
 */
export function createGithubUpdateFileTool(token: string) {
  return tool(
    async ({
      owner,
      repo,
      path: filePath,
      content,
      message,
      sha,
      branch,
    }: {
      owner: string;
      repo: string;
      path: string;
      content: string;
      message: string;
      sha?: string;
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
          sha,
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
        return `Error updating file: ${msg}`;
      }
    },
    {
      name: 'github_update_file',
      description:
        'Update or create a file in a GitHub repository. Creates a commit with the changes. Provide sha for updates, omit for new files.',
      schema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        path: z.string().describe('File path within the repository'),
        content: z.string().describe('New file content'),
        message: z.string().describe('Commit message'),
        sha: z.string().optional().describe('Blob SHA of the file being updated (required for existing files)'),
        branch: z.string().optional().describe('Branch name (defaults to repository default branch)'),
      }),
    }
  );
}

export const githubUpdateFileTool = createGithubUpdateFileTool('');
