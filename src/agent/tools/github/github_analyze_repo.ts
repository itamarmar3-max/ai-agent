import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

/**
 * github_analyze_repo - Analyze a repository's structure, languages, and metadata.
 */
export function createGithubAnalyzeRepoTool(token: string) {
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

        // Fetch repo info, languages, and contributors in parallel
        const [repoRes, languagesRes, contributorsRes] = await Promise.all([
          octokit.rest.repos.get({ owner, repo }),
          octokit.rest.repos.listLanguages({ owner, repo }),
          octokit.rest.repos.listContributors({ owner, repo, per_page: 10 }),
        ]);

        const repoData = repoRes.data;
        const languages = languagesRes.data;
        const contributors = contributorsRes.data;

        const totalBytes = Object.values(languages).reduce((sum: number, bytes) => sum + (bytes as number), 0);
        const languageBreakdown = Object.entries(languages)
          .map(([lang, bytes]) => ({
            language: lang,
            bytes: bytes as number,
            percentage: Number((((bytes as number) / totalBytes) * 100).toFixed(1)),
          }))
          .sort((a, b) => b.bytes - a.bytes);

        const topContributors = contributors.map((c) => ({
          login: c.login,
          contributions: c.contributions,
          avatar_url: c.avatar_url,
          html_url: c.html_url,
        }));

        // Generate analysis summary
        const primaryLanguage = languageBreakdown[0]?.language || 'Unknown';
        const totalContributors = contributors.length;
        const analysisSummary = [
          `${repoData.full_name} is a ${repoData.private ? 'private' : 'public'} repository.`,
          `Primary language: ${primaryLanguage}.`,
          `Has ${repoData.stargazers_count} stars, ${repoData.forks_count} forks, and ${repoData.open_issues_count} open issues.`,
          `Total contributors: ${totalContributors} (showing top 10).`,
          `Default branch: ${repoData.default_branch}.`,
          `Created on ${repoData.created_at}, last updated on ${repoData.updated_at}.`,
        ].join(' ');

        const result = {
          repo_info: {
            name: repoData.name,
            full_name: repoData.full_name,
            description: repoData.description,
            html_url: repoData.html_url,
            private: repoData.private,
            stargazers_count: repoData.stargazers_count,
            forks_count: repoData.forks_count,
            open_issues_count: repoData.open_issues_count,
            default_branch: repoData.default_branch,
            created_at: repoData.created_at,
            updated_at: repoData.updated_at,
            size: repoData.size,
          },
          languages: languageBreakdown,
          top_contributors: topContributors,
          analysis_summary: analysisSummary,
        };

        return JSON.stringify(result, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error analyzing repository: ${msg}`;
      }
    },
    {
      name: 'github_analyze_repo',
      description:
        'Analyze a GitHub repository: get structure info, language breakdown with percentages, top contributors, and a summary overview.',
      schema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
      }),
    }
  );
}

export const githubAnalyzeRepoTool = createGithubAnalyzeRepoTool('');
