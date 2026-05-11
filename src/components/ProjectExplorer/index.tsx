'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  FolderOpen,
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Upload,
  Search,
  FileCode,
  FileText,
  FileJson,
  Image as ImageIcon,
  Archive,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────

interface ProjectExplorerProps {
  projectName: string | null;
  onFileSelect: (filePath: string) => void;
  selectedFile: string | null;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

// ── Helpers ────────────────────────────────────────────────────────

function getFileIcon(name: string): { icon: typeof File; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, { icon: typeof FileCode; color: string }> = {
    ts: { icon: FileCode, color: 'text-emerald-400' },
    tsx: { icon: FileCode, color: 'text-emerald-400' },
    js: { icon: FileCode, color: 'text-yellow-400' },
    jsx: { icon: FileCode, color: 'text-yellow-400' },
    json: { icon: FileJson, color: 'text-emerald-300' },
    md: { icon: FileText, color: 'text-gray-400' },
    txt: { icon: FileText, color: 'text-gray-400' },
    png: { icon: ImageIcon, color: 'text-pink-400' },
    jpg: { icon: ImageIcon, color: 'text-pink-400' },
    jpeg: { icon: ImageIcon, color: 'text-pink-400' },
    gif: { icon: ImageIcon, color: 'text-pink-400' },
    svg: { icon: ImageIcon, color: 'text-orange-400' },
    ico: { icon: ImageIcon, color: 'text-orange-400' },
    webp: { icon: ImageIcon, color: 'text-pink-400' },
    html: { icon: FileCode, color: 'text-orange-400' },
    css: { icon: FileCode, color: 'text-purple-400' },
    scss: { icon: FileCode, color: 'text-purple-400' },
    py: { icon: FileCode, color: 'text-emerald-400' },
    rs: { icon: FileCode, color: 'text-red-400' },
    kt: { icon: FileCode, color: 'text-violet-400' },
    java: { icon: FileCode, color: 'text-red-400' },
    xml: { icon: FileCode, color: 'text-sky-400' },
    yaml: { icon: FileJson, color: 'text-emerald-300' },
    yml: { icon: FileJson, color: 'text-emerald-300' },
    sh: { icon: FileText, color: 'text-gray-300' },
    sql: { icon: FileText, color: 'text-sky-300' },
    gradle: { icon: FileText, color: 'text-emerald-300' },
    zip: { icon: Archive, color: 'text-yellow-500' },
  };
  return map[ext] || { icon: File, color: 'text-muted-foreground' };
}

/** Recursively filter tree by query, keeping ancestor directories. */
function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const lower = query.toLowerCase();
  return nodes.reduce<TreeNode[]>((acc, node) => {
    if (node.type === 'directory') {
      const filtered = filterTree(node.children ?? [], query);
      if (filtered.length > 0) {
        acc.push({ ...node, children: filtered });
      }
    } else {
      if (node.name.toLowerCase().includes(lower)) {
        acc.push(node);
      }
    }
    return acc;
  }, []);
}

// ── Sub-components ─────────────────────────────────────────────────

function TreeItem({
  node,
  depth,
  selectedFile,
  onSelectFile,
  defaultOpen,
}: {
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isSelected = selectedFile === node.path;

  // Directory node
  if (node.type === 'directory') {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className={cn(
            'flex items-center gap-1.5 w-full px-2 py-1 hover:bg-emerald-500/10 transition-colors rounded-md group text-left',
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          {open ? (
            <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="text-xs text-foreground truncate font-medium">
            {node.name}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {(node.children ?? []).map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              defaultOpen={depth < 1}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // File node
  const { icon: FileIcon, color } = getFileIcon(node.name);

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={cn(
        'flex items-center gap-1.5 w-full px-2 py-1 hover:bg-emerald-500/10 transition-colors rounded-md group text-left',
        isSelected && 'bg-emerald-500/15 hover:bg-emerald-500/20',
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <FileIcon className={cn('w-4 h-4 shrink-0', color)} />
      <span
        className={cn(
          'text-xs truncate',
          isSelected ? 'text-emerald-400 font-medium' : 'text-foreground',
        )}
      >
        {node.name}
      </span>
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export function ProjectExplorer({
  projectName,
  onFileSelect,
  selectedFile,
}: ProjectExplorerProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch tree ─────────────────────────────────────────────────
  const fetchTree = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'tree',
        project: projectName,
      });
      const res = await fetch(`/api/project?${params}`);
      if (!res.ok) throw new Error('Failed to load project tree');
      const data = await res.json();
      setTree(data.tree ?? []);
    } catch (err) {
      console.error('Failed to fetch tree:', err);
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  useEffect(() => {
    if (projectName) {
      fetchTree();
      setSearchQuery('');
    } else {
      setTree([]);
    }
  }, [projectName, fetchTree]);

  // ── Filtered tree ─────────────────────────────────────────────
  const filteredTree = useMemo(
    () => filterTree(tree, searchQuery),
    [tree, searchQuery],
  );

  // ── File counts for empty state ────────────────────────────────
  const totalFiles = useMemo(() => {
    const count = (nodes: TreeNode[]) =>
      nodes.reduce(
        (n, node) =>
          n + (node.type === 'file' ? 1 : count(node.children ?? [])),
        0,
      );
    return count(tree);
  }, [tree]);

  // ── Upload ZIP handler ─────────────────────────────────────────
  const handleUploadZip = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!newProjectName.trim()) {
        setUploadError('Please enter a project name first.');
        return;
      }
      setUploading(true);
      setUploadError(null);
      try {
        const formData = new FormData();
        formData.append('action', 'upload_zip');
        formData.append('project', newProjectName.trim());
        formData.append('zip', file);
        const res = await fetch('/api/project', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Upload failed');
        }
        // Success — the parent should update `projectName`
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
        // Reset the file input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [newProjectName],
  );

  // ── Render: No project connected ───────────────────────────────
  if (!projectName) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <FolderOpen className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-foreground">Explorer</h3>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="rounded-full bg-emerald-500/10 p-4">
            <Upload className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">
              Connect a project to browse files
            </p>
            <p className="text-xs text-muted-foreground">
              Upload a ZIP archive of your project to get started.
            </p>
          </div>

          {/* Project name input */}
          <div className="w-full max-w-xs space-y-2">
            <Input
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="h-9 text-sm"
            />

            {/* Upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleUploadZip}
            />
            <Button
              className="w-full h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !newProjectName.trim()}
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload ZIP
                </>
              )}
            </Button>

            {uploadError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <X className="w-3 h-3 shrink-0" />
                {uploadError}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Project connected ──────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <FolderOpen className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm font-semibold text-foreground truncate">
          {projectName}
        </h3>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={fetchTree}
            disabled={loading}
          >
            <RefreshCw
              className={cn('w-3.5 h-3.5', loading && 'animate-spin')}
            />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleUploadZip}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-500"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload
              className={cn('w-3.5 h-3.5', uploading && 'animate-pulse')}
            />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs pl-8 bg-muted/40 border-transparent focus:border-emerald-500/50 focus:bg-muted"
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Upload error banner */}
      {uploadError && (
        <div className="px-3 py-1.5 bg-destructive/10 border-b border-destructive/20">
          <p className="text-xs text-destructive">{uploadError}</p>
        </div>
      )}

      {/* File tree */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="px-4 py-10 text-center space-y-2">
            {searchQuery ? (
              <>
                <Search className="w-5 h-5 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">
                  No files matching &quot;{searchQuery}&quot;
                </p>
              </>
            ) : (
              <>
                <Folder className="w-5 h-5 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">
                  This project has no files yet.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="py-1">
            {filteredTree.map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                selectedFile={selectedFile}
                onSelectFile={onFileSelect}
                defaultOpen={false}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Status bar */}
      <div className="px-4 py-1.5 border-t border-border bg-muted/30">
        <p className="text-[10px] text-muted-foreground">
          {totalFiles} file{totalFiles !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
