'use client';

import { useState } from 'react';
import {
  Trash2,
  ChevronDown,
  ChevronRight,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ClipboardList,
  ListChecks,
  Clock,
  Zap,
  Activity,
  Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useChatStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { ToolCall, Plan, Subtask } from '@/types';

// === Plan Panel ===
function PlanPanel({ plan }: { plan: Plan }) {
  const [expanded, setExpanded] = useState(true);

  const complexityConfig: Record<string, { bg: string; color: string; border: string }> = {
    low: { bg: 'rgba(0,217,126,0.1)', color: 'var(--ds-success)', border: 'rgba(0,217,126,0.3)' },
    medium: { bg: 'rgba(245,166,35,0.1)', color: 'var(--ds-warning)', border: 'rgba(245,166,35,0.3)' },
    high: { bg: 'rgba(255,71,87,0.1)', color: 'var(--ds-error)', border: 'rgba(255,71,87,0.3)' },
  };
  const complexity = complexityConfig[plan.estimated_complexity] || complexityConfig.low;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className="rounded-lg overflow-hidden animate-slide-in-left"
        style={{
          border: '1px solid var(--ds-tool-border)',
          borderLeft: '3px solid var(--ds-accent)',
          background: 'var(--ds-tool-bg)',
        }}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-[var(--ds-bg-hover)] transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            {expanded ? (
              <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--ds-text-muted)' }} />
            ) : (
              <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--ds-text-muted)' }} />
            )}
            <ClipboardList className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ds-accent)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--ds-accent)' }}>Plan</span>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 shrink-0"
            style={{ background: complexity.bg, color: complexity.color, borderColor: complexity.border }}
          >
            {plan.estimated_complexity} complexity
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div style={{ borderTop: '1px solid var(--ds-tool-border)' }} className="px-3 py-2 space-y-2">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--ds-text-primary)' }}>{plan.goal}</p>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ds-text-muted)' }}>Steps</span>
              <ol className="text-[11px] space-y-0.5 ml-4" style={{ color: 'var(--ds-text-secondary)' }}>
                {plan.steps.map((step, i) => (
                  <li key={i} className="list-decimal">{step}</li>
                ))}
              </ol>
            </div>
            {plan.tools_needed.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ds-text-muted)' }}>Tools</span>
                <div className="flex flex-wrap gap-1">
                  {plan.tools_needed.map((tool) => (
                    <Badge key={tool} variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// === Progress Bar ===
function ProgressBar() {
  const progress = useChatStore((s) => s.progress);

  if (!progress) return null;

  const pct = progress.total > 0 ? Math.min((progress.current / progress.total) * 100, 100) : 0;

  return (
    <div className="px-2 py-1.5">
      <div
        className="rounded-lg px-3 py-2"
        style={{
          background: 'var(--ds-tool-bg)',
          border: '1px solid var(--ds-tool-border)',
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3" style={{ color: 'var(--ds-accent)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--ds-text-primary)' }}>
              Step {progress.current} of {progress.total}
            </span>
          </div>
          <span className="text-[10px]" style={{ color: 'var(--ds-text-muted)' }}>{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--ds-bg-tertiary)' }}>
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${pct}%`, background: 'var(--ds-accent)' }}
          />
        </div>
        {progress.description && (
          <p className="text-[10px] mt-1 truncate" style={{ color: 'var(--ds-text-secondary)' }}>{progress.description}</p>
        )}
      </div>
    </div>
  );
}

// === Subtask Checklist ===
function SubtaskChecklist({ subtasks }: { subtasks: Subtask[] }) {
  const [expanded, setExpanded] = useState(true);

  const completed = subtasks.filter((st) => st.status === 'completed').length;
  const total = subtasks.length;

  const statusIcon = {
    pending: <Circle className="w-3 h-3" style={{ color: 'var(--ds-text-muted)', opacity: 0.5 }} />,
    in_progress: <Loader2 className="w-3 h-3 animate-pulse-subtle" style={{ color: 'var(--ds-warning)' }} />,
    completed: <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--ds-success)' }} />,
    failed: <AlertCircle className="w-3 h-3" style={{ color: 'var(--ds-error)' }} />,
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: 'var(--ds-tool-bg)',
          border: '1px solid var(--ds-tool-border)',
        }}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-[var(--ds-bg-hover)] transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            {expanded ? (
              <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--ds-text-muted)' }} />
            ) : (
              <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--ds-text-muted)' }} />
            )}
            <ListChecks className="w-3 h-3 shrink-0" style={{ color: 'var(--ds-text-secondary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--ds-text-primary)' }}>Subtasks</span>
          </div>
          <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
            {completed}/{total}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div style={{ borderTop: '1px solid var(--ds-tool-border)' }} className="px-3 py-1.5 space-y-0.5">
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-start gap-2 py-1.5 group"
              >
                <div className="mt-0.5 shrink-0">{statusIcon[subtask.status]}</div>
                <div className="flex-1 min-w-0">
                  <span
                    className="text-[11px] leading-relaxed"
                    style={{
                      color: subtask.status === 'completed'
                        ? 'var(--ds-text-muted)'
                        : subtask.status === 'failed'
                          ? 'var(--ds-error)'
                          : 'var(--ds-text-primary)',
                      textDecoration: subtask.status === 'completed' ? 'line-through' : 'none',
                    }}
                  >
                    {subtask.task}
                  </span>
                  {subtask.assignedTool && (
                    <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 font-mono" style={{ borderColor: 'var(--ds-border)', color: 'var(--ds-text-muted)' }}>
                      {subtask.assignedTool}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// === Performance Stats ===
function PerformanceStatsPanel() {
  const performance = useChatStore((s) => s.performance);

  if (!performance) return null;

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="px-2 py-1.5">
      <div
        className="rounded-lg px-3 py-2"
        style={{
          background: 'var(--ds-tool-bg)',
          border: '1px solid var(--ds-tool-border)',
        }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Zap className="w-3 h-3" style={{ color: 'var(--ds-accent)' }} />
          <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ds-text-muted)' }}>Performance</span>
        </div>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--ds-text-secondary)' }}>
          <span className="flex items-center gap-1">
            <Wrench className="w-2.5 h-2.5" />
            {performance.totalToolCalls} calls
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatDuration(performance.sessionDuration)}
          </span>
          {performance.averageResponseTime > 0 && (
            <span className="flex items-center gap-1">
              <Activity className="w-2.5 h-2.5" />
              {performance.averageResponseTime.toFixed(1)}s avg
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// === Enhanced Tool Call Entry ===
function ToolCallEntry({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    running: {
      icon: <Loader2 className="w-3 h-3 animate-pulse-subtle" />,
      borderColor: 'var(--ds-accent)',
      color: 'var(--ds-accent)',
      bg: 'var(--ds-accent-glow)',
      border: 'rgba(124,108,252,0.3)',
      statusText: 'running',
    },
    completed: {
      icon: <CheckCircle2 className="w-3 h-3" />,
      borderColor: 'var(--ds-success)',
      color: 'var(--ds-success)',
      bg: 'rgba(0,217,126,0.1)',
      border: 'rgba(0,217,126,0.3)',
      statusText: 'done',
    },
    error: {
      icon: <AlertCircle className="w-3 h-3" />,
      borderColor: 'var(--ds-error)',
      color: 'var(--ds-error)',
      bg: 'rgba(255,71,87,0.1)',
      border: 'rgba(255,71,87,0.3)',
      statusText: 'failed',
    },
  };

  const config = statusConfig[toolCall.status];

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className="rounded-lg overflow-hidden animate-slide-in-left"
        style={{
          border: '1px solid var(--ds-tool-border)',
          borderLeft: `3px solid ${config.borderColor}`,
          background: 'var(--ds-tool-bg)',
        }}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-[var(--ds-bg-hover)] transition-colors">
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
            {toolCall.isParallel && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0" style={{ background: 'rgba(74,158,255,0.1)', borderColor: 'rgba(74,158,255,0.3)', color: 'var(--ds-info)' }}>
                parallel
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {toolCall.duration != null && toolCall.duration > 0 && (
              <span className="text-[10px] font-mono" style={{ color: 'var(--ds-text-muted)' }}>
                {(toolCall.duration / 1000).toFixed(1)}s
              </span>
            )}
            {toolCall.retryCount != null && toolCall.retryCount > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0" style={{ background: 'rgba(245,166,35,0.1)', borderColor: 'rgba(245,166,35,0.3)', color: 'var(--ds-warning)' }}>
                Retry {toolCall.retryCount}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0"
              style={{ background: config.bg, color: config.color, borderColor: config.border }}
            >
              {config.icon}
              <span className="ml-1">{config.statusText}</span>
            </Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div style={{ borderTop: '1px solid var(--ds-tool-border)' }}>
            <div className="px-3 py-1.5">
              <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ds-text-muted)' }}>
                Input
              </span>
            </div>
            <pre className="px-3 pb-2 text-[11px] font-mono overflow-x-auto max-h-32 overflow-y-auto" style={{ color: 'var(--ds-text-secondary)' }}>
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
            {toolCall.output && (
              <>
                <div className="px-3 py-1.5" style={{ borderTop: '1px solid var(--ds-tool-border)' }}>
                  <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ds-text-muted)' }}>
                    Output
                  </span>
                </div>
                <pre className="px-3 pb-2 text-[11px] font-mono overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap" style={{ color: 'var(--ds-text-secondary)' }}>
                  {toolCall.output.length > 1500
                    ? toolCall.output.slice(0, 1500) + '\n... (truncated)'
                    : toolCall.output}
                </pre>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// === Main ToolPanel ===
export function ToolPanel() {
  const toolCallHistory = useChatStore((s) => s.toolCallHistory);
  const currentToolCall = useChatStore((s) => s.currentToolCall);
  const clearToolCallHistory = useChatStore((s) => s.clearToolCallHistory);
  const plan = useChatStore((s) => s.plan);
  const subtasks = useChatStore((s) => s.subtasks);

  const allCalls = [...toolCallHistory];
  // If current tool call is running and not yet in history, show it
  if (
    currentToolCall &&
    currentToolCall.status === 'running' &&
    !allCalls.some((tc) => tc.id === currentToolCall.id)
  ) {
    allCalls.push(currentToolCall);
  }

  const hasContent = plan || subtasks.length > 0 || allCalls.length > 0;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--ds-bg-secondary)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--ds-border)' }}
      >
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4" style={{ color: 'var(--ds-text-secondary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ds-text-primary)' }}>Activity</h3>
          {allCalls.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5">{allCalls.length}</Badge>
          )}
        </div>
        {allCalls.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearToolCallHistory}
            className="h-7 w-7 p-0 hover:bg-[rgba(255,71,87,0.1)]"
            style={{ color: 'var(--ds-text-secondary)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {!hasContent ? (
          <div className="px-3 py-8 text-center">
            <Wrench className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--ds-text-muted)', opacity: 0.4 }} />
            <p className="text-xs" style={{ color: 'var(--ds-text-muted)' }}>
              Activity will appear here when the agent is working.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {/* Plan Panel */}
            {plan && <PlanPanel plan={plan} />}

            {/* Progress Bar */}
            <ProgressBar />

            {/* Subtask Checklist */}
            {subtasks.length > 0 && <SubtaskChecklist subtasks={subtasks} />}

            {/* Divider between activity panels and tool calls */}
            {(plan || subtasks.length > 0) && allCalls.length > 0 && (
              <div className="pt-1">
                <div className="flex items-center gap-2 px-1">
                  <div className="flex-1 h-px" style={{ background: 'var(--ds-border)' }} />
                  <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ds-text-muted)' }}>Tool Calls</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--ds-border)' }} />
                </div>
              </div>
            )}

            {/* Tool calls list */}
            {allCalls.length > 0 && (
              <div className="space-y-1.5">
                {[...allCalls].reverse().map((tc) => (
                  <ToolCallEntry key={tc.id} toolCall={tc} />
                ))}
              </div>
            )}

            {/* Performance Stats */}
            <PerformanceStatsPanel />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
