/**
 * Shared helpers for keeping tool outputs token-efficient.
 *
 * Per Anthropic's tool-design guidance, any tool whose result can be large
 * should support pagination/truncation with sensible defaults so a single call
 * can't blow the model's context window. These helpers give every file/web/
 * document tool a consistent windowing scheme and a clear "there is more"
 * marker that tells the model how to fetch the next slice.
 */

/** Default ceiling on a single tool result, in characters (~25k tokens). */
export const DEFAULT_MAX_CHARS = 100_000;

export interface WindowOptions {
  /** Max characters to return. Defaults to DEFAULT_MAX_CHARS. */
  maxChars?: number;
  /** Character offset to start from (for paging through large outputs). */
  offset?: number;
  /** Label used in the truncation notice, e.g. "file" or "page". */
  unit?: string;
}

/**
 * Return a windowed slice of `text` plus a clear notice when content was
 * truncated, including how to request the next slice.
 */
export function windowText(text: string, options: WindowOptions = {}): string {
  const maxChars = Math.max(1, options.maxChars ?? DEFAULT_MAX_CHARS);
  const offset = Math.max(0, options.offset ?? 0);
  const unit = options.unit ?? 'content';
  const total = text.length;

  if (offset >= total && total > 0) {
    return `[offset ${offset} is past the end of the ${unit} (${total} chars total).]`;
  }

  const slice = text.slice(offset, offset + maxChars);
  const end = offset + slice.length;
  const truncated = end < total;

  if (!truncated && offset === 0) {
    return text;
  }

  const notice =
    `\n\n[Showing ${unit} chars ${offset}–${end} of ${total}. ` +
    (truncated
      ? `Truncated — call again with offset=${end} to continue.]`
      : `End of ${unit}.]`);

  return slice + notice;
}

/** Estimate token count from characters (~4 chars/token). */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
