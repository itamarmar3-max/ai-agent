/**
 * Per-project context memory.
 * Each project gets its own JSON file in the workspace memory/projects directory.
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectContext {
  name: string;
  fileStructure: string[];
  techStack: string[];
  keyDecisions: Array<{ decision: string; timestamp: number }>;
  openTasks: string[];
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECTS_DIR = '/home/z/my-project/workspace/memory/projects';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function createDefaultContext(name: string): ProjectContext {
  return {
    name,
    fileStructure: [],
    techStack: [],
    keyDecisions: [],
    openTasks: [],
    lastUpdated: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Loads a project context from disk. Returns null if not found.
 */
export async function loadProjectContext(
  name: string,
): Promise<ProjectContext | null> {
  const filePath = path.join(PROJECTS_DIR, `${sanitizeFileName(name)}.json`);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as ProjectContext;
    return {
      name: parsed.name ?? name,
      fileStructure: Array.isArray(parsed.fileStructure) ? parsed.fileStructure : [],
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
      keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
      openTasks: Array.isArray(parsed.openTasks) ? parsed.openTasks : [],
      lastUpdated: parsed.lastUpdated ?? Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Saves a project context to disk.
 */
export async function saveProjectContext(
  context: ProjectContext,
): Promise<void> {
  try {
    await mkdir(PROJECTS_DIR, { recursive: true });
    context.lastUpdated = Date.now();
    const filePath = path.join(
      PROJECTS_DIR,
      `${sanitizeFileName(context.name)}.json`,
    );
    await writeFile(filePath, JSON.stringify(context, null, 2), 'utf-8');
  } catch (err) {
    throw new Error(
      `Failed to save project context: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Creates a new project context with default values.
 */
export async function createProjectContext(
  name: string,
): Promise<ProjectContext> {
  const context = createDefaultContext(name);
  await saveProjectContext(context);
  return context;
}

/**
 * Updates the file structure for a project.
 */
export async function updateFileStructure(
  name: string,
  files: string[],
): Promise<void> {
  let context = await loadProjectContext(name);
  if (!context) {
    context = createDefaultContext(name);
  }
  context.fileStructure = files;
  await saveProjectContext(context);
}

/**
 * Adds a key decision to a project.
 */
export async function addKeyDecision(
  name: string,
  decision: string,
): Promise<void> {
  let context = await loadProjectContext(name);
  if (!context) {
    context = createDefaultContext(name);
  }
  context.keyDecisions.push({ decision, timestamp: Date.now() });
  await saveProjectContext(context);
}

/**
 * Adds an open task to a project.
 */
export async function addOpenTask(
  name: string,
  task: string,
): Promise<void> {
  let context = await loadProjectContext(name);
  if (!context) {
    context = createDefaultContext(name);
  }
  if (!context.openTasks.includes(task)) {
    context.openTasks.push(task);
  }
  await saveProjectContext(context);
}

/**
 * Marks a task as completed by removing it from the open tasks list.
 */
export async function completeTask(
  name: string,
  task: string,
): Promise<void> {
  const context = await loadProjectContext(name);
  if (!context) return;

  context.openTasks = context.openTasks.filter(
    (t) => t !== task,
  );
  await saveProjectContext(context);
}

/**
 * Returns a formatted summary of a project context for LLM injection.
 * Returns null if the project does not exist.
 */
export async function getProjectContextSummary(
  name: string,
): Promise<string | null> {
  const context = await loadProjectContext(name);
  if (!context) return null;

  const lines: string[] = [];
  lines.push(`=== Project Context: ${context.name} ===`);
  lines.push('');

  if (context.techStack.length > 0) {
    lines.push(`Tech Stack: ${context.techStack.join(', ')}`);
    lines.push('');
  }

  if (context.fileStructure.length > 0) {
    lines.push('File Structure:');
    for (const f of context.fileStructure) {
      lines.push(`  ${f}`);
    }
    lines.push('');
  }

  if (context.keyDecisions.length > 0) {
    lines.push('Key Decisions:');
    for (const d of context.keyDecisions) {
      const time = new Date(d.timestamp).toLocaleDateString();
      lines.push(`  [${time}] ${d.decision}`);
    }
    lines.push('');
  }

  if (context.openTasks.length > 0) {
    lines.push('Open Tasks:');
    for (const t of context.openTasks) {
      lines.push(`  - ${t}`);
    }
    lines.push('');
  }

  lines.push(`(Last updated: ${new Date(context.lastUpdated).toISOString()})`);
  return lines.join('\n');
}

/**
 * Lists all project names by scanning the projects directory.
 */
export async function listProjects(): Promise<string[]> {
  try {
    await mkdir(PROJECTS_DIR, { recursive: true });
    const files = await readdir(PROJECTS_DIR);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}
