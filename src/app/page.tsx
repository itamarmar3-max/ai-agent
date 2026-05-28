'use client';

import { useChatStore } from '@/lib/store';
import { ChatWindow } from '@/components/ChatWindow';
import { ToolPanel } from '@/components/ToolPanel';
import { FileExplorer } from '@/components/FileExplorer';
import { Settings } from '@/components/Settings';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ProjectExplorer } from '@/components/ProjectExplorer';
import { CodeEditor } from '@/components/CodeEditor';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Wrench,
  FolderTree,
  Trash2,
  FolderOpen,
  Hexagon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useChatStream } from '@/hooks/useChatStream';

type TabType = 'tools' | 'files' | 'project';

export default function Home() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const toggleSettings = useChatStore((s) => s.toggleSettings);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const messages = useChatStore((s) => s.messages);
  const [activeTab, setActiveTab] = useState<TabType>('tools');
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  // Chat history state
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);

  // Project state
  const connectedProject = useChatStore((s) => s.connectedProject);
  const selectedProjectFile = useChatStore((s) => s.selectedProjectFile);
  const setSelectedProjectFile = useChatStore((s) => s.setSelectedProjectFile);
  const openEditorTab = useChatStore((s) => s.openEditorTab);

  // Keyboard shortcuts
  const { stopStreaming } = useChatStream();
  useKeyboardShortcuts({
    onNewChat: () => { clearMessages(); },
    onToggleSidebar: toggleSidebar,
    onFocusInput: () => {
      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder]');
      textarea?.focus();
    },
    onCloseOrStop: () => {
      const isSettingsOpen = useChatStore.getState().settingsOpen;
      const isStreaming = useChatStore.getState().isStreaming;
      if (isSettingsOpen) toggleSettings();
      else if (isStreaming) stopStreaming();
    },
  });

  const handleFileSelect = (path: string) => {
    setSelectedProjectFile(path);
    openEditorTab(path);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--ds-bg-primary)' }}>
      {/* Top bar */}
      <header
        className="flex items-center justify-between h-11 px-3 shrink-0 glass"
        style={{
          borderBottom: '1px solid var(--ds-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
            onClick={toggleSidebar}
            title="Toggle sidebar (⌘B)"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </Button>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg shadow-sm"
              style={{ background: 'var(--ds-gradient-accent)' }}
            >
              <Hexagon className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <span
              className="text-sm font-semibold tracking-tight"
              style={{ color: 'var(--ds-text-primary)' }}
            >
              Agent
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            title={rightPanelOpen ? 'Close project panel' : 'Open project panel'}
          >
            {rightPanelOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </Button>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--ds-text-secondary)] hover:text-[var(--ds-error)] hover:bg-[var(--ds-error-soft)]"
              onClick={clearMessages}
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
            onClick={toggleSettings}
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main content area - 3-panel flex layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat Sidebar */}
        <div
          className={cn(
            'shrink-0 transition-panel overflow-hidden',
            sidebarOpen ? 'w-[260px]' : 'w-0'
          )}
          style={{ minWidth: 0 }}
        >
          <div className="w-[260px] h-full">
            <ErrorBoundary name="Chat Sidebar">
              <ChatSidebar
                activeChatId={activeChatId ?? null}
                isOpen={sidebarOpen}
                onSelectChat={(id) => { setActiveChatId(id); toggleSidebar(); }}
                onNewChat={clearMessages}
                onClose={toggleSidebar}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Center Panel - Chat Window */}
        <main className="h-full flex-1 min-w-0">
          <ErrorBoundary name="Chat">
            <ChatWindow />
          </ErrorBoundary>
        </main>

        {/* Right Panel */}
        <div
          className={cn(
            'shrink-0 transition-panel overflow-hidden',
            rightPanelOpen ? 'w-[340px]' : 'w-0'
          )}
          style={{ minWidth: 0 }}
        >
          <aside
            className="w-[340px] h-full flex flex-col overflow-hidden"
            style={{
              borderLeft: '1px solid var(--ds-border)',
              background: 'var(--ds-bg-secondary)',
            }}
          >
            {/* Tab selector - uses ONLY activeTab */}
            <div
              className="flex shrink-0"
              style={{ borderBottom: '1px solid var(--ds-border)' }}
            >
              <button
                onClick={() => setActiveTab('tools')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2',
                  activeTab === 'tools'
                    ? 'border-[var(--ds-accent)] text-[var(--ds-accent)]'
                    : 'border-transparent text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)]'
                )}
              >
                <Wrench className="w-3.5 h-3.5" />
                Tools
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2',
                  activeTab === 'files'
                    ? 'border-[var(--ds-accent)] text-[var(--ds-accent)]'
                    : 'border-transparent text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)]'
                )}
              >
                <FolderTree className="w-3.5 h-3.5" />
                Files
              </button>
              <button
                onClick={() => setActiveTab('project')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2',
                  activeTab === 'project'
                    ? 'border-[var(--ds-accent)] text-[var(--ds-accent)]'
                    : 'border-transparent text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)]'
                )}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Project
              </button>
            </div>

            {/* Tab content - uses ONLY activeTab */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {activeTab === 'tools' && (
                <div className="flex-1 overflow-hidden">
                  <ErrorBoundary name="Tool Panel">
                    <ToolPanel />
                  </ErrorBoundary>
                </div>
              )}
              {activeTab === 'files' && (
                <div className="flex-1 overflow-hidden">
                  <ErrorBoundary name="File Explorer">
                    <FileExplorer />
                  </ErrorBoundary>
                </div>
              )}
              {activeTab === 'project' && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div
                    className="flex-1 overflow-hidden"
                    style={{ borderBottom: '1px solid var(--ds-border)' }}
                  >
                    <ErrorBoundary name="Project Explorer">
                      <ProjectExplorer
                        projectName={connectedProject}
                        onFileSelect={handleFileSelect}
                        selectedFile={selectedProjectFile}
                      />
                    </ErrorBoundary>
                  </div>
                  {selectedProjectFile && (
                    <div className="flex-1 overflow-hidden">
                      <ErrorBoundary name="Code Editor">
                        <CodeEditor
                          filePath={selectedProjectFile}
                          projectName={connectedProject}
                        />
                      </ErrorBoundary>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Settings sheet */}
      <Settings />
    </div>
  );
}
