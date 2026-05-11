import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Test a regular expression pattern against a string.
 * Returns detailed match information including all capture groups.
 */
export const regexTestTool = tool(
  async ({
    pattern,
    test_string,
    flags,
    full_match,
  }: {
    pattern: string;
    test_string: string;
    flags?: string;
    full_match?: boolean;
  }): Promise<string> => {
    try {
      const flagsStr = flags || 'g';

      // Validate flags
      const validFlags = 'gimsuy';
      for (const ch of flagsStr) {
        if (!validFlags.includes(ch)) {
          return `Error: Invalid regex flag "${ch}". Valid flags are: ${validFlags}`;
        }
      }

      let regex: RegExp;
      try {
        regex = new RegExp(pattern, flagsStr);
      } catch (regexError) {
        return `Error: Invalid regular expression pattern: ${(regexError as Error).message}`;
      }

      const results: string[] = [];
      results.push('Regex Test Results');
      results.push('=================');
      results.push('');
      results.push(`Pattern: /${pattern}/${flagsStr}`);
      results.push(`Test string: "${test_string.length > 100 ? test_string.slice(0, 100) + '...' : test_string}"`);
      results.push(`Test string length: ${test_string.length} characters`);
      results.push('');

      if (full_match) {
        // Test if the entire string matches the pattern
        const fullRegex = new RegExp(`^${pattern}$`, flagsStr.replace('g', ''));
        const isFullMatch = fullRegex.test(test_string);
        results.push(`Full string match: ${isFullMatch ? 'YES' : 'NO'}`);
        results.push('');
      }

      // Execute the regex and collect all matches
      const matches: Array<{
        match: string;
        index: number;
        groups: Record<string, string> | null;
        namedGroups: Record<string, string> | null;
      }> = [];

      // Reset lastIndex if global flag
      if (flagsStr.includes('g')) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        let count = 0;
        while ((match = regex.exec(test_string)) !== null) {
          matches.push({
            match: match[0],
            index: match.index,
            groups: match.slice(1) ? Object.fromEntries(
              match.slice(1).map((g, i) => [`Group ${i + 1}`, g ?? 'undefined'])
            ) : null,
            namedGroups: match.groups ? { ...match.groups } : null,
          });
          count++;

          // Safety limit to prevent infinite loops on zero-length matches
          if (count > 1000) {
            results.push(`Warning: Match limit reached at 1000 matches (possible zero-length match loop).`);
            break;
          }
          if (match[0].length === 0) {
            regex.lastIndex++;
          }
        }
      } else {
        const match = regex.exec(test_string);
        if (match) {
          matches.push({
            match: match[0],
            index: match.index,
            groups: match.slice(1) ? Object.fromEntries(
              match.slice(1).map((g, i) => [`Group ${i + 1}`, g ?? 'undefined'])
            ) : null,
            namedGroups: match.groups ? { ...match.groups } : null,
          });
        }
      }

      // Report results
      results.push(`Matches found: ${matches.length}`);
      results.push('');

      if (matches.length === 0) {
        results.push('No matches found for the given pattern and test string.');
        results.push('');
        results.push('Suggestions:');
        results.push('- Check for typos in the regex pattern');
        results.push('- Try removing flags or changing them');
        results.push('- Use .* for wildcard matching');
        results.push('- Escape special characters with \\');
      } else {
        for (let i = 0; i < matches.length; i++) {
          const m = matches[i];
          results.push(`--- Match ${i + 1} ---`);
          results.push(`  Value: "${m.match}"`);
          results.push(`  Position: index ${m.index} to ${m.index + m.match.length}`);
          results.push(`  Length: ${m.match.length} characters`);

          if (m.groups && Object.keys(m.groups).length > 0) {
            results.push('  Capture groups:');
            for (const [name, value] of Object.entries(m.groups)) {
              results.push(`    ${name}: "${value}"`);
            }
          }

          if (m.namedGroups && Object.keys(m.namedGroups).length > 0) {
            results.push('  Named groups:');
            for (const [name, value] of Object.entries(m.namedGroups)) {
              results.push(`    ${name}: "${value}"`);
            }
          }

          results.push('');
        }

        // Show context around matches (for short strings)
        if (test_string.length <= 500 && matches.length <= 20) {
          results.push('--- Match Visualization ---');
          let visual = test_string;
          // Replace matched parts with markers (process in reverse to preserve indices)
          const sortedMatches = [...matches].sort((a, b) => b.index - a.index);
          for (const m of sortedMatches) {
            const before = visual.slice(0, m.index);
            const matched = visual.slice(m.index, m.index + m.match.length);
            const after = visual.slice(m.index + m.match.length);
            visual = `${before}[${matched}]${after}`;
          }
          results.push(visual);
        }
      }

      return results.join('\n');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error testing regex: ${msg}`;
    }
  },
  {
    name: 'regex_test',
    description:
      'Test a regular expression pattern against a string. Returns all matches with their positions, capture groups, and named groups. Supports all standard regex flags. Includes visualization of matched portions in the original string.',
    schema: z.object({
      pattern: z.string().describe('The regular expression pattern to test'),
      test_string: z.string().describe('The string to test the pattern against'),
      flags: z
        .string()
        .optional()
        .default('g')
        .describe('Regex flags: g (global), i (case-insensitive), m (multiline), s (dotAll), u (unicode), y (sticky)'),
      full_match: z
        .boolean()
        .optional()
        .default(false)
        .describe('Whether to check if the ENTIRE string matches the pattern (not just a substring)'),
    }),
  }
);
