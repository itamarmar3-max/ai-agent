'use client';

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Send, Square, Settings, Paperclip, FolderOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useChatStore } from '@/lib/store';
import { toast } from 'sonner';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'kt',
  'css', 'html', 'xml', 'yaml', 'yml', 'toml', 'csv', 'log', 'env', 'sh', 'bat',
  'sql', 'graphql', 'prisma',
]);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp',
]);

function getFileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
}

export function ChatInput({ onSend, onStop }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [projectPath, setProjectPath] = useState('');
  const [connecting, setConnecting] = useState(false);

  const isStreaming = useChatStore((s) => s.isStreaming);
  const settings = useChatStore((s) => s.settings);
  const toggleSettings = useChatStore((s) => s.toggleSettings);
  const hasApiKey = settings.primaryApi.apiKey.length > 0;
  const attachedFiles = useChatStore((s) => s.attachedFiles);
  const addAttachedFile = useChatStore((s) => s.addAttachedFile);
  const removeAttachedFile = useChatStore((s) => s.removeAttachedFile);
  const clearAttachedFiles = useChatStore((s) => s.clearAttachedFiles);
  const setConnectedProject = useChatStore((s) => s.setConnectedProject);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 200;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = getFileExtension(file.name);
      const isImage = IMAGE_EXTENSIONS.has(ext);
      const isText = TEXT_EXTENSIONS.has(ext);

      const reader = new FileReader();
      if (isImage) {
        reader.onload = () => {
          const content = reader.result as string;
          addAttachedFile({
            name: file.name,
            content: content.length > 100000 ? content.slice(0, 50000) : content,
            type: 'image',
            size: file.size,
          });
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          let content = reader.result as string;
          if (content.length > 100000) {
            content = content.slice(0, 50000) + '\n\n... [truncated]';
          }
          addAttachedFile({
            name: file.name,
            content,
            type: 'text',
            size: file.size,
          });
        };
        reader.readAsText(file);
      }

      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [addAttachedFile]
  );

  const handleZipUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setConnecting(true);
      try {
        const formData = new FormData();
        formData.append('action', 'upload_zip');
        formData.append('project', file.name.replace('.zip', ''));
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
        setConnectedProject(data.projectName || file.name.replace('.zip', ''));
        setConnectDialogOpen(false);
        toast.success('Project connected', { description: data.projectName || file.name });
      } catch (err) {
        toast.error('Failed to upload ZIP', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setConnecting(false);
        e.target.value = '';
      }
    },
    [setConnectedProject]
  );

  const handleConnectPath = useCallback(async () => {
    if (!projectPath.trim()) {
      toast.error('Please enter a project path');
      return;
    }

    setConnecting(true);
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'path', path: projectPath.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Connection failed' }));
        throw new Error(err.error || 'Connection failed');
      }

      const data = await res.json();
      setConnectedProject(data.projectName || projectPath.trim());
      setConnectDialogOpen(false);
      toast.success('Project connected', { description: projectPath.trim() });
    } catch (err) {
      toast.error('Failed to connect project', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setConnecting(false);
    }
  }, [projectPath, setConnectedProject]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    if (isStreaming) return;

    let messageContent = trimmed;
    if (attachedFiles.length > 0) {
      const fileParts = attachedFiles.map(f => `[File: ${f.name}]\n${f.content}\n\n`).join('');
      messageContent = fileParts + trimmed;
      clearAttachedFiles();
    }

    if (!messageContent.trim()) return;

    onSend(messageContent);
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
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      adjustHeight();
    },
    [adjustHeight]
  );

  if (!hasApiKey) {
    return (
      <div
        className="px-4 py-6"
        style={{
          borderTop: '1px solid var(--ds-border)',
          background: 'var(--ds-bg-secondary)',
        }}
      >
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <p className="text-sm" style={{ color: 'var(--ds-text-secondary)' }}>
            Configure your API key to start chatting with the AI agent.
          </p>
          <Button
            onClick={toggleSettings}
            variant="outline"
            className="gap-2 rounded-lg text-white"
            style={{
              background: 'var(--ds-accent)',
              borderColor: 'var(--ds-accent)',
            }}
          >
            <Settings className="w-4 h-4" />
            Configure API Key
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="px-4 py-3"
        style={{
          borderTop: '1px solid var(--ds-border)',
          background: 'var(--ds-bg-secondary)',
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleZipUpload}
            />

            {/* Attached file chips */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attachedFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                    style={{
                      background: 'var(--ds-bg-tertiary)',
                      border: '1px solid var(--ds-border)',
                      color: 'var(--ds-text-primary)',
                    }}
                  >
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <span className="text-[10px]" style={{ color: 'var(--ds-text-muted)' }}>
                      {(file.size / 1024).toFixed(0)}KB
                    </span>
                    <button
                      onClick={() => removeAttachedFile(file.name)}
                      className="hover:text-[var(--ds-error)]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything or describe a task..."
              disabled={isStreaming}
              rows={1}
              className="w-full min-h-[48px] max-h-[200px] resize-none rounded-2xl py-3.5 pl-4 pr-14 text-sm leading-relaxed focus:outline-none placeholder:opacity-40"
              style={{
                background: 'var(--ds-bg-tertiary)',
                border: '1px solid var(--ds-border)',
                color: 'var(--ds-text-primary)',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--ds-accent)';
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--ds-accent-glow)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--ds-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            {/* Bottom row - overlaid on the textarea */}
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1 pointer-events-auto">
                <button
                  className="p-1.5 rounded-md transition-smooth hover:bg-[var(--ds-bg-hover)]"
                  style={{ color: 'var(--ds-text-muted)' }}
                  title="Attach file"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded-md transition-smooth hover:bg-[var(--ds-bg-hover)]"
                  style={{ color: 'var(--ds-text-muted)' }}
                  title="Connect project"
                  onClick={() => setConnectDialogOpen(true)}
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 pointer-events-auto">
                <span className="text-[10px] font-mono" style={{ color: 'var(--ds-text-muted)' }}>
                  {input.length > 0 ? `${input.length} chars` : ''}
                </span>
                {isStreaming ? (
                  <button
                    onClick={onStop}
                    className="flex items-center justify-center w-8 h-8 rounded-xl transition-smooth"
                    style={{
                      background: 'var(--ds-error)',
                      color: 'white',
                    }}
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() && attachedFiles.length === 0}
                    className="flex items-center justify-center w-8 h-8 rounded-xl transition-smooth"
                    style={{
                      background: (input.trim() || attachedFiles.length > 0) ? 'var(--ds-accent)' : 'var(--ds-bg-tertiary)',
                      color: (input.trim() || attachedFiles.length > 0) ? 'white' : 'var(--ds-text-muted)',
                      border: (input.trim() || attachedFiles.length > 0) ? 'none' : '1px solid var(--ds-border)',
                      opacity: (input.trim() || attachedFiles.length > 0) ? 1 : 0.5,
                      cursor: (input.trim() || attachedFiles.length > 0) ? 'pointer' : 'default',
                    }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--ds-text-muted)' }}>
            Enter to send · Shift+Enter for newline · <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'var(--ds-bg-tertiary)', border: '1px solid var(--ds-border)' }}>Ctrl+/</kbd> to focus
          </p>
        </div>
      </div>

      {/* Connect Project Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="sm:max-w-md" style={{ background: 'var(--ds-bg-secondary)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--ds-text-primary)' }}>Connect Project</DialogTitle>
            <DialogDescription style={{ color: 'var(--ds-text-secondary)' }}>
              Upload a ZIP file or provide a local path to connect your project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Option 1: Upload ZIP */}
            <div
              className="p-4 rounded-xl cursor-pointer transition-smooth"
              style={{
                background: 'var(--ds-bg-tertiary)',
                border: '1px solid var(--ds-border)',
              }}
              onClick={() => zipInputRef.current?.click()}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--ds-accent)';
                e.currentTarget.style.background = 'var(--ds-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--ds-border)';
                e.currentTarget.style.background = 'var(--ds-bg-tertiary)';
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg"
                  style={{ background: 'var(--ds-accent-glow)' }}
                >
                  <FolderOpen className="w-5 h-5" style={{ color: 'var(--ds-accent)' }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ds-text-primary)' }}>
                    Upload ZIP Archive
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ds-text-muted)' }}>
                    Select a .zip file from your computer
                  </p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--ds-border)' }} />
              <span className="text-xs" style={{ color: 'var(--ds-text-muted)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'var(--ds-border)' }} />
            </div>

            {/* Option 2: Enter path */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: 'var(--ds-text-secondary)' }}>
                  Local Project Path
                </Label>
                <Input
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="/home/user/my-project"
                  className="text-xs rounded-lg"
                  style={{
                    background: 'var(--ds-bg-tertiary)',
                    border: '1px solid var(--ds-border)',
                    color: 'var(--ds-text-primary)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConnectPath();
                    }
                  }}
                />
                <p className="text-[11px]" style={{ color: 'var(--ds-text-muted)' }}>
                  Enter the absolute path to the project directory
                </p>
              </div>
              <Button
                onClick={handleConnectPath}
                disabled={connecting || !projectPath.trim()}
                className="w-full text-xs text-white rounded-lg"
                style={{ background: 'var(--ds-accent)' }}
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
