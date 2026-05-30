import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readdir, stat, readFile, writeFile } from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import { getWorkspaceRoot } from '../workspace';

/**
 * Recursively add files to a JSZip instance.
 */
async function addFilesToZip(
  zip: JSZip,
  dirPath: string,
  basePath: string = ''
): Promise<number> {
  let fileCount = 0;
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    // Skip hidden files except .memory.json and skip the output archive itself.
    if (entry.name.startsWith('.') && entry.name !== '.memory.json') continue;
    if (!basePath && entry.name === 'project.zip') continue;

    const fullPath = path.join(dirPath, entry.name);
    const zipPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      fileCount += await addFilesToZip(zip, fullPath, zipPath);
    } else {
      try {
        const fileStat = await stat(fullPath);
        if (!fileStat.isFile()) continue;
        const content = await readFile(fullPath);
        zip.file(zipPath, content);
        fileCount++;
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return fileCount;
}

/**
 * create_zip - Pack all workspace files into a downloadable ZIP archive.
 */
export const createZipTool = tool(
  async (): Promise<string> => {
    try {
      const workspaceRoot = getWorkspaceRoot();
      const zip = new JSZip();
      const fileCount = await addFilesToZip(zip, workspaceRoot);

      if (fileCount === 0) {
        return 'No files found in workspace to zip. The workspace appears to be empty.';
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const outputPath = path.join(workspaceRoot, 'project.zip');
      await writeFile(outputPath, zipBuffer);

      const sizeMB = (zipBuffer.length / (1024 * 1024)).toFixed(2);

      return `ZIP archive created successfully!\n- Path: ${outputPath}\n- Files packed: ${fileCount}\n- Archive size: ${sizeMB} MB\n\nYou can download the project.zip file.`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error creating ZIP: ${msg}`;
    }
  },
  {
    name: 'create_zip',
    description:
      'Pack all workspace files into a downloadable ZIP archive. Returns the ZIP file path. Use when the user asks to export or download workspace contents.',
    schema: z.object({}),
  }
);
