import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_get_file_tree - Get the file tree of a repository at a given path.
 */
export function createGithubGetFileTreeTool(token: string) {
  return tool(
    async ({
      owner,
      repo,
      path: treePath,
      ref,
    }: {
      owner: string;
      repo: string;
      path?: string;
      ref?: string;
    }): Promise<string> => {
      if (!token) return 'Error: GitHub token not configured. Please add it in Settings > GitHub Integration.';
      try {
        const octokit = new Octokit({ auth: token });

        // Get the tree SHA for the given ref
        let treeSha: string;
        if (ref) {
          const { data: refData } = await octokit.rest.git.getRef({
            owner,
            repo,
            ref,
          });
          treeSha = refData.object.sha;
        } else {
          const { data: refData } = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: 'heads/main',
          }).catch(async () => {
            const fallback = await octokit.rest.git.getRef({
              owner,
              repo,
              ref: 'heads/master',
            });
            return fallback;
          });
          treeSha = refData.object.sha;
        }

        const { data } = await octokit.rest.git.getTree({
          owner,
          repo,
          tree_sha: treeSha,
          recursive: 'true',
        });

        let tree = data.tree;

        // Filter by path if provided
        if (treePath) {
          tree = tree.filter((item) => item.path.startsWith(treePath));
        }

        const result = tree.map((item) => ({
          path: item.path,
          mode: item.mode,
          type: item.type,
          size: item.size || 0,
          sha: item.sha,
        }));

        return JSON.stringify(result, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error getting file tree: ${msg}`;
      }
    },
    {
      name: 'github_get_file_tree',
      description:
        'Get the file tree of a repository. Returns paths, types (blob/tree), sizes, and SHAs for all files.',
      schema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        path: z.string().optional().describe('Optional sub-path to filter results'),
        ref: z.string().optional().describe('Git reference (branch, tag, or SHA)'),
      }),
    }
  );
}

export const githubGetFileTreeTool = createGithubGetFileTreeTool('');
