/**
 * Project Manager
 *
 * Manages connected projects — file reading, writing, and project-level operations.
 * Supports ZIP upload, folder structure parsing, and Android project detection.
 */

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { getProjectsDir, resolveInsideRoot, sanitizeWorkspaceName } from '../workspace';

const PROJECTS_DIR = getProjectsDir();

export interface ProjectInfo {
  name: string;
  path: string;
  type: 'android' | 'web' | 'backend' | 'generic';
  fileCount: number;
  created_at: number;
  modified_at: number;
}

export interface ProjectFile {
  path: string;
  name: string;
  content: string;
  language: string;
  size: number;
  modified_at: number;
}

/**
 * Ensure projects directory exists.
 */
function ensureProjectsDir(): void {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

/**
 * Detect project type from file structure.
 */
function detectProjectType(files: string[]): 'android' | 'web' | 'backend' | 'generic' {
  const fileSet = new Set(files.map(f => f.toLowerCase()));

  // Android detection
  const androidIndicators = ['build.gradle', 'androidmanifest.xml', 'app/src/main'];
  const androidScore = androidIndicators.filter(i =>
    [...fileSet].some(f => f.includes(i))
  ).length;
  if (androidScore >= 2) return 'android';

  // Web detection
  const webIndicators = ['next.config', 'package.json', 'index.html', 'app/page.tsx', 'tailwind.config'];
  const webScore = webIndicators.filter(i =>
    [...fileSet].some(f => f.includes(i))
  ).length;
  if (webScore >= 2) return 'web';

  // Backend detection
  const backendIndicators = ['express', 'prisma', 'sequelize', 'typeorm'];
  if (backendIndicators.some(i => [...fileSet].some(f => f.includes(i)))) return 'backend';

  return 'generic';
}

/**
 * Get all files in a directory recursively.
 */
function getAllFiles(dirPath: string, basePath: string = ''): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    // Skip common ignored directories
    if (['node_modules', '.git', '.next', 'dist', 'build', '__pycache__'].includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      results.push(...getAllFiles(path.join(dirPath, entry.name), relativePath));
    } else {
      results.push(relativePath);
    }
  }

  return results;
}

/**
 * Extract a ZIP file to a project directory.
 */
export function extractZipProject(zipBuffer: Buffer, projectName: string): ProjectInfo {
  ensureProjectsDir();

  const safeProjectName = sanitizeWorkspaceName(projectName, 'project name');
  const projectPath = path.join(PROJECTS_DIR, safeProjectName);

  if (fs.existsSync(projectPath)) {
    fs.rmSync(projectPath, { recursive: true });
  }

  const zip = new AdmZip(zipBuffer);
  for (const entry of zip.getEntries()) {
    const normalizedEntry = entry.entryName.replace(/\\/g, '/');
    if (normalizedEntry.startsWith('/') || normalizedEntry.includes('../')) {
      throw new Error(`ZIP contains an unsafe path: ${entry.entryName}`);
    }
    if (!resolveInsideRoot(projectPath, normalizedEntry)) {
      throw new Error(`ZIP entry would extract outside the project: ${entry.entryName}`);
    }
  }
  zip.extractAllTo(projectPath, true);

  const files = getAllFiles(projectPath);
  const type = detectProjectType(files);

  return {
    name: safeProjectName,
    path: projectPath,
    type,
    fileCount: files.length,
    created_at: Date.now(),
    modified_at: Date.now(),
  };
}

/**
 * List all projects.
 */
export function listProjects(): ProjectInfo[] {
  ensureProjectsDir();

  try {
    const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory());

    return dirs.map(d => {
      const projectPath = path.join(PROJECTS_DIR, d.name);
      const files = getAllFiles(projectPath);
      const type = detectProjectType(files);

      return {
        name: d.name,
        path: projectPath,
        type,
        fileCount: files.length,
        created_at: fs.statSync(projectPath).birthtimeMs,
        modified_at: fs.statSync(projectPath).mtimeMs,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Get a file's content from a project.
 */
export function getProjectFile(projectName: string, filePath: string): ProjectFile | null {
  try {
    const safeProjectName = sanitizeWorkspaceName(projectName, 'project name');
    const projectPath = path.join(PROJECTS_DIR, safeProjectName);
    const fullPath = resolveInsideRoot(projectPath, filePath);
    if (!fullPath) return null;

    if (!fs.existsSync(fullPath)) return null;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const languageMap: Record<string, string> = {
      kt: 'kotlin', kts: 'kotlin', java: 'java', xml: 'xml',
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', md: 'markdown', json: 'json', yaml: 'yaml', yml: 'yaml',
      html: 'html', css: 'css', sql: 'sql', sh: 'shell',
      gradle: 'groovy', properties: 'properties',
    };

    return {
      path: filePath,
      name: filePath.split('/').pop() ?? filePath,
      content,
      language: languageMap[ext] ?? 'plaintext',
      size: Buffer.byteLength(content),
      modified_at: fs.statSync(fullPath).mtimeMs,
    };
  } catch {
    return null;
  }
}

/**
 * Save a file in a project.
 */
export function saveProjectFile(projectName: string, filePath: string, content: string): boolean {
  try {
    const safeProjectName = sanitizeWorkspaceName(projectName, 'project name');
    const projectPath = path.join(PROJECTS_DIR, safeProjectName);
    const fullPath = resolveInsideRoot(projectPath, filePath);
    if (!fullPath) return false;

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a file in a project.
 */
export function deleteProjectFile(projectName: string, filePath: string): boolean {
  try {
    const safeProjectName = sanitizeWorkspaceName(projectName, 'project name');
    const projectPath = path.join(PROJECTS_DIR, safeProjectName);
    const fullPath = resolveInsideRoot(projectPath, filePath);
    if (!fullPath) return false;

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get the file tree for a project.
 */
export function getProjectTree(projectName: string): Array<{
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: Array<{ name: string; path: string; type: 'file' | 'directory'; children?: any[] }>;
}> {
  try {
    const safeProjectName = sanitizeWorkspaceName(projectName, 'project name');
    const projectPath = path.join(PROJECTS_DIR, safeProjectName);

    if (!fs.existsSync(projectPath)) return [];

    return buildTree(projectPath, '');
  } catch {
    return [];
  }
}

function buildTree(dirPath: string, basePath: string): any[] {
  const results: any[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => !['node_modules', '.git', '.next', 'dist', 'build', '__pycache__'].includes(e.name))
      .sort((a, b) => {
        // Directories first, then files
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of entries) {
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const children = buildTree(path.join(dirPath, entry.name), relativePath);
        if (children.length > 0) {
          results.push({
            name: entry.name,
            path: relativePath,
            type: 'directory',
            children,
          });
        }
      } else {
        results.push({
          name: entry.name,
          path: relativePath,
          type: 'file',
        });
      }
    }
  } catch {
    // Ignore permission errors
  }

  return results;
}

/**
 * Delete an entire project.
 */
export function deleteProject(projectName: string): boolean {
  try {
    const safeProjectName = sanitizeWorkspaceName(projectName, 'project name');
    const projectPath = path.join(PROJECTS_DIR, safeProjectName);

    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
