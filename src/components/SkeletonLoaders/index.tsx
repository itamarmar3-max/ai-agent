'use client';

/**
 * Skeleton loading components for dark theme.
 * Uses CSS animations — no external library needed.
 */

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

function SkeletonBase({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--ds-bg-tertiary)',
        borderRadius: '6px',
        animation: 'skeletonPulse 2s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

/** Sidebar chat item skeleton */
export function ChatItemSkeleton() {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5"
      style={{ borderBottom: '1px solid var(--ds-border)' }}
    >
      <div
        className="w-8 h-8 rounded-lg shrink-0"
        style={{
          background: 'var(--ds-bg-tertiary)',
          animation: 'skeletonPulse 2s ease-in-out infinite',
        }}
      />
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonBase className="h-3.5 w-3/4" />
        <SkeletonBase className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Group of chat items for sidebar loading state */
export function ChatSidebarSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col">
      {/* Header skeleton */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--ds-border)' }}>
        <SkeletonBase className="h-4 w-24 mb-2" />
        <SkeletonBase className="h-8 w-full" />
      </div>
      {/* Item skeletons */}
      {Array.from({ length: count }).map((_, i) => (
        <ChatItemSkeleton key={i} />
      ))}
    </div>
  );
}

/** Single file tree item skeleton */
function FileTreeItemSkeleton({ indent = 0 }: { indent?: number }) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1"
      style={{ paddingLeft: `${indent * 16 + 8}px` }}
    >
      <div
        className="w-3.5 h-3.5 rounded shrink-0"
        style={{
          background: 'var(--ds-bg-tertiary)',
          animation: 'skeletonPulse 2s ease-in-out infinite',
        }}
      />
      <SkeletonBase className="h-3.5 flex-1" style={{ maxWidth: `${60 + Math.random() * 30}%` }} />
    </div>
  );
}

/** File explorer tree skeleton */
export function FileExplorerSkeleton({ files = 8 }: { files?: number }) {
  return (
    <div className="flex flex-col py-2">
      {Array.from({ length: files }).map((_, i) => (
        <FileTreeItemSkeleton key={i} indent={i < 2 ? 0 : i < 5 ? 1 : 2} />
      ))}
    </div>
  );
}
