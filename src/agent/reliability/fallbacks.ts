/**
 * IntelligentFallbacks - Maps tool failures to fallback strategies.
 *
 * Each entry describes an alternative tool (and optional adjusted input)
 * that can be tried when the primary tool fails.
 *
 * The map can be extended at runtime via `registerFallback()`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FallbackAction {
  toolName: string;
  adjustedInput?: Record<string, unknown>;
}

type FallbackFactory = (error: string) => FallbackAction | null;

// ---------------------------------------------------------------------------
// IntelligentFallbacks
// ---------------------------------------------------------------------------

export class IntelligentFallbacks {
  private fallbacks: Map<string, FallbackFactory> = new Map();

  constructor() {
    this.registerDefaults();
  }

  // ── public API ──────────────────────────────────────────────────────────

  /**
   * Get a fallback action for the given tool + error, or `null` if none.
   */
  getFallback(toolName: string, error: string): FallbackAction | null {
    const factory = this.fallbacks.get(toolName);
    if (!factory) return null;
    return factory(error);
  }

  /**
   * Check whether a fallback strategy exists for a tool (regardless of error).
   */
  hasFallback(toolName: string): boolean {
    return this.fallbacks.has(toolName);
  }

  /**
   * Register (or override) a fallback for a tool name.
   */
  registerFallback(toolName: string, factory: FallbackFactory): void {
    this.fallbacks.set(toolName, factory);
  }

  /**
   * Remove a registered fallback.
   */
  removeFallback(toolName: string): boolean {
    return this.fallbacks.delete(toolName);
  }

  /**
   * Return the names of all tools that have fallbacks registered.
   */
  getRegisteredTools(): string[] {
    return Array.from(this.fallbacks.keys());
  }

  // ── private – defaults ────────────────────────────────────────────────

  private registerDefaults(): void {
    // web_search → web_scrape when the source is known
    this.fallbacks.set('web_search', (_error) => ({
      toolName: 'web_scrape',
      adjustedInput: { description: 'Try scraping the URL directly instead of searching.' },
    }));

    // write_file → ensure parent directory then retry
    this.fallbacks.set('write_file', (error) => {
      if (
        error.toLowerCase().includes('no such file') ||
        error.toLowerCase().includes('enoent') ||
        error.toLowerCase().includes('directory')
      ) {
        return {
          toolName: 'write_file',
          adjustedInput: { _hint: 'create_parent_directory_first' },
        };
      }
      return null;
    });

    // github_read_file → try different branch names
    this.fallbacks.set('github_read_file', () => ({
      toolName: 'github_read_file',
      adjustedInput: { branch: 'main' },
    }));

    // run_javascript → simplified version (remove imports)
    this.fallbacks.set('run_javascript', (error) => {
      if (
        error.toLowerCase().includes('import') ||
        error.toLowerCase().includes('module') ||
        error.toLowerCase().includes('require')
      ) {
        return {
          toolName: 'run_javascript',
          adjustedInput: { _hint: 'remove_imports_and_use_simplified_version' },
        };
      }
      return null;
    });

    // web_scrape → fall back to web_search if scraping fails
    this.fallbacks.set('web_scrape', () => ({
      toolName: 'web_search',
      adjustedInput: {
        _hint: 'Web scraping failed. Falling back to web search.',
      },
    }));
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const intelligentFallbacks = new IntelligentFallbacks();
