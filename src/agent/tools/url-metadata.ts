import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Fetch metadata of any URL including content type, size, title, description,
 * and other useful information without downloading the full content.
 */
export const urlMetadataTool = tool(
  async ({ url }: { url: string }): Promise<string> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; AI-Agent-Metadata/1.0)',
          },
        });
      } catch {
        // If HEAD fails, try GET with range header to minimize download
        response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; AI-Agent-Metadata/1.0)',
            Range: 'bytes=0-0',
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const metadata: Record<string, string> = {};

      // Basic response info
      metadata['URL'] = response.url || url;
      metadata['Status Code'] = String(response.status);
      metadata['Status Text'] = response.statusText;
      metadata['Protocol'] = response.url.startsWith('https') ? 'HTTPS' : 'HTTP';
      metadata['Redirected'] = response.redirected ? 'Yes' : 'No';
      metadata['OK'] = response.ok ? 'Yes' : 'No';

      // Headers
      const contentType = response.headers.get('content-type') || 'unknown';
      metadata['Content-Type'] = contentType;

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const bytes = parseInt(contentLength, 10);
        if (bytes > 1024 * 1024) {
          metadata['Content-Length'] = `${(bytes / (1024 * 1024)).toFixed(2)} MB (${bytes} bytes)`;
        } else if (bytes > 1024) {
          metadata['Content-Length'] = `${(bytes / 1024).toFixed(2)} KB (${bytes} bytes)`;
        } else {
          metadata['Content-Length'] = `${bytes} bytes`;
        }
      }

      const lastModified = response.headers.get('last-modified');
      if (lastModified) metadata['Last-Modified'] = lastModified;

      const cacheControl = response.headers.get('cache-control');
      if (cacheControl) metadata['Cache-Control'] = cacheControl;

      const server = response.headers.get('server');
      if (server) metadata['Server'] = server;

      const encoding = response.headers.get('content-encoding');
      if (encoding) metadata['Content-Encoding'] = encoding;

      const language = response.headers.get('content-language');
      if (language) metadata['Content-Language'] = language;

      const xFrameOptions = response.headers.get('x-frame-options');
      if (xFrameOptions) metadata['X-Frame-Options'] = xFrameOptions;

      const csp = response.headers.get('content-security-policy');
      if (csp) metadata['Content-Security-Policy'] = csp;

      // Try to fetch a small portion of HTML to extract title/meta
      let pageTitle = '';
      let pageDescription = '';
      let pageKeywords = '';
      let ogTitle = '';
      let ogDescription = '';
      let ogImage = '';
      let twitterCard = '';

      try {
        const bodyController = new AbortController();
        const bodyTimeout = setTimeout(() => bodyController.abort(), 10000);

        const bodyResponse = await fetch(url, {
          signal: bodyController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AI-Agent-Metadata/1.0)',
          },
        });
        clearTimeout(bodyTimeout);

        const html = await bodyResponse.text();

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch) pageTitle = titleMatch[1].trim().replace(/\s+/g, ' ');

        // Extract meta description
        const descMatch = html.match(
          /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([\s\S]*?)["'][^>]*>/i
        ) || html.match(
          /<meta[^>]+content\s*=\s*["']([\s\S]*?)["'][^>]+name\s*=\s*["']description["'][^>]*>/i
        );
        if (descMatch) pageDescription = descMatch[1].trim();

        // Extract meta keywords
        const kwMatch = html.match(
          /<meta[^>]+name\s*=\s*["']keywords["'][^>]+content\s*=\s*["']([\s\S]*?)["'][^>]*>/i
        );
        if (kwMatch) pageKeywords = kwMatch[1].trim();

        // Extract Open Graph
        const ogTitleMatch = html.match(
          /<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([\s\S]*?)["'][^>]*>/i
        );
        if (ogTitleMatch) ogTitle = ogTitleMatch[1].trim();

        const ogDescMatch = html.match(
          /<meta[^>]+property\s*=\s*["']og:description["'][^>]+content\s*=\s*["']([\s\S]*?)["'][^>]*>/i
        );
        if (ogDescMatch) ogDescription = ogDescMatch[1].trim();

        const ogImgMatch = html.match(
          /<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([\s\S]*?)["'][^>]*>/i
        );
        if (ogImgMatch) ogImage = ogImgMatch[1].trim();

        const twMatch = html.match(
          /<meta[^>]+name\s*=\s*["']twitter:card["'][^>]+content\s*=\s*["']([\s\S]*?)["'][^>]*>/i
        );
        if (twMatch) twitterCard = twMatch[1].trim();

        // Count links
        const linkCount = (html.match(/<a\s/gi) || []).length;
        const imageCount = (html.match(/<img\s/gi) || []).length;
        metadata['Links'] = String(linkCount);
        metadata['Images'] = String(imageCount);
      } catch {
        // Could not fetch body — skip HTML metadata extraction
      }

      // Build output
      const lines: string[] = ['URL Metadata Report', '===================', ''];

      // Group into sections
      lines.push('--- Basic Info ---');
      for (const [key, value] of Object.entries(metadata)) {
        lines.push(`  ${key}: ${value}`);
      }
      lines.push('');

      if (pageTitle || pageDescription || pageKeywords) {
        lines.push('--- Page Content ---');
        if (pageTitle) lines.push(`  Title: ${pageTitle}`);
        if (pageDescription) lines.push(`  Description: ${pageDescription}`);
        if (pageKeywords) lines.push(`  Keywords: ${pageKeywords}`);
        lines.push('');
      }

      if (ogTitle || ogDescription || ogImage || twitterCard) {
        lines.push('--- Social / Open Graph ---');
        if (ogTitle) lines.push(`  OG Title: ${ogTitle}`);
        if (ogDescription) lines.push(`  OG Description: ${ogDescription}`);
        if (ogImage) lines.push(`  OG Image: ${ogImage}`);
        if (twitterCard) lines.push(`  Twitter Card: ${twitterCard}`);
        lines.push('');
      }

      return lines.join('\n');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error fetching URL metadata: ${msg}`;
    }
  },
  {
    name: 'url_metadata',
    description:
      'Fetch comprehensive metadata of any URL including content type, size, server info, page title, description, Open Graph tags, link count, and more. Useful for analyzing web pages without downloading full content.',
    schema: z.object({
      url: z.string().describe('The URL to fetch metadata for'),
    }),
  }
);
