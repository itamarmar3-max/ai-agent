/**
 * ResponseValidator - Validates and auto-fixes AI responses.
 *
 * Provides methods for code syntax checking, JSON validation, plan
 * completeness verification, and file-write diffing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeValidation {
  valid: boolean;
  issues: string[];
  fixed?: string;
}

export interface PlanCheck {
  complete: boolean;
  missing: number;
}

export interface JSONValidation {
  valid: boolean;
  fixed?: string;
  error?: string;
}

export interface FileWriteValidation {
  matches: boolean;
  diff?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple unified diff-like string comparison.
 * Returns a human-readable diff or `null` when the strings match.
 */
function simpleDiff(intended: string, written: string): string | null {
  if (intended === written) return null;

  const iLines = intended.split('\n');
  const wLines = written.split('\n');

  const diffs: string[] = [];
  const maxLen = Math.max(iLines.length, wLines.length);

  for (let i = 0; i < maxLen; i++) {
    const iLine = iLines[i];
    const wLine = wLines[i];

    if (iLine === undefined) {
      diffs.push(`  + ${wLine}`);
    } else if (wLine === undefined) {
      diffs.push(`  - ${iLine}`);
    } else if (iLine !== wLine) {
      diffs.push(`  - ${iLine}`);
      diffs.push(`  + ${wLine}`);
    }
  }

  return diffs.join('\n');
}

// ---------------------------------------------------------------------------
// ResponseValidator
// ---------------------------------------------------------------------------

export class ResponseValidator {
  // ── public API ──────────────────────────────────────────────────────────

  /**
   * Validate code for balanced brackets/braces and common syntax issues.
   * Attempts an auto-fix when possible.
   */
  validateCode(code: string, language: string): CodeValidation {
    const issues: string[] = [];

    // --- Bracket / brace / paren balancing ---
    const pairs: Array<[string, string]> = [
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
    ];

    for (const [open, close] of pairs) {
      const balance = this.checkBalance(code, open, close);
      if (balance !== 0) {
        issues.push(
          balance > 0
            ? `Unmatched '${open}' – ${balance} more opening than closing`
            : `Unmatched '${close}' – ${Math.abs(balance)} more closing than opening`,
        );
      }
    }

    // --- Language-specific checks ---

    if (language === 'javascript' || language === 'typescript' || language === 'jsx' || language === 'tsx') {
      // Trailing comma inside function args / array / object before closing bracket
      const trailingCommaPattern = /,\s*([)\]}\n])/g;
      const matches = code.match(trailingCommaPattern);
      if (matches && matches.length > 0) {
        issues.push(
          `${matches.length} trailing comma(s) detected (may cause issues in older environments)`,
        );
      }
    }

    if (language === 'python') {
      // Check for mixed tabs and spaces (simplified)
      const hasTab = code.includes('\t');
      const hasSpaceIndent = /^\s+ /m.test(code);
      if (hasTab && hasSpaceIndent) {
        issues.push('Mixed tabs and spaces in indentation');
      }

      // Unclosed string (triple-quote pairs)
      const tripleSingle = (code.match(/'''/g) ?? []).length;
      if (tripleSingle % 2 !== 0) {
        issues.push("Unclosed triple-single-quoted string (''')");
      }
      const tripleDouble = (code.match(/"""/g) ?? []).length;
      if (tripleDouble % 2 !== 0) {
        issues.push('Unclosed triple-double-quoted string (""")');
      }
    }

    if (language === 'html' || language === 'xml' || language === 'jsx' || language === 'tsx') {
      // Check for unclosed tags (simplified – only common self-closing tags)
      const selfClosing = new Set([
        'br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base',
        'col', 'embed', 'source', 'track', 'wbr',
      ]);
      const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g;
      const openTags: string[] = [];
      let tagMatch: RegExpExecArray | null;
      const fullText = code;

      const tagRegex = new RegExp(tagPattern.source, 'g');
      while ((tagMatch = tagRegex.exec(fullText)) !== null) {
        const raw = tagMatch[0];
        const tagName = tagMatch[1].toLowerCase();
        if (raw.startsWith('</')) {
          // Closing tag
          if (openTags.length > 0 && openTags[openTags.length - 1] === tagName) {
            openTags.pop();
          }
        } else if (raw.endsWith('/>') || selfClosing.has(tagName)) {
          // Self-closing – skip
        } else {
          openTags.push(tagName);
        }
      }

      if (openTags.length > 0) {
        issues.push(`Unclosed tag(s): ${openTags.join(', ')}`);
      }
    }

    // --- Auto-fix attempt ---
    let fixed: string | undefined;
    if (issues.length > 0) {
      fixed = this.attemptCodeFix(code, language, issues);
    }

    return { valid: issues.length === 0, issues, fixed };
  }

  /**
   * Check whether all planned steps have been completed.
   */
  checkCompleteness(plan: { steps: string[] }, completedSteps: number): PlanCheck {
    const total = plan.steps.length;
    const missing = Math.max(0, total - completedSteps);
    return { complete: missing === 0, missing };
  }

  /**
   * Validate a JSON string. Auto-fixes common issues:
   *   - Trailing commas
   *   - Single quotes → double quotes
   */
  validateJSON(text: string): JSONValidation {
    // Try parse as-is
    try {
      JSON.parse(text);
      return { valid: true };
    } catch (originalErr: unknown) {
      // Try auto-fixing
      let fixed = text;

      // Replace single quotes with double quotes (outside of already-escaped contexts)
      fixed = fixed.replace(/(?<=:\s*)'([^']*?)'(?=\s*[,}\]])/g, '"$1"');
      fixed = fixed.replace(/(?<=\[[\s]*)'([^']*?)'(?=\s*[,\]])/g, '"$1"');

      // Remove trailing commas before } or ]
      fixed = fixed.replace(/,\s*([}\]])/g, '$1');

      try {
        JSON.parse(fixed);
        return { valid: true, fixed };
      } catch (secondErr: unknown) {
        return {
          valid: false,
          error: secondErr instanceof Error ? secondErr.message : String(secondErr),
        };
      }
    }
  }

  /**
   * Compare intended content with what was actually written.
   */
  validateFileWrite(intended: string, written: string): FileWriteValidation {
    const diff = simpleDiff(intended, written);
    return { matches: diff === null, diff: diff ?? undefined };
  }

  // ── private helpers ─────────────────────────────────────────────────

  /**
   * Check bracket balance ignoring string contents.
   */
  private checkBalance(code: string, open: string, close: string): number {
    let balance = 0;
    let inString: string | null = null;
    let escape = false;

    for (let i = 0; i < code.length; i++) {
      const ch = code[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === '\\' && inString !== null) {
        escape = true;
        continue;
      }

      if (inString !== null) {
        if (ch === inString) inString = null;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch;
        continue;
      }

      // Ignore comments
      if (ch === '/' && i + 1 < code.length) {
        const next = code[i + 1];
        if (next === '/') {
          // Line comment – skip to end of line
          const newlineIdx = code.indexOf('\n', i);
          i = newlineIdx === -1 ? code.length - 1 : newlineIdx;
          continue;
        }
        if (next === '*') {
          // Block comment – skip to */
          const endIdx = code.indexOf('*/', i + 2);
          i = endIdx === -1 ? code.length - 1 : endIdx + 1;
          continue;
        }
      }

      if (ch === open) balance++;
      if (ch === close) balance--;
    }

    return balance;
  }

  /**
   * Attempt basic code auto-fixes.
   */
  private attemptCodeFix(
    code: string,
    _language: string,
    _issues: string[],
  ): string {
    let fixed = code;

    // Remove trailing commas before closing brackets (safe for most languages)
    fixed = fixed.replace(/,\s*([)\]}])/g, '$1');

    return fixed;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const responseValidator = new ResponseValidator();
