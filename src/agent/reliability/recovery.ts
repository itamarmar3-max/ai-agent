/**
 * SessionRecovery - Persists agent session state and provides recovery utilities.
 *
 * Uses localStorage on the client side or in-memory fallback on server.
 * Automatically saves state at a configurable interval (default 30 s)
 * and exposes helpers for checking, loading, and clearing sessions.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'agent-session-state';
const TIMESTAMP_KEY = 'agent-session-state-timestamp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

// In-memory fallback for server-side
const memoryStore = new Map<string, string>();

function storageGet(key: string): string | null {
  if (isClient()) {
    return localStorage.getItem(key);
  }
  return memoryStore.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  if (isClient()) {
    localStorage.setItem(key, value);
  } else {
    memoryStore.set(key, value);
  }
}

function storageRemove(key: string): void {
  if (isClient()) {
    localStorage.removeItem(key);
  } else {
    memoryStore.delete(key);
  }
}

// ---------------------------------------------------------------------------
// SessionRecovery
// ---------------------------------------------------------------------------

export class SessionRecovery {
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  // ── public API ──────────────────────────────────────────────────────────

  /**
   * Save the current agent state.
   */
  saveState(state: object): void {
    try {
      const serialized = JSON.stringify(state);
      storageSet(STORAGE_KEY, serialized);
      storageSet(TIMESTAMP_KEY, String(Date.now()));
    } catch (err: unknown) {
      if (isClient() && err instanceof DOMException && err.name === 'QuotaExceededError') {
        console.warn('[SessionRecovery] localStorage quota exceeded – clearing old state.');
        this.clearState();
        try {
          storageSet(STORAGE_KEY, JSON.stringify(state));
          storageSet(TIMESTAMP_KEY, String(Date.now()));
        } catch {
          // Give up silently
        }
      }
    }
  }

  /**
   * Load the persisted session state, or `null` if none exists.
   */
  loadState(): object | null {
    try {
      const raw = storageGet(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as object;
    } catch {
      return null;
    }
  }

  /**
   * Check whether there is an unfinished session saved.
   */
  hasUnfinishedSession(): boolean {
    return storageGet(STORAGE_KEY) !== null;
  }

  /**
   * Clear the persisted session state.
   */
  clearState(): void {
    storageRemove(STORAGE_KEY);
    storageRemove(TIMESTAMP_KEY);
  }

  /**
   * How old the saved state is in milliseconds, or `null` if no state saved.
   */
  getStateAge(): number | null {
    const ts = storageGet(TIMESTAMP_KEY);
    if (!ts) return null;
    const savedAt = parseInt(ts, 10);
    if (Number.isNaN(savedAt)) return null;
    return Date.now() - savedAt;
  }

  /**
   * Start auto-saving at a fixed interval.
   *
   * @param getState  A function that returns the current state object.
   * @param intervalMs  Interval in milliseconds (default 30 000 ms = 30 s).
   * @returns A cleanup function that stops auto-save when called.
   */
  startAutoSave(getState: () => object, intervalMs: number = 30_000): () => void {
    // Clear any previous timer
    this.stopAutoSave();

    this.autoSaveTimer = setInterval(() => {
      try {
        const state = getState();
        this.saveState(state);
      } catch {
        // getState() threw – skip this cycle
      }
    }, intervalMs);

    // Also listen for beforeunload so we save on page close (client only)
    const handleUnload = isClient()
      ? () => {
          try {
            const state = getState();
            this.saveState(state);
          } catch {
            // ignore
          }
        }
      : null;

    if (handleUnload) {
      window.addEventListener('beforeunload', handleUnload);
    }

    // Return cleanup function
    return () => {
      this.stopAutoSave();
      if (handleUnload) {
        window.removeEventListener('beforeunload', handleUnload);
      }
    };
  }

  /**
   * Stop auto-save if it is running.
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const sessionRecovery = new SessionRecovery();
