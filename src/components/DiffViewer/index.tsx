'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Check,
  X,
  GitCompare,
  Plus,
  Minus,
  FileCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────

export interface DiffItem {
  filePath: string;
  additions: string[];
  deletions: string[];
  description: string;
}

export interface DiffViewerProps {
  diffs: DiffItem[];
  onAccept?: (filePath: string) => void;
  onReject?: (filePath: string) => void;
}

// ── Sub-components ─────────────────────────────────────────────────

function DiffLine({
  type,
  content,
  lineNum,
}: {
  type: 'addition' | 'deletion' | 'context';
  content: string;
  lineNum?: number;
}) {
  return (
    <div
      className={cn(
        'flex items-stretch font-mono text-xs leading-5',
        type === 'addition' && 'bg-emerald-500/15 text-emerald-300',
        type === 'deletion' && 'bg-red-500/15 text-red-300',
        type === 'context' && 'text-muted-foreground/70',
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center w-8 shrink-0 text-center select-none border-r border-border/50',
          type === 'addition' && 'text-emerald-500/60',
          type === 'deletion' && 'text-red-500/60',
        )}
      >
        {type === 'addition' ? '+' : type === 'deletion' ? '-' : ' '}
      </span>
      {lineNum !== undefined && (
        <span
          className={cn(
            'inline-flex items-center justify-center w-10 shrink-0 text-center select-none border-r border-border/50',
            type === 'addition' && 'text-emerald-500/40',
            type === 'deletion' && 'text-red-500/40',
          )}
        >
          {lineNum}
        </span>
      )}
      <pre className="flex-1 px-2 whitespace-pre overflow-x-auto">
        {content}
      </pre>
    </div>
  );
}

function DiffCard({
  diff,
  index,
  onAccept,
  onReject,
}: {
  diff: DiffItem;
  index: number;
  onAccept?: (filePath: string) => void;
  onReject?: (filePath: string) => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const fileName = diff.filePath.split('/').pop() ?? diff.filePath;
  const dirPath = diff.filePath.includes('/')
    ? diff.filePath.substring(0, diff.filePath.lastIndexOf('/'))
    : '';
  const addCount = diff.additions.length;
  const delCount = diff.deletions.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group">
      <div className="border border-border rounded-lg overflow-hidden transition-colors hover:border-emerald-500/30">
        {/* Header */}
        <CollapsibleTrigger className="flex items-center gap-3 w-full px-4 py-3 text-left bg-card hover:bg-accent/50 transition-colors">
          <div className="shrink-0">
            {open ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>

          <FileCode className="w-4 h-4 text-emerald-500 shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate">
                {fileName}
              </span>
              {dirPath && (
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                  — {dirPath}
                </span>
              )}
            </div>
            {diff.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {diff.description}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-1.5 shrink-0">
            {addCount > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
              >
                <Plus className="w-2.5 h-2.5 mr-0.5" />
                {addCount}
              </Badge>
            )}
            {delCount > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] font-mono bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20"
              >
                <Minus className="w-2.5 h-2.5 mr-0.5" />
                {delCount}
              </Badge>
            )}
          </div>
        </CollapsibleTrigger>

        {/* Diff content */}
        <CollapsibleContent>
          <div className="border-t border-border">
            <div className="max-h-72 overflow-y-auto">
              {diff.deletions.map((line, i) => (
                <DiffLine
                  key={`del-${i}`}
                  type="deletion"
                  content={line}
                  lineNum={i + 1}
                />
              ))}
              {diff.additions.map((line, i) => (
                <DiffLine
                  key={`add-${i}`}
                  type="addition"
                  content={line}
                  lineNum={i + 1}
                />
              ))}
            </div>

            {/* Action buttons */}
            {(onAccept || onReject) && (
              <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border bg-muted/30">
                {onReject && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReject(diff.filePath);
                    }}
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Reject
                  </Button>
                )}
                {onAccept && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAccept(diff.filePath);
                    }}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Accept
                  </Button>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export function DiffViewer({ diffs, onAccept, onReject }: DiffViewerProps) {
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const handleAccept = useCallback(
    (filePath: string) => {
      setAccepted((prev) => new Set(prev).add(filePath));
      setRejected((prev) => {
        const next = new Set(prev);
        next.delete(filePath);
        return next;
      });
      onAccept?.(filePath);
    },
    [onAccept],
  );

  const handleReject = useCallback(
    (filePath: string) => {
      setRejected((prev) => new Set(prev).add(filePath));
      setAccepted((prev) => {
        const next = new Set(prev);
        next.delete(filePath);
        return next;
      });
      onReject?.(filePath);
    },
    [onReject],
  );

  // ── Summary stats ───────────────────────────────────────────────
  const summary = useMemo(() => {
    const fileCount = diffs.length;
    const totalAdditions = diffs.reduce((n, d) => n + d.additions.length, 0);
    const totalDeletions = diffs.reduce((n, d) => n + d.deletions.length, 0);
    return { fileCount, totalAdditions, totalDeletions };
  }, [diffs]);

  // ── Empty state ─────────────────────────────────────────────────
  if (diffs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background gap-3">
        <div className="rounded-full bg-muted p-4">
          <GitCompare className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            No changes to review
          </p>
          <p className="text-xs text-muted-foreground/70">
            Changes will appear here when the agent modifies files.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-foreground">
            Changes
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {summary.fileCount} file{summary.fileCount !== 1 ? 's' : ''} changed
          </span>
          <Badge
            variant="secondary"
            className="h-5 px-1.5 text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          >
            <Plus className="w-2.5 h-2.5 mr-0.5" />
            {summary.totalAdditions}
          </Badge>
          <Badge
            variant="secondary"
            className="h-5 px-1.5 text-[10px] font-mono bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20"
          >
            <Minus className="w-2.5 h-2.5 mr-0.5" />
            {summary.totalDeletions}
          </Badge>
        </div>
      </div>

      {/* Diff list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {diffs.map((diff, index) => {
            const isAccepted = accepted.has(diff.filePath);
            const isRejected = rejected.has(diff.filePath);

            return (
              <div
                key={diff.filePath}
                className={cn(
                  'relative transition-opacity',
                  isAccepted && 'opacity-60',
                  isRejected && 'opacity-40',
                )}
              >
                {isAccepted && (
                  <div className="absolute -top-1 -right-1 z-10">
                    <Badge className="h-5 px-1.5 text-[10px] bg-emerald-600 text-white hover:bg-emerald-600 border-0">
                      <Check className="w-2.5 h-2.5 mr-0.5" />
                      Accepted
                    </Badge>
                  </div>
                )}
                {isRejected && (
                  <div className="absolute -top-1 -right-1 z-10">
                    <Badge className="h-5 px-1.5 text-[10px] bg-red-600 text-white hover:bg-red-600 border-0">
                      <X className="w-2.5 h-2.5 mr-0.5" />
                      Rejected
                    </Badge>
                  </div>
                )}
                <DiffCard
                  diff={diff}
                  index={index}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
