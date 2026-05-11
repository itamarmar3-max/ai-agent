/**
 * Long-term persistent memory stored on the filesystem.
 * Persists facts, user preferences, and project patterns across sessions.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getMemoryDir } from '../workspace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LongTermMemory {
  facts: Array<{ key: string; value: string; timestamp: number }>;
  userPreferences: Record<string, string>;
  projectPatterns: string[];
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getLongTermFile(): string {
  return path.join(getMemoryDir(), 'long_term.json');
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function createDefaultMemory(): LongTermMemory {
  return {
    facts: [],
    userPreferences: {},
    projectPatterns: [],
    lastUpdated: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Loads long-term memory from disk. Returns defaults if the file does not exist.
 */
export async function loadLongTermMemory(): Promise<LongTermMemory> {
  try {
    const raw = await readFile(getLongTermFile(), 'utf-8');
    const parsed = JSON.parse(raw) as LongTermMemory;
    return {
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      userPreferences: parsed.userPreferences ?? {},
      projectPatterns: Array.isArray(parsed.projectPatterns) ? parsed.projectPatterns : [],
      lastUpdated: parsed.lastUpdated ?? Date.now(),
    };
  } catch {
    return createDefaultMemory();
  }
}

/**
 * Writes long-term memory to disk. Creates the directory if it does not exist.
 */
export async function saveLongTermMemory(memory: LongTermMemory): Promise<void> {
  try {
    const memDir = getMemoryDir();
    await mkdir(memDir, { recursive: true });
    memory.lastUpdated = Date.now();
    await writeFile(getLongTermFile(), JSON.stringify(memory, null, 2), 'utf-8');
  } catch (err) {
    throw new Error(
      `Failed to save long-term memory: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Adds or updates a fact in long-term memory.
 */
export async function addFact(key: string, value: string): Promise<void> {
  const memory = await loadLongTermMemory();
  const existingIndex = memory.facts.findIndex((f) => f.key === key);

  if (existingIndex >= 0) {
    memory.facts[existingIndex] = { key, value, timestamp: Date.now() };
  } else {
    memory.facts.push({ key, value, timestamp: Date.now() });
  }

  await saveLongTermMemory(memory);
}

/**
 * Retrieves a fact by key. Returns null if not found.
 */
export async function getFact(key: string): Promise<string | null> {
  const memory = await loadLongTermMemory();
  const fact = memory.facts.find((f) => f.key === key);
  return fact ? fact.value : null;
}

/**
 * Gets a user preference by key.
 */
export async function getUserPreference(key: string): Promise<string | undefined> {
  const memory = await loadLongTermMemory();
  return memory.userPreferences[key];
}

/**
 * Sets a user preference.
 */
export async function setUserPreference(key: string, value: string): Promise<void> {
  const memory = await loadLongTermMemory();
  memory.userPreferences[key] = value;
  await saveLongTermMemory(memory);
}

/**
 * Returns a formatted string of long-term memory for LLM context injection.
 */
export async function getMemoryContext(): Promise<string> {
  const memory = await loadLongTermMemory();
  const lines: string[] = [];

  lines.push('=== Long-Term Memory ===');
  lines.push('');

  if (memory.facts.length > 0) {
    lines.push('Known Facts:');
    for (const fact of memory.facts) {
      lines.push(`  - ${fact.key}: ${fact.value}`);
    }
    lines.push('');
  }

  const prefKeys = Object.keys(memory.userPreferences);
  if (prefKeys.length > 0) {
    lines.push('User Preferences:');
    for (const key of prefKeys) {
      lines.push(`  - ${key}: ${memory.userPreferences[key]}`);
    }
    lines.push('');
  }

  if (memory.projectPatterns.length > 0) {
    lines.push('Observed Project Patterns:');
    for (const pattern of memory.projectPatterns) {
      lines.push(`  - ${pattern}`);
    }
    lines.push('');
  }

  lines.push(`(Last updated: ${new Date(memory.lastUpdated).toISOString()})`);
  return lines.join('\n');
}
