'use client';

import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type DragEvent } from 'react';
import {
  Send, Square, Settings, Paperclip, FolderArchive, X, FileText, Image as ImageIcon,
  Zap, Sparkles, Brain, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AttachedFile } from '@/types';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'kt',
  'css', 'html', 'xml', 'yaml', 'yml', 'toml', 'csv', 'log', 'env', 'sh', 'bat',
  'sql', 'graphql', 'prisma', 'svelte', 'vue', 'rb', 'php', 'c', 'cpp', 'h', 'hpp',
]);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif',
]);

const MAX_TEXT_BYTES = 200_000;     // 200 KB
const MAX_IMAGE_BYTES = 4_000_000;  // 4 MB
const MAX_ATTACHED_FILES = 8;

function getFileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface ChatInputProps {
  onSend: (message: string, attachments: AttachedFile[]) => void;
  onStop: () => void;
}

type Mode = 'auto' | 'quick' | 'smart' | 'deep';
const MODE_CONFIG: Record<Mode, { label: string; description: string; icon: typeof Zap; color: string }> = {
  auto:  { label: 'Auto',  description: 'Decide automatically based on the message', icon: Sparkles, color: 'var(--ds-accent)' },
  quick: { label: 'Quick', description: 'Fast chat — skips planning',                icon: Zap,      color: 'var(--ds-success)' },
  smart: { label: 'Smart', description: 'Plans tasks before executing',              icon: Sparkles, color: 'var(--ds-accent)' },
  deep:  { label: 'Deep',  description: 'Multi-agent planning for complex work',     icon: Brain,    color: '#a855f7' },
};

export function ChatInput({ onSend, onStop }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [zipUploading, setZipUploading] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const modeRef = useRef<HTMLDivElement>(null);

  const isStreaming = useChatStore((s) => s.isStreaming);
  const settings = useChatStore((s) => s.settings);
  const toggleSettings = useChatStore((s) => s.toggleSettings);
  const hasApiKey = settings.primaryApi.apiKey.length > 0;
  const attachedFiles = useChatStore((s) => s.attachedFiles);
  const addAttachedFile = useChatStore((s) => s.addAttachedFile);
  const removeAttachedFile = useChatStore((s) => s.removeAttachedFile);
  const clearAttachedFiles = useChatStore((s) => s.clearAttachedFiles);
  const setConnectedProject = useChatStore((s) => s.setConnectedProject);
  const responseMode = useChatStore((s) => s.responseMode);
  const setResponseMode = useChatStore((s) => s.setResponseMode);

  // Close mode menu on outside click
  useEffect(() => {
    if (!modeMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [modeMenuOpen]);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 220;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  const processFile = useCallback(async (file: File): Promise<void> => {
    if (attachedFiles.length >= MAX_ATTACHED_FILES) {
      toast.error('Too many files', { description: `Max ${MAX_ATTACHED_FILES} attachments at a time.` });
      return;
    }
    if (attachedFiles.some((f) => f.name === file.name)) {
      toast.message(`Skipped: ${file.name}`, { description: 'Already attached' });
      return;
    }

    const ext = getFileExtension(file.name);
    const isImage = IMAGE_EXTENSIONS.has(ext) || file.type.startsWith('image/');
    const isText = TEXT_EXTENSIONS.has(ext) || file.type.startsWith('text/') ||
      file.type === 'application/json' || file.type === 'application/xml';

    if (isImage) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name} too large`, { description: `Images capped at ${formatBytes(MAX_IMAGE_BYTES)}.` });
        return;
      }
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = () => {
          addAttachedFile({
            name: file.name,
            content: reader.result as string,
            type: 'image',
            size: file.size,
          });
          resolve();
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(file);
      });
      return;
    }

    if (!isText) {
      toast.error(`Cannot attach ${file.name}`, {
        description: 'Only text and image files are supported. ZIPs use the project button.',
      });
      return;
    }

    const reader = new FileReader();
    await new Promise<void>((resolve) => {
      reader.onload = () => {
        let content = reader.result as string;
        const truncated = content.length > MAX_TEXT_BYTES;
        if (truncated) {
          content = content.slice(0, MAX_TEXT_BYTES) + '\n\n... [truncated]';
        }
        addAttachedFile({
          name: file.name,
          content,
          type: 'text',
          size: file.size,
        });
        if (truncated) {
          toast.message(`${file.name} truncated`, { description: `Kept first ${formatBytes(MAX_TEXT_BYTES)}.` });
        }
        resolve();
      };
      reader.onerror = () => resolve();
      reader.readAsText(file);
    });
  }, [attachedFiles, addAttachedFile]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        await processFile(file);
      }
      e.target.value = '';
    },
    [processFile],
  );

  const handleZipUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setZipUploading(true);
      try {
        const formData = new FormData();
        formData.append('action', 'upload_zip');
        formData.append('project', file.name.replace(/\.zip$/i, ''));
        formData.append('zip', file);

        const res = await fetch('/api/project', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(err.error || 'Upload failed');
        }

        const data = await res.json();
        const projectName = data.projectName || file.name.replace(/\.zip$/i, '');
        setConnectedProject(projectName);
        toast.success('Project connected', { description: projectName });
      } catch (err) {
        toast.error('Failed to upload ZIP', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setZipUploading(false);
        e.target.value = '';
      }
    },
    [setConnectedProject],
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    if (isStreaming) return;

    // Snapshot attachments before clearing so they can be (a) inlined into the
    // model-visible text and (b) rendered as cards on the user's message.
    const sentAttachments = attachedFiles.slice();

    let messageContent = trimmed;
    if (sentAttachments.length > 0) {
      const fileParts = sentAttachments
        .map((f) =>
          f.type === 'image'
            ? `[Image attached: ${f.name}]\n`
            : `[File: ${f.name}]\n\`\`\`\n${f.content}\n\`\`\`\n\n`,
        )
        .join('');
      messageContent = fileParts + (trimmed ? `\n${trimmed}` : '');
      clearAttachedFiles();
    }

    if (!messageContent.trim() && sentAttachments.length === 0) return;

    onSend(messageContent, sentAttachments);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, onSend, attachedFiles, clearAttachedFiles]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      adjustHeight();
    },
    [adjustHeight],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await processFile(file);
          }
        }
      }
    },
    [processFile],
  );

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer?.types?.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      const files = Array.from(e.dataTransfer?.files || []);
      for (const file of files) {
        if (/\.zip$/i.test(file.name)) {
          toast.message(`${file.name}: use the project button`, {
            description: 'ZIPs upload as connected projects, not attachments.',
          });
          continue;
        }
        await processFile(file);
      }
    },
    [processFile],
  );

  if (!hasApiKey) {
    return (
      <div
        className="px-4 py-6"
        style={{ borderTop: '1px solid var(--ds-border)', background: 'var(--ds-bg-secondary)' }}
      >
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <p className="text-sm" style={{ color: 'var(--ds-text-secondary)' }}>
            Configure your API key to start chatting with the AI agent.
          </p>
          <Button
            onClick={toggleSettings}
            className="gap-2 rounded-lg text-white shadow-md"
            style={{ background: 'var(--ds-gradient-accent)', border: 'none' }}
          >
            <Settings className="w-4 h-4" />
            Configure API Key
          </Button>
        </div>
      </div>
    );
  }

  const currentMode = MODE_CONFIG[responseMode];
  const ModeIcon = currentMode.icon;

  return (
    <div
      className="px-4 py-3"
      style={{
        borderTop: '1px solid var(--ds-border)',
        background: 'var(--ds-bg-secondary)',
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-4xl mx-auto">
        <div className="relative">
          {isDragging && (
            <div className="drop-overlay">
              <div className="text-center">
                <Paperclip className="w-7 h-7 mx-auto mb-2" style={{ color: 'var(--ds-accent)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--ds-accent)' }}>
                  Drop files to attach
                </p>
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={handleZipUpload} />

          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachedFiles.map((file) => {
                const Icon = file.type === 'image' ? ImageIcon : FileText;
                return (
                  <div
                    key={file.name}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs animate-scale-in"
                    style={{
                      background: 'var(--ds-bg-tertiary)',
                      border: '1px solid var(--ds-border)',
                      color: 'var(--ds-text-primary)',
                    }}
                  >
                    <Icon className="w-3 h-3 shrink-0" style={{ color: 'var(--ds-accent)' }} />
                    <span className="truncate max-w-[140px]">{file.name}</span>
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--ds-text-muted)' }}>
                      {formatBytes(file.size)}
                    </span>
                    <button
                      onClick={() => removeAttachedFile(file.name)}
                      className="opacity-60 hover:opacity-100 hover:text-[var(--ds-error)] transition-smooth"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div
            className="relative rounded-2xl transition-smooth surface-elevated"
            style={{
              boxShadow: 'var(--ds-shadow-sm)',
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Message the agent — drop or paste files, hit Enter to send..."
              disabled={isStreaming}
              rows={1}
              className="w-full min-h-[52px] max-h-[220px] resize-none rounded-2xl py-3.5 pl-4 pr-14 text-sm leading-relaxed bg-transparent focus:outline-none placeholder:opacity-40"
              style={{
                color: 'var(--ds-text-primary)',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
              onFocus={(e) => {
                (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'var(--ds-border-focus)';
                (e.currentTarget.parentElement as HTMLElement).style.boxShadow = 'var(--ds-shadow-glow)';
              }}
              onBlur={(e) => {
                (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'var(--ds-border)';
                (e.currentTarget.parentElement as HTMLElement).style.boxShadow = 'var(--ds-shadow-sm)';
              }}
            />

            <div className="flex items-center justify-between px-2.5 pb-2 pt-0">
              <div className="flex items-center gap-0.5">
                <button
                  className="p-1.5 rounded-md transition-smooth hover:bg-[var(--ds-bg-hover)]"
                  style={{ color: 'var(--ds-text-muted)' }}
                  title="Attach files (or drop / paste)"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded-md transition-smooth hover:bg-[var(--ds-bg-hover)] disabled:opacity-50"
                  style={{ color: 'var(--ds-text-muted)' }}
                  title="Upload project (ZIP)"
                  onClick={() => zipInputRef.current?.click()}
                  disabled={zipUploading}
                >
                  <FolderArchive className="w-4 h-4" />
                </button>

                {/* Mode selector */}
                <div ref={modeRef} className="relative">
                  <button
                    onClick={() => setModeMenuOpen((s) => !s)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-smooth hover:bg-[var(--ds-bg-hover)]"
                    style={{ color: 'var(--ds-text-secondary)' }}
                    title="Response mode"
                  >
                    <ModeIcon className="w-3.5 h-3.5" style={{ color: currentMode.color }} />
                    <span className="text-xs font-medium">{currentMode.label}</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                  {modeMenuOpen && (
                    <div
                      className="absolute bottom-full left-0 mb-2 rounded-xl py-1 min-w-[240px] animate-scale-in surface-elevated-md z-40"
                    >
                      {(['auto', 'quick', 'smart', 'deep'] as const).map((m) => {
                        const cfg = MODE_CONFIG[m];
                        const Icon = cfg.icon;
                        const selected = responseMode === m;
                        return (
                          <button
                            key={m}
                            onClick={() => {
                              setResponseMode(m);
                              setModeMenuOpen(false);
                            }}
                            className={cn(
                              'flex items-start gap-2.5 w-full text-left px-3 py-2 transition-smooth',
                              'hover:bg-[var(--ds-bg-hover)]',
                            )}
                          >
                            <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: cfg.color }} />
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-xs font-medium flex items-center gap-1.5"
                                style={{ color: 'var(--ds-text-primary)' }}
                              >
                                {cfg.label}
                                {selected && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: cfg.color }}
                                  />
                                )}
                              </div>
                              <div className="text-[11px] mt-0.5" style={{ color: 'var(--ds-text-muted)' }}>
                                {cfg.description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-mono tabular-nums"
                  style={{ color: 'var(--ds-text-muted)' }}
                >
                  {input.length > 0 ? `${input.length}` : ''}
                </span>
                {isStreaming ? (
                  <button
                    onClick={onStop}
                    className="flex items-center justify-center w-8 h-8 rounded-xl transition-smooth shadow-sm hover:scale-105"
                    style={{ background: 'var(--ds-error)', color: 'white' }}
                    title="Stop"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() && attachedFiles.length === 0}
                    className="flex items-center justify-center w-8 h-8 rounded-xl transition-smooth disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100"
                    style={{
                      background:
                        (input.trim() || attachedFiles.length > 0)
                          ? 'var(--ds-gradient-accent)'
                          : 'var(--ds-bg-tertiary)',
                      color: 'white',
                      border: 'none',
                      opacity: (input.trim() || attachedFiles.length > 0) ? 1 : 0.5,
                      boxShadow: (input.trim() || attachedFiles.length > 0)
                        ? '0 4px 12px -2px var(--ds-accent-glow-strong)'
                        : 'none',
                    }}
                    title="Send (Enter)"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <p
          className="text-[11px] mt-2 text-center select-none"
          style={{ color: 'var(--ds-text-muted)' }}
        >
          Enter to send · Shift+Enter for newline ·
          <kbd
            className="ml-1 px-1 py-0.5 rounded text-[10px]"
            style={{ background: 'var(--ds-bg-tertiary)', border: '1px solid var(--ds-border)' }}
          >
            Ctrl+/
          </kbd>{' '}
          to focus
        </p>
      </div>
    </div>
  );
}
