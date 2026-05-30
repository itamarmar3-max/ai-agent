import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getWorkspaceRoot } from '../workspace';

/**
 * Take a screenshot of any webpage using Puppeteer.
 * The screenshot is saved to the workspace directory.
 */
export const webpageScreenshotTool = tool(
  async ({ url, fullPage, width, height }: {
    url: string;
    fullPage?: boolean;
    width?: number;
    height?: number;
  }): Promise<string> => {
    try {
      let puppeteerModule: typeof import('puppeteer') | null = null;

      try {
        puppeteerModule = await import('puppeteer');
      } catch {
        return (
          'Error: Puppeteer is not installed. The webpage_screenshot tool requires Puppeteer ' +
          'to be installed in the environment. Screenshots are not available in this deployment. ' +
          'You can use the web_scrape tool instead to extract text content from URLs.'
        );
      }

      const workspaceDir = getWorkspaceRoot();
      await mkdir(workspaceDir, { recursive: true });

      const browser = await puppeteerModule.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--single-process',
        ],
      });

      try {
        const page = await browser.newPage();

        const viewportWidth = width || 1280;
        const viewportHeight = height || 800;
        await page.setViewport({ width: viewportWidth, height: viewportHeight });

        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 30000,
        });

        const screenshotBuffer = await page.screenshot({
          type: 'png',
          fullPage: fullPage ?? false,
        });

        // Generate filename from URL
        let safeName = url
          .replace(/^https?:\/\//, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .slice(0, 60);
        if (!safeName) safeName = 'screenshot';
        const timestamp = Date.now();
        const filename = `screenshot_${safeName}_${timestamp}.png`;
        const filePath = path.join(workspaceDir, filename);

        await writeFile(filePath, screenshotBuffer);

        const fileSizeKB = Math.round(screenshotBuffer.length / 1024);

        // Get page title for the response
        const pageTitle = await page.title().catch(() => '');

        return (
          `Screenshot saved successfully.\n` +
          `\n` +
          `File: ${filename}\n` +
          `Path: ${filename}\n` +
          `Size: ${fileSizeKB} KB\n` +
          `Viewport: ${viewportWidth}x${viewportHeight}px\n` +
          `Full page: ${fullPage ? 'Yes' : 'No (viewport only)'}\n` +
          `Page title: ${pageTitle}\n` +
          `URL: ${url}\n` +
          `\n` +
          `The screenshot has been saved to the workspace. Use the file explorer to view it or download the ZIP.`
        );
      } finally {
        await browser.close().catch(() => {});
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error taking screenshot: ${msg}`;
    }
  },
  {
    name: 'webpage_screenshot',
    description:
      'Take a screenshot of any webpage and save it to the workspace as a PNG file. Useful for capturing web page layouts, visualizing content, and archiving page appearances.',
    schema: z.object({
      url: z.string().url().describe('The URL of the webpage to screenshot'),
      fullPage: z
        .boolean()
        .optional()
        .default(false)
        .describe('Whether to capture the full scrollable page (true) or just the visible viewport (false)'),
      width: z
        .number()
        .int()
        .min(320)
        .max(2560)
        .optional()
        .default(1280)
        .describe('Viewport width in pixels (320-2560)'),
      height: z
        .number()
        .int()
        .min(240)
        .max(4096)
        .optional()
        .default(800)
        .describe('Viewport height in pixels (240-4096)'),
    }),
  }
);
