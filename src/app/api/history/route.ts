import { NextResponse } from 'next/server';
import { listChats, createChat, loadChat, deleteChat, renameChat, togglePin, searchChats, addMessageToChat } from '@/agent/chat_history/manager';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const query = url.searchParams.get('q');
  const id = url.searchParams.get('id');

  try {
    if (action === 'search' && query) {
      const results = searchChats(query);
      return NextResponse.json({ chats: results });
    }

    if (action === 'load' && id) {
      const chat = loadChat(id);
      if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
      return NextResponse.json({ chat });
    }

    if (action === 'delete' && id) {
      const success = deleteChat(id);
      return NextResponse.json({ success });
    }

    if (action === 'rename' && id) {
      const newTitle = url.searchParams.get('title');
      if (!newTitle) return NextResponse.json({ error: 'Title required' }, { status: 400 });
      const success = renameChat(id, newTitle);
      return NextResponse.json({ success });
    }

    if (action === 'pin' && id) {
      const success = togglePin(id);
      return NextResponse.json({ success });
    }

    // Default: list all chats
    const chats = listChats();
    return NextResponse.json({ chats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, chatId, message, messages, skill, projectContext, title } = body;

    // Create with full messages array
    if (action === 'create' && messages) {
      const firstMessage = messages[0]?.content || 'New Chat';
      const chatTitle = title || firstMessage.slice(0, 60) || 'New Chat';
      const chat = createChat(firstMessage, skill, projectContext);
      // Store all messages in the chat
      let updated = chat;
      for (const msg of messages) {
        updated = addMessageToChat(chat.id, msg) || updated;
      }
      return NextResponse.json({ chat: updated, chatId: chat.id });
    }

    // Add multiple messages to existing chat
    if (action === 'addMessages' && chatId && messages) {
      let updated: import('@/agent/chat_history/manager').ChatSession | null = null;
      for (const msg of messages) {
        updated = addMessageToChat(chatId, msg);
      }
      if (!updated) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
      return NextResponse.json({ chat: updated });
    }

    // Backward compat: create without messages
    if (action === 'create') {
      const firstMessage = message || 'New Chat';
      const chat = createChat(firstMessage, skill, projectContext);
      return NextResponse.json({ chat });
    }

    // Backward compat: add single message
    if (action === 'add_message' && chatId && message) {
      const updated = addMessageToChat(chatId, message);
      if (!updated) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
      return NextResponse.json({ chat: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
