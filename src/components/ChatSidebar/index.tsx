'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDistanceToNow, isToday, isYesterday, differenceInDays } from 'date-fns';
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Pin,
  PinOff,
  Clock,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatHistoryItem {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  skill_used: string | null;
  pinned: boolean;
  message_count?: number;
}

interface ChatSidebarProps {
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a timestamp into a human-readable relative string. */
function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: false }) + ' ago';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  const diffDays = differenceInDays(now, date);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  if (diffDays < 30) {
    return `${Math.floor(diffDays / 7)}w ago`;
  }
  return formatDistanceToNow(date, { addSuffix: true });
}

type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Older';

function getDateGroup(timestamp: number): DateGroup {
  const date = new Date(timestamp);
  const now = new Date();
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (differenceInDays(now, date) < 7) return 'This Week';
  return 'Older';
}

/** Map of skill names to display info (icon + color). */
const SKILL_MAP: Record<string, { icon: string; label: string; color: string }> = {
  'fullstack-dev': { icon: '🖥️', label: 'Fullstack', color: '#4a9eff' },
  'backend-dev': { icon: '⚙️', label: 'Backend', color: '#f5a623' },
  'code_reviewer': { icon: '🔍', label: 'Review', color: '#7c6cfc' },
  'data_analyst': { icon: '📊', label: 'Analyst', color: '#00d97e' },
  'researcher': { icon: '📚', label: 'Research', color: '#f5a623' },
  'writer': { icon: '✍️', label: 'Writer', color: '#ff4757' },
  'debugger': { icon: '🐛', label: 'Debug', color: '#ff4757' },
  'architect': { icon: '🏗️', label: 'Architect', color: '#7c6cfc' },
  'automator': { icon: '🤖', label: 'Automate', color: '#00d97e' },
  'web_dev': { icon: '🌐', label: 'Web', color: '#00d97e' },
  'android_dev': { icon: '📱', label: 'Android', color: '#00d97e' },
};

function getSkillInfo(skill: string | null) {
  if (!skill) return null;
  return SKILL_MAP[skill] ?? { icon: '⚡', label: skill, color: '#7c6cfc' };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A loading skeleton shown while fetching chat history. */
function ChatListSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-2 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5"
        >
          <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Empty state when there are no chats. */
function EmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-12 text-center">
      <div
        className="flex items-center justify-center w-12 h-12 rounded-xl mb-4"
        style={{ background: 'var(--ds-bg-tertiary)' }}
      >
        <MessageSquare className="w-5 h-5" style={{ color: 'var(--ds-text-muted)' }} />
      </div>
      <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--ds-text-primary)' }}>No chats yet</h3>
      <p className="text-xs mb-4 max-w-[200px]" style={{ color: 'var(--ds-text-secondary)' }}>
        Start a new conversation to begin building with AI
      </p>
      <Button
        size="sm"
        className="gap-1.5 text-xs text-white"
        style={{
          background: 'var(--ds-accent)',
        }}
        onClick={onNewChat}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ds-accent-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--ds-accent)'}
      >
        <Plus className="w-3.5 h-3.5" />
        New Chat
      </Button>
    </div>
  );
}

/** No search results. */
function NoResultsState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div
        className="flex items-center justify-center w-10 h-10 rounded-xl mb-3"
        style={{ background: 'var(--ds-bg-tertiary)' }}
      >
        <Search className="w-4 h-4" style={{ color: 'var(--ds-text-muted)' }} />
      </div>
      <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--ds-text-primary)' }}>No results</p>
      <p className="text-xs max-w-[180px]" style={{ color: 'var(--ds-text-secondary)' }}>
        No chats match &quot;{query}&quot;
      </p>
    </div>
  );
}

/** Section header for grouped chats. */
function GroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1">
      <span
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--ds-text-muted)' }}
      >
        {label}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}

/** Single chat row item. */
function ChatItem({
  chat,
  isActive,
  onSelect,
  onPin,
  onDelete,
}: {
  chat: ChatHistoryItem;
  isActive: boolean;
  onSelect: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const skill = getSkillInfo(chat.skill_used);
  const relativeTime = formatRelativeDate(chat.updated_at);

  const truncatedTitle = chat.title.length > 28
    ? chat.title.substring(0, 28) + '...'
    : chat.title;

  return (
    <div
      className={cn(
        'group flex items-start gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-150',
        'hover:bg-[var(--ds-bg-hover)]',
        isActive
          ? ''
          : ''
      )}
      style={{
        borderLeft: isActive ? '3px solid var(--ds-accent)' : '3px solid transparent',
        background: isActive ? 'var(--ds-bg-tertiary)' : undefined,
      }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5"
        style={{
          background: skill
            ? `${skill.color}15`
            : 'var(--ds-bg-tertiary)',
        }}
      >
        {skill ? (
          <span className="text-sm">{skill.icon}</span>
        ) : (
          <MessageSquare
            className="w-3.5 h-3.5"
            style={{ color: 'var(--ds-text-muted)' }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="text-[13px] font-medium truncate"
            style={{ color: 'var(--ds-text-primary)' }}
          >
            {truncatedTitle}
          </span>
        </div>
        <div
          className="flex items-center gap-2 text-[11px]"
          style={{ color: 'var(--ds-text-secondary)' }}
        >
          <Clock className="w-3 h-3 shrink-0" />
          <span className="truncate">{relativeTime}</span>
          {chat.message_count != null && chat.message_count > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span>{chat.message_count} msgs</span>
            </>
          )}
        </div>
      </div>

      {/* Action buttons - visible on hover / active */}
      <div
        className={cn(
          'flex items-center gap-0.5 shrink-0 mt-0.5 transition-opacity duration-150',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-6 w-6',
                chat.pinned
                  ? 'text-[var(--ds-warning)] hover:bg-[rgba(245,166,35,0.1)]'
                  : 'hover:bg-[var(--ds-bg-hover)]'
              )}
              style={{ color: chat.pinned ? 'var(--ds-warning)' : 'var(--ds-text-secondary)' }}
              onClick={(e) => {
                e.stopPropagation();
                onPin();
              }}
            >
              {chat.pinned ? (
                <Pin className="w-3 h-3 fill-current" />
              ) : (
                <PinOff className="w-3 h-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {chat.pinned ? 'Unpin chat' : 'Pin chat'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-[rgba(220,38,38,0.08)]"
              style={{ color: 'var(--ds-text-secondary)' }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Delete chat
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ChatSidebar({
  activeChatId,
  onSelectChat,
  onNewChat,
  isOpen,
  onClose,
}: ChatSidebarProps) {
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChatHistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingPin, setIsTogglingPin] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------------
  // Fetch chats
  // -----------------------------------------------------------------------
  const fetchChats = useCallback(async (query?: string) => {
    setIsLoading(true);
    try {
      const url = query
        ? `/api/history?action=search&q=${encodeURIComponent(query)}`
        : '/api/history?action=list';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch chats');
      const data = await res.json();
      setChats(data.chats ?? []);
    } catch {
      setChats([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh whenever sidebar opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      fetchChats();
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, fetchChats]);

  // -----------------------------------------------------------------------
  // Client-side filtering (applied on top of search API results)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
      return;
    }
    const lower = searchQuery.toLowerCase();
    setFilteredChats(
      chats.filter((c) => c.title.toLowerCase().includes(lower))
    );
  }, [chats, searchQuery]);

  // -----------------------------------------------------------------------
  // Search with debounce (hits server API for search, falls back to local)
  // -----------------------------------------------------------------------
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim()) {
        debounceRef.current = setTimeout(() => {
          fetchChats(value.trim());
        }, 300);
      } else {
        fetchChats();
      }
    },
    [fetchChats]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // -----------------------------------------------------------------------
  // Pin / Unpin
  // -----------------------------------------------------------------------
  const handleTogglePin = useCallback(
    async (chat: ChatHistoryItem) => {
      setIsTogglingPin(chat.id);
      try {
        const res = await fetch(
          `/api/history?action=pin&id=${encodeURIComponent(chat.id)}`
        );
        if (res.ok) {
          setChats((prev) =>
            prev
              .map((c) =>
                c.id === chat.id ? { ...c, pinned: !c.pinned } : c
              )
              .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return b.updated_at - a.updated_at;
              })
          );
        }
      } catch {
        // Silently fail — user can retry
      } finally {
        setIsTogglingPin(null);
      }
    },
    []
  );

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/history?action=delete&id=${encodeURIComponent(deleteTarget.id)}`
      );
      if (res.ok) {
        setChats((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      }
    } catch {
      // Silently fail
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  // -----------------------------------------------------------------------
  // Group chats: pinned first, then by date group
  // -----------------------------------------------------------------------
  const pinnedChats = filteredChats.filter((c) => c.pinned);
  const unpinnedChats = filteredChats.filter((c) => !c.pinned);

  const groupedUnpinned: { group: DateGroup; items: ChatHistoryItem[] }[] = [];
  const groupOrder: DateGroup[] = ['Today', 'Yesterday', 'This Week', 'Older'];
  for (const group of groupOrder) {
    const items = unpinnedChats.filter((c) => getDateGroup(c.updated_at) === group);
    if (items.length > 0) {
      groupedUnpinned.push({ group, items });
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <>
      <aside
        className={cn(
          'flex flex-col h-full transition-transform duration-200 ease-in-out',
          'w-[260px] shrink-0',
          'md:relative md:translate-x-0',
          isOpen
            ? 'translate-x-0'
            : 'absolute inset-y-0 left-0 -translate-x-full z-40'
        )}
        style={{ background: 'var(--ds-bg-secondary)' }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Header: New Chat + Close (mobile) */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center justify-between px-3 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center w-5 h-5 rounded"
              style={{
                background: 'var(--ds-accent-glow)',
                border: '1px solid rgba(37,99,235,0.25)',
              }}
            >
              <Sparkles className="w-3 h-3" style={{ color: 'var(--ds-accent)' }} />
            </div>
            <h2
              className="text-sm font-semibold tracking-tight"
              style={{ color: 'var(--ds-text-primary)' }}
            >
              Chats
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              className="gap-1.5 text-xs text-white rounded-lg"
              style={{ background: 'var(--ds-accent)' }}
              onClick={onNewChat}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ds-accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--ds-accent)'}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New</span>
              <kbd
                className="hidden lg:inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ background: 'rgba(255,255,255,0.15)' }}
                title="New chat shortcut"
              >
                K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:hidden"
              style={{ color: 'var(--ds-text-secondary)' }}
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Search */}
        {/* ---------------------------------------------------------------- */}
        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--ds-text-muted)' }} />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-8 pl-8 pr-8 text-xs rounded-lg"
              style={{
                background: 'var(--ds-bg-tertiary)',
                border: '1px solid var(--ds-border)',
                color: 'var(--ds-text-primary)',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--ds-text-secondary)' }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <Separator />

        {/* ---------------------------------------------------------------- */}
        {/* Chat list */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex-1 min-h-0 relative">
          {isLoading ? (
            <ChatListSkeleton />
          ) : filteredChats.length === 0 && searchQuery.trim() ? (
            <NoResultsState query={searchQuery} />
          ) : filteredChats.length === 0 ? (
            <EmptyState onNewChat={onNewChat} />
          ) : (
            <ScrollArea className="h-full">
              <div className="px-2 py-1">
                {/* Pinned section */}
                {pinnedChats.length > 0 && (
                  <>
                    <GroupHeader label="Pinned" />
                    <div className="flex flex-col gap-0.5">
                      {pinnedChats.map((chat) => (
                        <ChatItem
                          key={chat.id}
                          chat={chat}
                          isActive={chat.id === activeChatId}
                          onSelect={() => {
                            fetch(`/api/history?action=load&id=${chat.id}`)
                              .then(res => res.json())
                              .then(data => {
                                if (data.chat?.messages) {
                                  useChatStore.getState().setMessages(data.chat.messages);
                                }
                                useChatStore.getState().setActiveChatId(chat.id);
                              })
                              .catch(() => {
                                useChatStore.getState().setActiveChatId(chat.id);
                              });
                            onClose();
                          }}
                          onPin={() => handleTogglePin(chat)}
                          onDelete={() => setDeleteTarget(chat)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Unpinned, grouped by date */}
                {groupedUnpinned.map(({ group, items }) => (
                  <div key={group}>
                    <GroupHeader label={group} />
                    <div className="flex flex-col gap-0.5">
                      {items.map((chat) => (
                        <ChatItem
                          key={chat.id}
                          chat={chat}
                          isActive={chat.id === activeChatId}
                          onSelect={() => {
                            fetch(`/api/history?action=load&id=${chat.id}`)
                              .then(res => res.json())
                              .then(data => {
                                if (data.chat?.messages) {
                                  useChatStore.getState().setMessages(data.chat.messages);
                                }
                                useChatStore.getState().setActiveChatId(chat.id);
                              })
                              .catch(() => {
                                useChatStore.getState().setActiveChatId(chat.id);
                              });
                            onClose();
                          }}
                          onPin={() => handleTogglePin(chat)}
                          onDelete={() => setDeleteTarget(chat)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Loading overlay for pin toggle */}
          {isTogglingPin && (
            <div className="absolute bottom-3 left-3 z-10">
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] backdrop-blur-sm"
                style={{
                  background: 'rgba(10,10,10,0.9)',
                  border: '1px solid var(--ds-border)',
                  color: 'var(--ds-text-secondary)',
                }}
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                Updating...
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Footer */}
        {/* ---------------------------------------------------------------- */}
        {!isLoading && filteredChats.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between px-4 py-2 shrink-0">
              <span className="text-[10px]" style={{ color: 'var(--ds-text-muted)' }}>
                {filteredChats.length} chat{filteredChats.length !== 1 ? 's' : ''}
                {pinnedChats.length > 0 && (
                  <span className="ml-1">
                    · {pinnedChats.length} pinned
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ds-success)' }} />
                <span className="text-[10px]" style={{ color: 'var(--ds-text-muted)' }}>API Ready</span>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile overlay backdrop */}
      {/* ------------------------------------------------------------------ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Delete confirmation dialog */}
      {/* ------------------------------------------------------------------ */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-[380px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              Delete chat?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will permanently delete{' '}
              <span className="font-medium" style={{ color: 'var(--ds-text-primary)' }}>
                &quot;{deleteTarget?.title}&quot;
              </span>{' '}
              and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="text-white"
              style={{ background: 'var(--ds-error)' }}
            >
              {isDeleting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deleting...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ChatSidebar;
