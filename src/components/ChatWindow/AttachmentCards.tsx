'use client';

import { useState } from 'react';
import { FileText, FileCode, FileJson, Image as ImageIcon, Download } from 'lucide-react';
import type { AttachedFile } from '@/types';

const CODE_EXTENSIONS = new Set([
  'js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'kt', 'c', 'cpp', 'h', 'hpp',
  'rb', 'php', 'css', 'html', 'svelte', 'vue', 'sql', 'sh', 'graphql', 'prisma',
]);

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/** Stable, top-level glyph component (avoids creating components during render). */
function FileGlyph({
  name,
  isImage,
  className,
  color,
  strokeWidth,
}: {
  name: string;
  isImage: boolean;
  className?: string;
  color?: string;
  strokeWidth?: number;
}) {
  const style = color ? { color } : undefined;
  if (isImage) return <ImageIcon className={className} style={style} strokeWidth={strokeWidth} />;
  const ext = getExtension(name);
  if (ext === 'json') return <FileJson className={className} style={style} strokeWidth={strokeWidth} />;
  if (CODE_EXTENSIONS.has(ext)) return <FileCode className={className} style={style} strokeWidth={strokeWidth} />;
  return <FileText className={className} style={style} strokeWidth={strokeWidth} />;
}

/**
 * Renders user-uploaded attachments as a responsive grid of distinct cards
 * ("cubes"): a thumbnail for images, an icon + extension badge for text files.
 */
export function AttachmentCards({ attachments }: { attachments: AttachedFile[] }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((file) => (
        <AttachmentCard key={`${file.name}-${file.size}`} file={file} />
      ))}
    </div>
  );
}

function AttachmentCard({ file }: { file: AttachedFile }) {
  const [preview, setPreview] = useState(false);
  const isImage = file.type === 'image';
  const ext = getExtension(file.name);

  return (
    <>
      <button
        type="button"
        onClick={() => isImage && setPreview(true)}
        className="group flex flex-col w-36 rounded-xl overflow-hidden text-left transition-smooth hover:-translate-y-0.5"
        style={{
          background: 'var(--ds-bg-tertiary)',
          border: '1px solid var(--ds-border)',
          boxShadow: 'var(--ds-shadow-sm)',
          cursor: isImage ? 'zoom-in' : 'default',
        }}
        title={file.name}
      >
        {/* Visual block */}
        <div
          className="relative flex items-center justify-center h-24 w-full overflow-hidden"
          style={{ background: 'var(--ds-bg-secondary)' }}
        >
          {isImage ? (
            <img src={file.content} alt={file.name} className="w-full h-full object-cover" />
          ) : (
            <FileGlyph name={file.name} isImage={false} className="w-8 h-8" color="var(--ds-accent)" strokeWidth={1.5} />
          )}
          {!isImage && ext && (
            <span
              className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase"
              style={{ background: 'var(--ds-accent-soft)', color: 'var(--ds-accent)' }}
            >
              {ext}
            </span>
          )}
        </div>
        {/* Meta */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 min-w-0" style={{ borderTop: '1px solid var(--ds-border)' }}>
          <FileGlyph name={file.name} isImage={isImage} className="w-3 h-3 shrink-0" color="var(--ds-text-muted)" />
          <span className="text-[11px] truncate flex-1" style={{ color: 'var(--ds-text-primary)' }}>
            {file.name}
          </span>
          <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--ds-text-muted)' }}>
            {formatBytes(file.size)}
          </span>
        </div>
      </button>

      {/* Lightweight image preview overlay */}
      {preview && isImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8 animate-fade-in-up"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setPreview(false)}
        >
          <img
            src={file.content}
            alt={file.name}
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={file.content}
            download={file.name}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--ds-bg-primary)', color: 'var(--ds-text-primary)' }}
          >
            <Download className="w-3.5 h-3.5" />
            {file.name}
          </a>
        </div>
      )}
    </>
  );
}
