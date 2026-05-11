'use client';

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Bot, ChevronDown, ChevronRight, Wrench, AlertCircle, CheckCircle2, Loader2, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType, ToolCall } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

function ToolCallPanel({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    running: {
      borderColor: 'var(--ds-accent)',
      icon: <Loader2 className="w-3 h-3 animate-pulse-subtle" style={{ color: 'var(--ds-accent)' }} />,
      badgeClass: 'bg-[var(--ds-accent-glow)] text-[var(--ds-accent)] border-[rgba(37,99,235,0.3)]',
      statusText: 'running',
    },
    completed: {
      borderColor: 'var(--ds-success)',
      icon: <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--ds-success)' }} />,
      badgeClass: 'bg-[rgba(5,150,105,0.08)] text-[var(--ds-success)] border-[rgba(5,150,105,0.3)]',
      statusText: 'done',
    },
    error: {
      borderColor: 'var(--ds-error)',
      icon: <AlertCircle className="w-3 h-3" style={{ color: 'var(--ds-error)' }} />,
      badgeClass: 'bg-[rgba(220,38,38,0.08)] text-[var(--ds-error)] border-[rgba(220,38,38,0.3)]',
      statusText: 'failed',
    },
  };

  const config = statusConfig[toolCall.status];
  const durationStr = toolCall.duration != null && toolCall.duration > 0
    ? `${(toolCall.duration / 1000).toFixed(1)}s`
    : null;

  // Generate result summary
  const resultSummary = toolCall.output
    ? (toolCall.output.length > 80
        ? toolCall.output.substring(0, 80) + '...'
        : toolCall.output)
    : null;

  return (
    <div
      className="my-1.5 rounded-lg overflow-hidden animate-slide-in-left"
      style={{
        background: 'var(--ds-tool-bg)',
        border: `1px solid var(--ds-tool-border)`,
        borderLeft: `3px solid ${config.borderColor}`,
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 text-left transition-smooth hover:bg-[var(--ds-bg-hover)]"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--ds-text-muted)' }} />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--ds-text-muted)' }} />
          )}
          <Wrench className="w-3 h-3 shrink-0" style={{ color: 'var(--ds-text-secondary)' }} />
          <span className="text-xs font-mono font-medium truncate" style={{ color: 'var(--ds-text-primary)' }}>
            {toolCall.name}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {durationStr && (
            <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: 'var(--ds-text-muted)' }}>
              <Clock className="w-2.5 h-2.5" />
              {durationStr}
            </span>
          )}
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0', config.badgeClass)}
          >
            {config.icon}
            <span className="ml-1">{config.statusText}</span>
          </Badge>
        </div>
      </button>

      {/* Result summary - collapsed view */}
      {!expanded && resultSummary && toolCall.status === 'completed' && (
        <div className="px-3 pb-2 pl-8">
          <p className="text-[11px] truncate" style={{ color: 'var(--ds-text-secondary)' }}>
            {resultSummary}
          </p>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--ds-tool-border)' }}>
          <div className="px-3 py-1.5">
            <span
              className="text-[10px] uppercase tracking-wider font-medium"
              style={{ color: 'var(--ds-text-muted)' }}
            >
              Input
            </span>
          </div>
          <pre
            className="px-3 pb-2 text-[11px] font-mono overflow-x-auto max-h-32 overflow-y-auto"
            style={{ color: 'var(--ds-text-secondary)' }}
          >
            {JSON.stringify(toolCall.input, null, 2)}
          </pre>
          {toolCall.output && (
            <>
              <div className="px-3 py-1.5" style={{ borderTop: '1px solid var(--ds-tool-border)' }}>
                <span
                  className="text-[10px] uppercase tracking-wider font-medium"
                  style={{ color: 'var(--ds-text-muted)' }}
                >
                  Output
                </span>
              </div>
              <pre
                className="px-3 pb-2 text-[11px] font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap"
                style={{ color: 'var(--ds-text-secondary)' }}
              >
                {toolCall.output.length > 2000
                  ? toolCall.output.slice(0, 2000) + '\n... (truncated)'
                  : toolCall.output}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ color: 'var(--ds-text-secondary)' }}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" style={{ color: 'var(--ds-success)' }} />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </Button>
  );
}

function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasContent = message.content.length > 0;
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const hasImages = message.images && message.images.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group px-4 py-2',
        isUser ? 'flex justify-end' : 'flex justify-start'
      )}
    >
      {/* Content wrapper */}
      <div className={cn('flex flex-col gap-2', isUser ? 'items-end max-w-[70%]' : 'w-full')}>
        {/* Plan panel (before message bubble) */}
        {message.plan && (
          <div
            className="my-1 rounded-lg p-3 w-full"
            style={{
              background: 'var(--ds-bg-secondary)',
              border: '1px solid var(--ds-tool-border)',
              borderLeft: '3px solid var(--ds-accent)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--ds-accent)' }}>Plan</span>
              <Badge
                variant="outline"
                className="text-[10px]"
                style={{
                  border: '1px solid rgba(37,99,235,0.3)',
                  color: 'var(--ds-accent)',
                  background: 'var(--ds-accent-glow)',
                }}
              >
                {message.plan.estimated_complexity} complexity
              </Badge>
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--ds-text-primary)' }}>{message.plan.goal}</p>
            <ol className="text-[11px] space-y-1 ml-4" style={{ color: 'var(--ds-text-secondary)' }}>
              {message.plan.steps.map((step, i) => (
                <li key={i} className="list-decimal">{step}</li>
              ))}
            </ol>
            {message.plan.tools_needed.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {message.plan.tools_needed.map(tool => (
                  <Badge key={tool} variant="secondary" className="text-[9px] px-1.5 font-mono">{tool}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message content */}
        {hasContent && (
          <div className="flex items-start gap-1">
            {isUser ? (
              <div
                className="rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed"
                style={{
                  background: 'var(--ds-bg-tertiary)',
                  border: '1px solid var(--ds-border)',
                  color: 'var(--ds-text-primary)',
                }}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <div className="prose prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:m-0">
                  <ReactMarkdown
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        if (match) {
                          return (
                            <div className="my-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--ds-tool-border)' }}>
                              <div
                                className="flex items-center justify-between px-3 py-1.5 text-[11px]"
                                style={{
                                  background: 'var(--ds-bg-tertiary)',
                                  color: 'var(--ds-text-secondary)',
                                  borderBottom: '1px solid var(--ds-tool-border)',
                                }}
                              >
                                <span>{match[1]}</span>
                              </div>
                              <SyntaxHighlighter
                                style={oneLight}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{
                                  margin: 0,
                                  padding: '0.75rem',
                                  fontSize: '0.75rem',
                                  borderRadius: 0,
                                  background: '#f8f9fa',
                                }}
                              >
                                {codeString}
                              </SyntaxHighlighter>
                            </div>
                          );
                        }
                        return (
                          <code
                            className="rounded px-1.5 py-0.5 text-[13px]"
                            style={{
                              background: 'var(--ds-bg-tertiary)',
                              border: '1px solid var(--ds-border)',
                              color: 'var(--ds-accent)',
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                      pre({ children }) {
                        return <>{children}</>;
                      },
                      a({ children, href }) {
                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--ds-accent)' }}
                            className="hover:underline underline-offset-2"
                          >
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            {!isUser && <CopyButton text={message.content} />}
          </div>
        )}

        {/* Images */}
        <AnimatePresence>
          {hasImages && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap gap-2"
            >
              {message.images!.map((img, idx) => (
                <div
                  key={idx}
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--ds-border)' }}
                >
                  <img
                    src={img}
                    alt={`Generated image ${idx + 1}`}
                    className="w-full h-auto object-cover max-w-xs"
                  />
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tool calls */}
        {hasToolCalls && (
          <div className="space-y-1 w-full">
            {message.toolCalls!.map((tc) => (
              <ToolCallPanel key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] px-1" style={{ color: 'var(--ds-text-muted)' }}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </motion.div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
