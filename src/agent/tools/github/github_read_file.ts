import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_read_file - Read the content of a single file from a repository.
 */
export function createGithubReadFileTool(token: string) {
  return tool(
    async ({
      owner,
      repo,
      path: filePath,
      ref,
    }: {
      owner: string;
      repo: string;
      path: string;
      ref?: string;
    }): Promise<string> => {
      if (!token) return 'Error: GitHub token not configured. Please add it in Settings > GitHub Integration.';
      try {
        const octokit = new Octokit({ auth: token });

        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
          ref,
        });

        if (Array.isArray(data)) {
          return `Error: Path "${filePath}" is a directory, not a file. Use github_get_file_tree instead.`;
        }

        if (data.type === 'symlink') {
          return `Error: Path "${filePath}" is a symlink.`;
        }

        if (data.type !== 'file') {
          return `Error: Path "${filePath}" is not a file (type: ${data.type}).`;
        }

        if (!data.content) {
          return `Error: File "${filePath}" has no content (possibly too large or binary).`;
        }

        // Decode base64 content
        const content = Buffer.from(data.content, 'base64').toString('utf-8');

        const result = {
          path: data.path,
          content,
          sha: data.sha,
          size: data.size,
          encoding: data.encoding,
        };

        return JSON.stringify(result, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error reading file: ${msg}`;
      }
    },
    {
      name: 'github_read_file',
      description:
        'Read the content of a single file from a GitHub repository. Returns decoded file content and metadata.',
      schema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        path: z.string().describe('File path within the repository'),
        ref: z.string().optional().describe('Git reference (branch, tag, or SHA)'),
      }),
    }
  );
}

export const githubReadFileTool = createGithubReadFileTool('');
