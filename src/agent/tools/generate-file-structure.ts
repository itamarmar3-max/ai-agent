import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * generate_file_structure - Generate a project file tree based on description.
 * Uses built-in templates when LLM is not available.
 */
export const generateFileStructureTool = tool(
  async ({
    description,
    project_type,
  }: {
    description: string;
    project_type?: string;
  }): Promise<string> => {
    try {
      const type = project_type || 'general';
      const typeLower = type.toLowerCase();

      // Built-in templates for common project types
      const templates: Record<string, string> = {
        'next.js': JSON.stringify({
          project: { type: 'next.js', description },
          files: [
            { path: 'package.json', type: 'file', description: 'Project dependencies' },
            { path: 'next.config.js', type: 'file', description: 'Next.js configuration' },
            { path: 'tsconfig.json', type: 'file', description: 'TypeScript configuration' },
            { path: 'src/app/layout.tsx', type: 'file', description: 'Root layout' },
            { path: 'src/app/page.tsx', type: 'file', description: 'Home page' },
            { path: 'src/app/globals.css', type: 'file', description: 'Global styles' },
            { path: 'src/components/', type: 'directory', description: 'React components' },
            { path: 'src/lib/', type: 'directory', description: 'Utility functions' },
            { path: 'public/', type: 'directory', description: 'Static assets' },
            { path: '.env.local', type: 'file', description: 'Environment variables' },
          ],
        }, null, 2),

        'react': JSON.stringify({
          project: { type: 'react', description },
          files: [
            { path: 'package.json', type: 'file', description: 'Project dependencies' },
            { path: 'vite.config.ts', type: 'file', description: 'Vite configuration' },
            { path: 'tsconfig.json', type: 'file', description: 'TypeScript configuration' },
            { path: 'index.html', type: 'file', description: 'HTML entry point' },
            { path: 'src/main.tsx', type: 'file', description: 'Application entry' },
            { path: 'src/App.tsx', type: 'file', description: 'Root component' },
            { path: 'src/App.css', type: 'file', description: 'App styles' },
            { path: 'src/components/', type: 'directory', description: 'React components' },
            { path: 'src/hooks/', type: 'directory', description: 'Custom hooks' },
            { path: 'src/utils/', type: 'directory', description: 'Utilities' },
            { path: 'public/', type: 'directory', description: 'Static assets' },
          ],
        }, null, 2),

        'express': JSON.stringify({
          project: { type: 'express', description },
          files: [
            { path: 'package.json', type: 'file', description: 'Project dependencies' },
            { path: 'tsconfig.json', type: 'file', description: 'TypeScript configuration' },
            { path: 'src/index.ts', type: 'file', description: 'Server entry point' },
            { path: 'src/app.ts', type: 'file', description: 'Express app setup' },
            { path: 'src/routes/', type: 'directory', description: 'API routes' },
            { path: 'src/middleware/', type: 'directory', description: 'Custom middleware' },
            { path: 'src/controllers/', type: 'directory', description: 'Route controllers' },
            { path: 'src/models/', type: 'directory', description: 'Data models' },
            { path: 'src/utils/', type: 'directory', description: 'Utilities' },
            { path: '.env', type: 'file', description: 'Environment variables' },
          ],
        }, null, 2),

        'python': JSON.stringify({
          project: { type: 'python', description },
          files: [
            { path: 'requirements.txt', type: 'file', description: 'Python dependencies' },
            { path: 'pyproject.toml', type: 'file', description: 'Project configuration' },
            { path: 'README.md', type: 'file', description: 'Project documentation' },
            { path: 'src/', type: 'directory', description: 'Source code' },
            { path: 'src/__init__.py', type: 'file', description: 'Package init' },
            { path: 'src/main.py', type: 'file', description: 'Application entry point' },
            { path: 'tests/', type: 'directory', description: 'Test files' },
            { path: 'tests/__init__.py', type: 'file', description: 'Tests init' },
            { path: '.env', type: 'file', description: 'Environment variables' },
          ],
        }, null, 2),

        'html': JSON.stringify({
          project: { type: 'html', description },
          files: [
            { path: 'index.html', type: 'file', description: 'Main HTML page' },
            { path: 'styles.css', type: 'file', description: 'CSS styles' },
            { path: 'script.js', type: 'file', description: 'JavaScript code' },
            { path: 'assets/', type: 'directory', description: 'Images and assets' },
          ],
        }, null, 2),

        'vue': JSON.stringify({
          project: { type: 'vue', description },
          files: [
            { path: 'package.json', type: 'file', description: 'Project dependencies' },
            { path: 'vite.config.ts', type: 'file', description: 'Vite configuration' },
            { path: 'tsconfig.json', type: 'file', description: 'TypeScript configuration' },
            { path: 'index.html', type: 'file', description: 'HTML entry point' },
            { path: 'src/main.ts', type: 'file', description: 'Application entry' },
            { path: 'src/App.vue', type: 'file', description: 'Root component' },
            { path: 'src/components/', type: 'directory', description: 'Vue components' },
            { path: 'src/views/', type: 'directory', description: 'Page views' },
            { path: 'src/stores/', type: 'directory', description: 'Pinia stores' },
            { path: 'src/router/', type: 'directory', description: 'Vue Router' },
            { path: 'src/assets/', type: 'directory', description: 'Static assets' },
          ],
        }, null, 2),
      };

      // Check for template match
      for (const [key, template] of Object.entries(templates)) {
        if (typeLower.includes(key)) {
          return `Generated file structure for ${key} project based on: "${description}"\n\n${template}`;
        }
      }

      // Default: generate a general-purpose structure
      const defaultStructure = JSON.stringify(
        {
          project: { type: 'general', description },
          files: [
            { path: 'README.md', type: 'file', description: 'Project documentation' },
            { path: 'package.json', type: 'file', description: 'Project dependencies' },
            { path: 'src/', type: 'directory', description: 'Source code' },
            { path: 'src/index.ts', type: 'file', description: 'Entry point' },
            { path: 'src/utils/', type: 'directory', description: 'Utility functions' },
            { path: 'tests/', type: 'directory', description: 'Test files' },
            { path: '.env.example', type: 'file', description: 'Example environment variables' },
          ],
        },
        null,
        2
      );

      return `[FILE_STRUCTURE_GENERATED]
Based on the description: "${description}"

${defaultStructure}

Note: For more customized file structures, the AI model can generate specific project scaffolding through conversation.]`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error generating file structure: ${msg}`;
    }
  },
  {
    name: 'generate_file_structure',
    description:
      'Generate a complete project file tree structure based on a description. Supports templates for common project types (next.js, react, express, python, html, vue). Returns a JSON representation of the file tree.',
    schema: z.object({
      description: z.string().describe('Description of the project to scaffold'),
      project_type: z
        .string()
        .optional()
        .describe('Type of project (e.g., "next.js", "react", "express", "python", "html", "vue")'),
    }),
  }
);
