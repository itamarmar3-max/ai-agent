'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Download,
  FileCode,
  FileText,
  Image as ImageIcon,
  FileJson,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useChatStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { FileExplorerSkeleton } from '@/components/SkeletonLoaders';
import type { WorkspaceFile } from '@/types';

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, { icon: typeof FileCode; color: string }> = {
    ts: { icon: FileCode, color: '#4a9eff' },
    tsx: { icon: FileCode, color: '#4a9eff' },
    js: { icon: FileCode, color: '#f5a623' },
    jsx: { icon: FileCode, color: '#f5a623' },
    json: { icon: FileJson, color: '#00d97e' },
    md: { icon: FileText, color: '#888888' },
    txt: { icon: FileText, color: '#888888' },
    png: { icon: ImageIcon, color: '#ff4757' },
    jpg: { icon: ImageIcon, color: '#ff4757' },
    gif: { icon: ImageIcon, color: '#ff4757' },
    svg: { icon: ImageIcon, color: '#f5a623' },
    html: { icon: FileCode, color: '#f5a623' },
    css: { icon: FileCode, color: '#7c6cfc' },
    py: { icon: FileCode, color: '#00d97e' },
    rs: { icon: FileCode, color: '#ff4757' },
  };
  return iconMap[ext] || { icon: File, color: 'var(--ds-text-muted)' };
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTreeNode({
  file,
  depth,
  onSelectFile,
}: {
  file: WorkspaceFile;
  depth: number;
  onSelectFile: (file: WorkspaceFile) => void;
}) {
  const [open, setOpen] = useState(depth < 1);

  if (file.type === 'directory') {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className="flex items-center gap-1.5 w-full px-2 py-1 rounded-md transition-smooth hover:bg-[var(--ds-bg-hover)]"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? (
            <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--ds-text-muted)' }} />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--ds-text-muted)' }} />
          )}
          {open ? (
            <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: '#f5a623' }} />
          ) : (
            <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: '#f5a623' }} />
          )}
          <span className="text-xs truncate" style={{ color: 'var(--ds-text-primary)' }}>{file.name}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {file.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              file={child}
              depth={depth + 1}
              onSelectFile={onSelectFile}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const { icon: FileIcon, color } = getFileIcon(file.name);
  const sizeStr = formatSize(file.size);

  return (
    <button
      onClick={() => onSelectFile(file)}
      className="flex items-center gap-1.5 w-full px-2 py-1 rounded-md transition-smooth hover:bg-[var(--ds-bg-hover)] group"
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <FileIcon className={cn('w-3.5 h-3.5 shrink-0')} style={{ color }} />
      <span className="text-xs truncate flex-1 text-left" style={{ color: 'var(--ds-text-primary)' }}>
        {file.name}
      </span>
      {sizeStr && (
        <span className="text-[10px] shrink-0" style={{ color: 'var(--ds-text-muted)' }}>
          {sizeStr}
        </span>
      )}
    </button>
  );
}

export function FileExplorer() {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<WorkspaceFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState(false);

  const workspaceRefreshKey = useChatStore((s) => s.workspaceRefreshKey);
  const setWorkspaceFiles = useChatStore((s) => s.setWorkspaceFiles);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/workspace');
      if (response.ok) {
        const data = (await response.json()) as WorkspaceFile[];
        setFiles(data);
        setWorkspaceFiles(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [setWorkspaceFiles]);

  const fetchFileContent = useCallback(async (file: WorkspaceFile) => {
    setPreviewFile(file);
    setContentLoading(true);
    setFileContent('');
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', path: file.path }),
      });
      if (response.ok) {
        const data = (await response.json()) as { content: string };
        setFileContent(data.content);
      } else {
        setFileContent('Unable to read file content.');
      }
    } catch {
      setFileContent('Failed to load file content.');
    } finally {
      setContentLoading(false);
    }
  }, []);

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
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, workspaceRefreshKey]);

  return (
    <>
      <div className="flex flex-col h-full" style={{ background: 'var(--ds-bg-secondary)' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid var(--ds-border)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ds-text-primary)' }}>Files</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchFiles}
              disabled={loading}
              className="h-7 w-7 p-0"
              style={{ color: 'var(--ds-text-secondary)' }}
            >
              <RefreshCw
                className={cn('w-3.5 h-3.5', loading && 'animate-spin')}
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadZip}
              className="h-7 w-7 p-0"
              style={{ color: 'var(--ds-text-secondary)' }}
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* File tree */}
        <ScrollArea className="flex-1">
          {loading ? (
            <FileExplorerSkeleton />
          ) : files.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <Folder className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--ds-text-muted)', opacity: 0.4 }} />
              <p className="text-xs" style={{ color: 'var(--ds-text-muted)' }}>
                No files in workspace yet.
              </p>
            </div>
          ) : (
            <div className="py-1">
              {files.map((file) => (
                <FileTreeNode
                  key={file.path}
                  file={file}
                  depth={0}
                  onSelectFile={fetchFileContent}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* File preview dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col" style={{ background: 'var(--ds-bg-secondary)', border: '1px solid var(--ds-border)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-mono" style={{ color: 'var(--ds-text-primary)' }}>
              {previewFile && (
                <>
                  <Eye className="w-4 h-4" style={{ color: 'var(--ds-text-secondary)' }} />
                  {previewFile.path}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div
            className="flex-1 overflow-auto rounded-lg"
            style={{ background: 'var(--ds-tool-bg)', border: '1px solid var(--ds-tool-border)' }}
          >
            {contentLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--ds-text-secondary)' }} />
              </div>
            ) : (
              <pre
                className="p-4 text-xs whitespace-pre-wrap break-words leading-relaxed"
                style={{
                  color: 'var(--ds-text-primary)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {fileContent}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
