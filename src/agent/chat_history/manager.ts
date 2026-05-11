/**
 * Chat History Manager
 *
 * Manages persistent chat sessions stored as JSON files
 * in the /workspace/chats/ directory.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CHATS_DIR = path.join(process.cwd(), 'src', 'workspace', 'chats');

export interface ChatSession {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;
  skill_used: string | null;
  project_context: string | null;
  pinned: boolean;
}

/**
 * Ensure the chats directory exists.
 */
function ensureChatsDir(): void {
  if (!fs.existsSync(CHATS_DIR)) {
    fs.mkdirSync(CHATS_DIR, { recursive: true });
  }
}

/**
 * Generate a unique chat ID.
 */
function generateChatId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Auto-generate a title from the first user message.
 */
function generateTitle(firstMessage: string): string {
  const maxLen = 60;
  const cleaned = firstMessage
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > maxLen
    ? cleaned.slice(0, maxLen) + '...'
    : cleaned;
}

/**
 * Get the file path for a chat session.
 */
function getChatPath(chatId: string): string {
  return path.join(CHATS_DIR, `${chatId}.json`);
}

/**
 * Create a new chat session.
 */
export function createChat(
  firstMessage: string,
  skill?: string | null,
  projectContext?: string | null,
): ChatSession {
  ensureChatsDir();

  const session: ChatSession = {
    id: generateChatId(),
    title: generateTitle(firstMessage),
    created_at: Date.now(),
    updated_at: Date.now(),
    messages: [],
    skill_used: skill ?? null,
    project_context: projectContext ?? null,
    pinned: false,
  };

  saveChat(session);
  return session;
}

/**
 * Save a chat session to disk.
 */
export function saveChat(session: ChatSession): void {
  ensureChatsDir();
  session.updated_at = Date.now();
  fs.writeFileSync(getChatPath(session.id), JSON.stringify(session, null, 2));
}

/**
 * Load a chat session from disk.
 */
export function loadChat(chatId: string): ChatSession | null {
  try {
    const filePath = getChatPath(chatId);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as ChatSession;
  } catch {
    return null;
  }
}

/**
 * Delete a chat session.
 */
export function deleteChat(chatId: string): boolean {
  try {
    const filePath = getChatPath(chatId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Add a message to a chat session.
 */
export function addMessageToChat(
  chatId: string,
  message: { id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: number },
): ChatSession | null {
  const session = loadChat(chatId);
  if (!session) return null;

  session.messages.push(message);
  session.updated_at = Date.now();

  // Auto-update title from first user message
  if (message.role === 'user' && session.messages.filter(m => m.role === 'user').length === 1) {
    session.title = generateTitle(message.content);
  }

  saveChat(session);
  return session;
}

/**
 * List all chat sessions.
 */
export function listChats(): ChatSession[] {
  ensureChatsDir();

  try {
    const files = fs.readdirSync(CHATS_DIR).filter(f => f.endsWith('.json'));
    const chats: ChatSession[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(CHATS_DIR, file), 'utf-8');
        const chat = JSON.parse(content) as ChatSession;
        chats.push(chat);
      } catch {
        // Skip corrupted files
      }
    }

    // Sort: pinned first, then by updated_at descending
    return chats.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updated_at - a.updated_at;
    });
  } catch {
    return [];
  }
}

/**
 * Search chats by title.
 */
export function searchChats(query: string): ChatSession[] {
  const allChats = listChats();
  const lowerQuery = query.toLowerCase();
  return allChats.filter(chat =>
    chat.title.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Rename a chat.
 */
export function renameChat(chatId: string, newTitle: string): boolean {
  const session = loadChat(chatId);
  if (!session) return false;
  session.title = newTitle;
  saveChat(session);
  return true;
}

/**
 * Toggle pin status for a chat.
 */
export function togglePin(chatId: string): boolean {
  const session = loadChat(chatId);
  if (!session) return false;
  session.pinned = !session.pinned;
  saveChat(session);
  return true;
}
