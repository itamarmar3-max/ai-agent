import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_read_multiple_files - Read multiple files from a repository at once.
 */
export function createGithubReadMultipleFilesTool(token: string) {
  return tool(
    async ({
      owner,
      repo,
      paths,
      ref,
    }: {
      owner: string;
      repo: string;
      paths: string[];
      ref?: string;
    }): Promise<string> => {
      if (!token) return 'Error: GitHub token not configured. Please add it in Settings > GitHub Integration.';
      try {
        const octokit = new Octokit({ auth: token });

        const results = await Promise.all(
          paths.map(async (filePath) => {
            try {
              const { data } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
                ref,
              });

              if (Array.isArray(data)) {
                return { path: filePath, error: 'Path is a directory, not a file', content: null, sha: null, size: null };
              }

              if (data.type !== 'file') {
                return { path: filePath, error: `Path is not a file (type: ${data.type})`, content: null, sha: null, size: null };
              }

              if (!data.content) {
                return { path: filePath, error: 'File has no content (possibly binary or too large)', content: null, sha: data.sha, size: data.size };
              }

              // Check if the file is likely binary (if decoding produces replacement characters)
              const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
              const isBinary = /[\x00-\x08\x0E-\x1F]/.test(decoded) || decoded.includes('\ufffd');

              if (isBinary) {
                return { path: filePath, error: 'Binary file - content skipped', content: null, sha: data.sha, size: data.size };
              }

              return {
                path: data.path,
                content: decoded,
                sha: data.sha,
                size: data.size,
              };
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              return { path: filePath, error: msg, content: null, sha: null, size: null };
            }
          })
        );

        return JSON.stringify(results, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error reading multiple files: ${msg}`;
      }
    },
    {
      name: 'github_read_multiple_files',
      description:
        'Read multiple files from a GitHub repository at once. Binary files are skipped with a note. Returns array of file contents.',
      schema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        paths: z.array(z.string()).describe('Array of file paths to read'),
        ref: z.string().optional().describe('Git reference (branch, tag, or SHA)'),
      }),
    }
  );
}

export const githubReadMultipleFilesTool = createGithubReadMultipleFilesTool('');
