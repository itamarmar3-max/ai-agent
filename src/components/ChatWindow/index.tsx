'use client';

import { useEffect, useRef } from 'react';
import { Download, Bot, Loader2, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store';
import { useChatStream } from '@/hooks/useChatStream';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { SkillIndicator } from '@/components/SkillIndicator';
import { SkillSelector } from '@/components/SkillSelector';
import { toast } from 'sonner';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export function ChatWindow() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const currentToolCall = useChatStore((s) => s.currentToolCall);
  const performance = useChatStore((s) => s.performance);
  const lastIntent = useChatStore((s) => s.lastIntent);
  const { sendMessage, stopStreaming } = useChatStream();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, currentToolCall]);

  const handleDownloadZip = async () => {
    try {
      const response = await fetch('/api/zip');
      if (!response.ok) throw new Error('Failed to download');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('ZIP downloaded', { description: 'project.zip', duration: 2000 });
    } catch {
      // Silently fail
    }
  };

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const isThinking = isStreaming && lastAssistantMessage && !lastAssistantMessage.content;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--ds-bg-primary)' }}>
      {/* Header - Minimal */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--ds-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <SkillIndicator />
            <SkillSelector />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              onClick={stopStreaming}
              className="gap-1.5 text-xs rounded-lg hover:bg-[rgba(220,38,38,0.08)]"
              style={{ color: 'var(--ds-error)' }}
            >
              <StopCircle className="w-3.5 h-3.5" />
              Stop
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadZip}
            className="gap-1.5 text-xs rounded-lg"
            style={{ color: 'var(--ds-text-secondary)' }}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db transparent',
        }}
      >
        {messages.length === 0 ? (
          <WelcomeScreen onSendExample={sendMessage} />
        ) : (
          <div className="py-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {/* Thinking indicator */}
            {isThinking && (
              <div className="flex items-center gap-3 px-4 py-3 animate-fade-in-up">
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-lg"
                  style={{
                    background: 'var(--ds-gradient-soft)',
                    border: '1px solid var(--ds-accent-glow-strong)',
                  }}
                >
                  <Bot className="w-3.5 h-3.5" style={{ color: 'var(--ds-accent)' }} />
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ds-text-secondary)' }}>
                  <Loader2 className="w-3.5 h-3.5 animate-pulse-subtle" style={{ color: 'var(--ds-accent)' }} />
                  <span>
                    {currentToolCall
                      ? <>Running <span className="font-mono">{currentToolCall.name}</span>…</>
                      : lastIntent?.intent === 'smalltalk'
                        ? 'Replying…'
                        : lastIntent?.intent === 'task'
                          ? 'Planning…'
                          : 'Thinking…'}
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Performance stats bar */}
      {performance && (
        <div
          className="flex items-center gap-4 px-4 py-1.5 text-[10px]"
          style={{
            borderTop: '1px solid var(--ds-border)',
            color: 'var(--ds-text-muted)',
          }}
        >
          <span>{performance.totalToolCalls} tool calls</span>
          <span>{formatDuration(performance.sessionDuration)}</span>
          {performance.averageResponseTime > 0 && (
            <span>{performance.averageResponseTime.toFixed(1)}s avg</span>
          )}
        </div>
      )}

      {/* Input area */}
      <ChatInput onSend={sendMessage} onStop={stopStreaming} />
    </div>
  );
}
