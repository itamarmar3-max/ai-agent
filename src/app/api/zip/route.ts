import { promises as fs } from 'fs';
import path from 'path';
import JSZip from 'jszip';

/**
 * Workspace root directory.
 */
const WORKSPACE_ROOT = path.resolve(process.cwd(), 'workspace');

/**
 * GET /api/zip
 *
 * Creates a ZIP archive from the workspace directory and returns it
 * as a downloadable blob.
 */
export async function GET() {
  try {
    // Ensure workspace exists.
    await fs.mkdir(WORKSPACE_ROOT, { recursive: true });

    const zip = new JSZip();

    /**
     * Recursively add files from `dir` into the zip under `prefix`.
     */
    async function addDirToZip(dir: string, prefix: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);
        const zipPath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await addDirToZip(fullPath, zipPath);
        } else {
          const data = await fs.readFile(fullPath);
          zip.file(zipPath, data);
        }
      }
    }

    await addDirToZip(WORKSPACE_ROOT, '');

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    return new Response(buffer.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="project.zip"',
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
