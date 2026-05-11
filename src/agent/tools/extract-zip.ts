import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFile, mkdir, stat } from 'fs/promises';
import path from 'path';

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
      const workspaceDir = path.resolve(process.cwd(), 'workspace');
      const fullZipPath = path.resolve(workspaceDir, zip_path);

      // Path traversal guard
      if (!fullZipPath.startsWith(workspaceDir)) {
        return 'Error: ZIP file path must be within the workspace directory.';
      }

      // Determine destination directory
      const destName = destination || zip_path.replace(/\.zip$/i, '') || 'extracted';
      const fullDestPath = path.resolve(workspaceDir, destName);

      // Path traversal guard for destination
      if (!fullDestPath.startsWith(workspaceDir)) {
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

      // Show first 20 extracted files
      if (extractedFiles.length > 0) {
        output.push('--- Extracted Files ---');
        const showFiles = extractedFiles.slice(0, 20);
        for (const f of showFiles) {
          output.push(`  ${f}`);
        }
        if (extractedFiles.length > 20) {
          output.push(`  ... and ${extractedFiles.length - 20} more files`);
        }
      }

      output.push('');
      output.push(
        `The files have been extracted to the workspace at "${relDest}". ` +
        `Use list_files to browse the extracted content.`
      );

      return output.join('\n');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error extracting ZIP file: ${msg}`;
    }
  },
  {
    name: 'extract_zip',
    description:
      'Extract (unpack) a ZIP file from the workspace into a directory. All extracted files are placed in the workspace. Useful for unpacking downloaded archives, project templates, and compressed file collections.',
    schema: z.object({
      zip_path: z
        .string()
        .describe('Path to the ZIP file in the workspace (e.g., "archive.zip")'),
      destination: z
        .string()
        .optional()
        .describe('Directory name to extract into (default: ZIP filename without extension)'),
    }),
  }
);
