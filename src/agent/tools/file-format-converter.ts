import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Convert between common file formats.
 * Supports: JSON to CSV, CSV to JSON, Markdown to HTML, HTML to Markdown, TXT to JSON.
 */
export const fileFormatConverterTool = tool(
  async ({
    content,
    from_format,
    to_format,
  }: {
    content: string;
    from_format: string;
    to_format: string;
  }): Promise<string> => {
    try {
      const from = from_format.toLowerCase().trim();
      const to = to_format.toLowerCase().trim();

      const conversionKey = `${from}->${to}`;

      switch (conversionKey) {
        // ---------------------------------------------------------------
        // JSON -> CSV
        // ---------------------------------------------------------------
        case 'json->csv': {
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            if (typeof parsed === 'object' && parsed !== null) {
              return convertObjectArrayToCsv([parsed]);
            }
            return 'Error: JSON content must be an array of objects or a single object to convert to CSV.';
          }
          return convertObjectArrayToCsv(parsed);
        }

        // ---------------------------------------------------------------
        // CSV -> JSON
        // ---------------------------------------------------------------
        case 'csv->json': {
          return convertCsvToJson(content);
        }

        // ---------------------------------------------------------------
        // Markdown -> HTML
        // ---------------------------------------------------------------
        case 'markdown->html':
        case 'md->html': {
          return convertMarkdownToHtml(content);
        }

        // ---------------------------------------------------------------
        // HTML -> Markdown (basic)
        // ---------------------------------------------------------------
        case 'html->markdown': {
          return convertHtmlToMarkdown(content);
        }

        // ---------------------------------------------------------------
        // TXT -> JSON (line-based or key=value)
        // ---------------------------------------------------------------
        case 'txt->json': {
          return convertTxtToJson(content);
        }

        // ---------------------------------------------------------------
        // JSON -> TXT
        // ---------------------------------------------------------------
        case 'json->txt': {
          const parsed = JSON.parse(content);
          return JSON.stringify(parsed, null, 2);
        }

        default: {
          return (
            `Error: Conversion from "${from}" to "${to}" is not supported.\n` +
            `\n` +
            `Supported conversions:\n` +
            `  JSON -> CSV\n` +
            `  CSV -> JSON\n` +
            `  Markdown -> HTML\n` +
            `  HTML -> Markdown\n` +
            `  TXT -> JSON\n` +
            `  JSON -> TXT`
          );
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error converting format: ${msg}`;
    }
  },
  {
    name: 'file_format_converter',
    description:
      'Convert content between common file formats. Supports: JSON to CSV, CSV to JSON, Markdown to HTML, HTML to Markdown, TXT to JSON, and JSON to TXT. Useful for data transformation tasks.',
    schema: z.object({
      content: z.string().describe('The content to convert'),
      from_format: z
        .string()
        .describe('Source format: json, csv, markdown/md, html, txt'),
      to_format: z
        .string()
        .describe('Target format: json, csv, markdown/md, html, txt'),
    }),
  }
);

// ---------------------------------------------------------------------------
// Internal conversion helpers
// ---------------------------------------------------------------------------

function convertObjectArrayToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '(empty CSV - no rows)';

  // Collect all unique keys in order
  const keySet = new Set<string>();
  for (const row of data) {
    for (const key of Object.keys(row)) {
      keySet.add(key);
    }
  }
  const headers = Array.from(keySet);

  // Escape CSV fields
  function escapeField(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const lines: string[] = [];
  lines.push(headers.map(escapeField).join(','));
  for (const row of data) {
    lines.push(headers.map((h) => escapeField(row[h])).join(','));
  }

  return lines.join('\n');
}

function convertCsvToJson(csv: string): string {
  const lines = csv.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return '[]';

  function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          fields.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    fields.push(current);
    return fields;
  }

  const headers = parseCsvLine(lines[0]);
  const result: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] ?? '';
    }
    result.push(obj);
  }

  return JSON.stringify(result, null, 2);
}

function convertMarkdownToHtml(md: string): string {
  let html = md;

  // Code blocks (fenced)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang: string, code: string) =>
      `<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`
  );

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Unordered lists
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>\n$1</ul>\n');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');

  // Paragraphs: wrap remaining lines
  html = html
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<pre') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<li') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('</')
      ) {
        return line;
      }
      return `<p>${trimmed}</p>`;
    })
    .join('\n');

  return html;
}

function convertHtmlToMarkdown(html: string): string {
  let md = html;

  // Remove script and style tags entirely
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1');

  // Bold and italic
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*');

  // Links
  md = md.replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Images
  md = md.replace(/<img[^>]+src="([^"]+)"[^>]+alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]+src="([^"]+)"[^>]*\/?>/gi, '![]($1)');

  // Code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```');

  // Inline code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // List items
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1');
  md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n');

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1');

  // Line breaks and paragraphs
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<p[^>]*>/gi, '');
  md = md.replace(/<hr\s*\/?>/gi, '---');

  // Remove remaining tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#039;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');

  // Clean up excess whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

function convertTxtToJson(content: string): string {
  const lines = content.split('\n').filter((l) => l.trim() !== '');

  // Try key=value format
  const isKeyValue = lines.every((line) => line.includes('='));
  if (isKeyValue) {
    const obj: Record<string, string> = {};
    for (const line of lines) {
      const eqIdx = line.indexOf('=');
      const key = line.slice(0, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim();
      obj[key] = value;
    }
    return JSON.stringify(obj, null, 2);
  }

  // Try colon-separated format
  const isColonSeparated = lines.every((line) => line.includes(':'));
  if (isColonSeparated) {
    const obj: Record<string, string> = {};
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      obj[key] = value;
    }
    return JSON.stringify(obj, null, 2);
  }

  // Fall back to array of lines
  return JSON.stringify(lines.map((line) => ({ line })), null, 2);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
