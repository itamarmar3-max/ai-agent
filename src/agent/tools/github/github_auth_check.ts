import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_auth_check - Check if a GitHub token is valid by fetching the authenticated user.
 */
export function createGithubAuthCheckTool(token: string) {
  return tool(
    async (): Promise<string> => {
      if (!token) return 'Error: GitHub token not configured. Please add it in Settings > GitHub Integration.';
      try {
        const octokit = new Octokit({ auth: token });

        const { data } = await octokit.rest.users.getAuthenticated();

        const result = {
          login: data.login,
          id: data.id,
          name: data.name,
          avatar_url: data.avatar_url,
          public_repos: data.public_repos,
          type: data.type,
        };

        return JSON.stringify(result, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error checking GitHub authentication: ${msg}`;
      }
    },
    {
      name: 'github_auth_check',
      description:
        'Check if a GitHub token is valid by fetching the authenticated user. Returns user info if valid.',
      schema: z.object({}),
    }
  );
}

export const githubAuthCheckTool = createGithubAuthCheckTool('');
