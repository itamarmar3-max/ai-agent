'use client';

import { useChatStore } from '@/lib/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X, Save, FileCode, Copy, Maximize2, Minimize2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface CodeEditorProps {
  filePath: string | null;
  projectName: string | null;
  onSave?: (path: string, content: string) => void;
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript JSX',
    js: 'JavaScript',
    jsx: 'JavaScript JSX',
    py: 'Python',
    json: 'JSON',
    md: 'Markdown',
    css: 'CSS',
    html: 'HTML',
    svg: 'SVG',
    sh: 'Shell',
    yml: 'YAML',
    yaml: 'YAML',
    toml: 'TOML',
    env: 'Environment',
    sql: 'SQL',
    rs: 'Rust',
    go: 'Go',
    java: 'Java',
    c: 'C',
    cpp: 'C++',
    h: 'C Header',
    rb: 'Ruby',
    php: 'PHP',
    vue: 'Vue',
    svelte: 'Svelte',
  };
  return langMap[ext] || 'Plain Text';
}

function getLineCount(content: string): number {
  return content.split('\n').length;
}

export function CodeEditor({ filePath, projectName, onSave }: CodeEditorProps) {
  const openEditorTabs = useChatStore((s) => s.openEditorTabs);
  const closeEditorTab = useChatStore((s) => s.closeEditorTab);
  const setSelectedProjectFile = useChatStore((s) => s.setSelectedProjectFile);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Use filePath or activeTab as the currently viewed file
  const currentFile = activeTab || filePath;

  const [fileContent, setFileContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  // Fetch file content from API when current file changes
  useEffect(() => {
    if (!currentFile || !projectName) return;
    let cancelled = false;
    setContentLoading(true);
    setFileContent(null);
    fetch(`/api/project?action=file&project=${encodeURIComponent(projectName)}&file=${encodeURIComponent(currentFile)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data?.file?.content) {
          setFileContent(data.file.content);
        } else if (!cancelled) {
        setFileContent(null);
      }
      })
      .catch(() => { if (!cancelled) setFileContent(null); })
      .finally(() => { if (!cancelled) setContentLoading(false); });
    return () => { cancelled = true; };
  }, [currentFile, projectName]);

  const handleTabClick = (path: string) => {
    setActiveTab(path);
    setSelectedProjectFile(path);
  };

  const handleCopyContent = async () => {
    if (fileContent) {
      await navigator.clipboard.writeText(fileContent);
      toast.success('Copied to clipboard');
    }
  };

  if (openEditorTabs.length === 0 && !currentFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2.5 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Editor
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <FileCode className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground/60">
              No file open
            </p>
            <p className="text-xs text-muted-foreground/40 mt-1">
              Select a file from the project explorer
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex flex-col h-full',
      isFullscreen && 'fixed inset-0 z-50 bg-background'
    )}>
      {/* Editor header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Editor
        </span>
        <div className="flex items-center gap-1">
          {currentFile && fileContent && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopyContent}
              title="Copy content"
            >
              <Copy className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      {openEditorTabs.length > 0 && (
        <div className="flex border-b border-border overflow-x-auto shrink-0">
          {openEditorTabs.map((tabPath) => {
            const fileName = tabPath.split('/').pop() || tabPath;
            const isActive = tabPath === currentFile;
            return (
              <div
                key={tabPath}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 border-r border-border cursor-pointer min-w-0 shrink-0 transition-colors',
                  isActive
                    ? 'bg-background text-foreground border-b-2 border-b-emerald-500'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                )}
                onClick={() => handleTabClick(tabPath)}
              >
                <FileCode className="w-3 h-3 shrink-0" />
                <span className="text-[11px] font-medium truncate max-w-[100px]">
                  {fileName}
                </span>
                <button
                  className="ml-1 hover:bg-muted rounded p-0.5 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeEditorTab(tabPath);
                    if (activeTab === tabPath) {
                      setActiveTab(null);
                    }
                  }}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* File info bar */}
      {currentFile && (
        <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-muted/10 shrink-0">
          <Badge variant="outline" className="text-[10px] h-5">
            {getLanguageFromPath(currentFile)}
          </Badge>
          {fileContent && (
            <span className="text-[10px] text-muted-foreground">
              {getLineCount(fileContent)} lines
            </span>
          )}
        </div>
      )}

      {/* Code content */}
      <ScrollArea className="flex-1">
        {fileContent ? (
          <div className="p-3">
            <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
              <code>{fileContent}</code>
            </pre>
          </div>
        ) : currentFile ? (
          <div className="flex items-center justify-center h-full py-12">
            <div className="text-center">
              <FileCode className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground/60">
                {currentFile.split('/').pop()}
              </p>
              <p className="text-[10px] text-muted-foreground/40 mt-1">
                File content not loaded
              </p>
            </div>
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}
