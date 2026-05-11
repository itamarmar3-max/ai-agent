/**
 * Unified memory interface.
 * Re-exports all memory modules and provides combined context access.
 */

export {
  getShortTermMemory,
  addToolOutput,
  addDecision,
  addFileCreated,
  getMemoryContext as getShortTermMemoryContext,
  clearMemory,
  shouldSummarize,
  summarizeMemory,
} from './short_term';

export type { ShortTermMemory } from './short_term';

export {
  loadLongTermMemory,
  saveLongTermMemory,
  addFact,
  getFact,
  getUserPreference,
  setUserPreference,
  getMemoryContext as getLongTermMemoryContext,
} from './long_term';

export type { LongTermMemory } from './long_term';

export {
  loadProjectContext,
  saveProjectContext,
  createProjectContext,
  updateFileStructure,
  addKeyDecision,
  addOpenTask,
  completeTask,
  getProjectContextSummary,
  listProjects,
} from './project_context';

export type { ProjectContext } from './project_context';

import { getMemoryContext as getShortTermCtx, addToolOutput as stAddToolOutput, addDecision as stAddDecision, addFileCreated as stAddFileCreated, getShortTermMemory } from './short_term';
import { getMemoryContext as getLongTermCtx, addFact } from './long_term';

/**
 * Initializes the memory system by loading long-term memory.
 * Returns a combined context string for LLM injection.
 */
export async function initializeMemory(): Promise<string> {
  const longTermCtx = await getLongTermCtx();
  return longTermCtx;
}

/**
 * Saves important short-term memory items to long-term memory.
 * Persists files created and key decisions from the current session.
 */
export async function saveSessionMemory(): Promise<void> {
  try {
    const memory = getShortTermMemory();

    // Persist files created during this session as long-term facts
    if (memory.filesCreated.length > 0) {
      for (const filePath of memory.filesCreated) {
        await addFact(`file_${filePath}`, `Created during session`);
      }
    }

    // Persist key decisions as long-term facts
    if (memory.decisions.length > 0) {
      // Only save the last 10 decisions to avoid bloat
      const recentDecisions = memory.decisions.slice(-10);
      for (const decision of recentDecisions) {
        await addFact(`decision_${Date.now()}`, decision);
      }
    }
  } catch {
    // Non-critical — long-term memory persistence failures are silently ignored
  }
}

/**
 * Combines short-term and long-term memory contexts into a single string
 * for injection into the LLM context.
 */
export async function getFullMemoryContext(): Promise<string> {
  const shortTermCtx = getShortTermCtx();
  const longTermCtx = await getLongTermCtx();

  const parts: string[] = [];

  if (longTermCtx) {
    parts.push(longTermCtx);
  }

  if (shortTermCtx) {
    parts.push(shortTermCtx);
  }

  if (parts.length === 0) {
    return '';
  }

  return parts.join('\n\n');
}
