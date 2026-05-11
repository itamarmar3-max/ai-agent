import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Extract text from PDF files using the pdf-parse library.
 * Reads a PDF from the workspace directory and returns its full text content.
 */
export const extractTextFromPdfTool = tool(
  async ({ file_path }: { file_path: string }): Promise<string> => {
    try {
      const workspaceDir = path.resolve(process.cwd(), 'workspace');
      const fullPath = path.resolve(workspaceDir, file_path);

      // Path traversal guard
      if (!fullPath.startsWith(workspaceDir)) {
        return 'Error: File path must be within the workspace directory.';
      }

      // Check file extension
      if (!file_path.toLowerCase().endsWith('.pdf')) {
        return (
          'Error: This tool only supports PDF files. The provided path does not have a .pdf extension.\n' +
          `Provided: "${file_path}"`
        );
      }

      // Check file exists
      const fileBuffer = await readFile(fullPath);

      if (fileBuffer.length === 0) {
        return 'Error: The PDF file is empty (0 bytes).';
      }

      // Dynamic import of pdf-parse
      let pdfParse: (data: Buffer) => Promise<{
        text: string;
        numpages: number;
        info: Record<string, unknown>;
      }>;

      try {
        const pdfModule = await import('pdf-parse');
        pdfParse = (pdfModule as any).default || pdfModule;
      } catch {
        return (
          'Error: The pdf-parse library is not available. PDF text extraction requires ' +
          'the pdf-parse package to be installed.'
        );
      }

      const result = await pdfParse(fileBuffer);

      if (!result.text || result.text.trim().length === 0) {
        return (
          `PDF file processed successfully but no extractable text was found.\n` +
          `\n` +
          `This PDF may contain only images or scanned content. In that case, OCR would be needed.\n` +
          `\n` +
          `File: ${file_path}\n` +
          `Pages: ${result.numpages}`
        );
      }

      const metadataLines: string[] = [];
      if (result.info) {
        const info = result.info as Record<string, unknown>;
        if (info.Title) metadataLines.push(`Title: ${info.Title}`);
        if (info.Author) metadataLines.push(`Author: ${info.Author}`);
        if (info.Creator) metadataLines.push(`Creator: ${info.Creator}`);
        if (info.Producer) metadataLines.push(`Producer: ${info.Producer}`);
        if (info.CreationDate) metadataLines.push(`Created: ${info.CreationDate}`);
        if (info.ModDate) metadataLines.push(`Modified: ${info.ModDate}`);
      }

      const textLength = result.text.length;
      const wordCount = result.text.split(/\s+/).filter(Boolean).length;

      const output: string[] = [];
      output.push(`PDF Text Extraction Complete`);
      output.push('============================');
      output.push('');
      output.push(`File: ${file_path}`);
      output.push(`Pages: ${result.numpages}`);
      output.push(`Characters: ${textLength.toLocaleString()}`);
      output.push(`Words: ${wordCount.toLocaleString()}`);

      if (metadataLines.length > 0) {
        output.push('');
        output.push('--- Metadata ---');
        output.push(...metadataLines);
      }

      output.push('');
      output.push('--- Extracted Text ---');
      output.push('');

      // Truncate very long PDFs to avoid overwhelming context
      const maxChars = 50000;
      if (textLength > maxChars) {
        output.push(result.text.slice(0, maxChars));
        output.push('');
        output.push(
          `\n[Text truncated — showing first ${maxChars.toLocaleString()} of ${textLength.toLocaleString()} characters. ` +
          `Use read_file on the PDF if you need specific sections.]`
        );
      } else {
        output.push(result.text);
      }

      return output.join('\n');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return (
          `Error: File not found at "${file_path}".\n` +
          `\n` +
          `Make sure the PDF file exists in the workspace directory. ` +
          `Use the list_files tool to see available files.`
        );
      }
      const msg = error instanceof Error ? error.message : String(error);
      return `Error extracting text from PDF: ${msg}`;
    }
  },
  {
    name: 'extract_text_from_pdf',
    description:
      'Extract all text content from a PDF file in the workspace. Returns the full text along with metadata (title, author, page count, word count). Works with text-based PDFs. Scanned/image PDFs may need OCR.',
    schema: z.object({
      file_path: z
        .string()
        .describe('Path to the PDF file relative to the workspace directory (e.g., "document.pdf")'),
    }),
  }
);
