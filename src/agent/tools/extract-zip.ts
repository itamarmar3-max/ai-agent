import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFile, mkdir, stat } from 'fs/promises';
import path from 'path';
import { getWorkspaceRoot, resolveInsideRoot } from '../workspace';

/**
 * Extract (unpack) a ZIP file from the workspace into a directory.
 * Uses the adm-zip library for fast, synchronous-like extraction.
 */
export const extractZipTool = tool(
  async ({ zip_path, destination }: {
    zip_path: string;
    destination?: string;
  }): Promise<string> => {
    try {
      const workspaceDir = getWorkspaceRoot();
      const fullZipPath = resolveInsideRoot(workspaceDir, zip_path);

      // Path traversal guard
      if (!fullZipPath) {
        return 'Error: ZIP file path must be within the workspace directory.';
      }

      // Determine destination directory
      const destName = destination || zip_path.replace(/\.zip$/i, '') || 'extracted';
      const fullDestPath = resolveInsideRoot(workspaceDir, destName);

      // Path traversal guard for destination
      if (!fullDestPath) {
        return 'Error: Destination path must be within the workspace directory.';
      }

      // Check source exists and is a file
      const zipStat = await stat(fullZipPath).catch(() => null);
      if (!zipStat || !zipStat.isFile()) {
        return (
          `Error: ZIP file not found at "${zip_path}".\n` +
          `\n` +
          `Use list_files to see available files in the workspace.`
        );
      }

      // Read the ZIP file
      const zipBuffer = await readFile(fullZipPath);

      // Dynamic import of adm-zip
      let AdmZip: new (data: Buffer) => {
        getEntries(): Array<{
          entryName: string;
          isDirectory: boolean;
          getData: () => Buffer;
          header: { size: number };
        }>;
        extractAllTo(targetPath: string, overwrite?: boolean): void;
      };

      try {
        const zipModule = await import('adm-zip');
        AdmZip = zipModule.default || zipModule;
      } catch {
        return (
          'Error: The adm-zip library is not available. ZIP extraction requires the adm-zip package.'
        );
      }

      // Create destination directory
      await mkdir(fullDestPath, { recursive: true });

      // Extract
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      const extractedFiles: string[] = [];
      const extractedDirs: string[] = [];
      let totalSize = 0;

      for (const entry of entries) {
        const normalizedEntry = entry.entryName.replace(/\\/g, '/');
        if (normalizedEntry.startsWith('/') || normalizedEntry.includes('../')) {
          return `Error: ZIP contains an unsafe path: "${entry.entryName}".`;
        }
        const targetPath = resolveInsideRoot(fullDestPath, normalizedEntry);
        if (!targetPath) {
          return `Error: ZIP entry would extract outside the destination: "${entry.entryName}".`;
        }

        if (entry.isDirectory) {
          extractedDirs.push(entry.entryName);
        } else {
          extractedFiles.push(entry.entryName);
          totalSize += entry.header.size;
        }
      }

      zip.extractAllTo(fullDestPath, true);

      // Format size
      let sizeStr: string;
      if (totalSize > 1024 * 1024) {
        sizeStr = `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
      } else if (totalSize > 1024) {
        sizeStr = `${(totalSize / 1024).toFixed(2)} KB`;
      } else {
        sizeStr = `${totalSize} bytes`;
      }

      const relDest = destination || destName;

      const output: string[] = [];
      output.push('ZIP Extraction Complete');
      output.push('======================');
      output.push('');
      output.push(`Source: ${zip_path}`);
      output.push(`Destination: ${relDest}`);
      output.push(`Files extracted: ${extractedFiles.length}`);
      output.push(`Directories created: ${extractedDirs.length}`);
      output.push(`Total size: ${sizeStr}`);
      output.push('');

      if (extractedFiles.length > 0) {
        output.push('Extracted files:');
        for (const file of extractedFiles.slice(0, 50)) {
          output.push(`  - ${file}`);
        }
        if (extractedFiles.length > 50) {
          output.push(`  ... and ${extractedFiles.length - 50} more files`);
        }
      }

      return output.join('\n');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error extracting ZIP: ${msg}`;
    }
  },
  {
    name: 'extract_zip',
    description:
      'Extract a ZIP archive from the workspace into a workspace directory. Validates archive paths to prevent traversal. Use after the user uploads or asks to unpack a ZIP file.',
    schema: z.object({
      zip_path: z
        .string()
        .min(1)
        .describe('Path to the ZIP file relative to the workspace directory (e.g., "project.zip")'),
      destination: z
        .string()
        .min(1)
        .optional()
        .describe('Optional destination directory relative to workspace. Defaults to ZIP filename without .zip'),
    }),
  }
);
