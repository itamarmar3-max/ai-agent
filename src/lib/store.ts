'use client';

import { create } from 'zustand';
import type { ChatMessage, AppSettings, ToolCall, WorkspaceFile, Plan, Subtask, PerformanceStats, SkillInfo, AgentRole, AgentActivity, ChatHistory, StreamState, HealthMetrics, RetryInfo, AttachedFile } from '@/types';

const SETTINGS_STORAGE_KEY = 'ai-agent-settings';

const defaultSettings: AppSettings = {
  primaryApi: {
    apiKey: '',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.1-405b-instruct',
  },
  imageApi: {
    provider: 'nvidia',
    apiKey: '',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'stabilityai/stable-diffusion-xl',
  },
  githubToken: '',
};

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      return {
        primaryApi: { ...defaultSettings.primaryApi, ...parsed.primaryApi },
        imageApi: { ...defaultSettings.imageApi, ...parsed.imageApi },
        githubToken: parsed.githubToken ?? '',
      };
    }
  } catch {
    // ignore parse errors
  }
  return defaultSettings;
}

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentToolCall: ToolCall | null;
  settings: AppSettings;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  toolCallHistory: ToolCall[];
  workspaceFiles: WorkspaceFile[];
  workspaceRefreshKey: number;
  selectedFilePath: string | null;
  plan: Plan | null;
  subtasks: Subtask[];
  performance: PerformanceStats | null;
  sessionStartTime: number;
  progress: { current: number; total: number; description: string } | null;
  activeSkill: SkillInfo | null;
  manualSkill: string | null; // null = auto-detect, string = manual override
  skillClarification: string | null;

  // Multi-agent state
  activeAgent: AgentRole | null;
  agentActivities: AgentActivity[];

  // Chat history state
  chatHistories: ChatHistory[];
  activeChatId: string | null;

  // Attached files state
  attachedFiles: AttachedFile[];

  // Project state
  connectedProject: string | null;
  projectFiles: any[];
  selectedProjectFile: string | null;
  openEditorTabs: string[];

  // Streaming control state
  streamState: StreamState;
  pausedMessage: string | null;

  // Context compression state
  contextCompressed: boolean;
  tokenUsage: { total: number; percentage: number } | null;

  // Reliability state
  healthMetrics: HealthMetrics | null;
  currentRetry: RetryInfo | null;

  // Actions
  setMessages: (msgs: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setStreaming: (streaming: boolean) => void;
  setCurrentToolCall: (toolCall: ToolCall | null) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  saveSettings: () => void;
  resetSettings: () => void;
  toggleSidebar: () => void;
  toggleSettings: () => void;
  clearMessages: () => void;
  addToToolCallHistory: (toolCall: ToolCall) => void;
  updateToolCallInHistory: (id: string, updates: Partial<ToolCall>) => void;
  clearToolCallHistory: () => void;
  setWorkspaceFiles: (files: WorkspaceFile[]) => void;
  triggerWorkspaceRefresh: () => void;
  setSelectedFilePath: (path: string | null) => void;
  setPlan: (plan: Plan | null) => void;
  setSubtasks: (subtasks: Subtask[]) => void;
  updateSubtask: (id: number, updates: Partial<Subtask>) => void;
  setPerformance: (stats: PerformanceStats | null) => void;
  setProgress: (progress: { current: number; total: number; description: string } | null) => void;
  setActiveSkill: (skill: SkillInfo | null) => void;
  setManualSkill: (skill: string | null) => void;
  setSkillClarification: (question: string | null) => void;

  // Multi-agent actions
  setActiveAgent: (agent: AgentRole | null) => void;
  addAgentActivity: (activity: AgentActivity) => void;
  clearAgentActivities: () => void;

  // Chat history actions
  setChatHistories: (histories: ChatHistory[]) => void;
  setActiveChatId: (id: string | null) => void;

  // Project actions
  setConnectedProject: (name: string | null) => void;
  setProjectFiles: (files: any[]) => void;
  setSelectedProjectFile: (path: string | null) => void;
  openEditorTab: (path: string) => void;
  closeEditorTab: (path: string) => void;

  // Streaming control actions
  setStreamState: (state: StreamState) => void;
  setPausedMessage: (msg: string | null) => void;

  // Context compression actions
  setContextCompressed: (compressed: boolean) => void;
  setTokenUsage: (usage: { total: number; percentage: number } | null) => void;

  // Attached file actions
  addAttachedFile: (file: AttachedFile) => void;
  removeAttachedFile: (name: string) => void;
  clearAttachedFiles: () => void;

  // Reliability actions
  setHealthMetrics: (metrics: HealthMetrics | null) => void;
  setCurrentRetry: (retry: RetryInfo | null) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentToolCall: null,
  settings: defaultSettings,
  sidebarOpen: true,
  settingsOpen: false,
  toolCallHistory: [],
  workspaceFiles: [],
  workspaceRefreshKey: 0,
  selectedFilePath: null,
  plan: null,
  subtasks: [],
  performance: null,
  sessionStartTime: Date.now(),
  progress: null,
  activeSkill: null,
  manualSkill: null,
  skillClarification: null,

  // Multi-agent state
  activeAgent: null,
  agentActivities: [],

  // Chat history state
  chatHistories: [],
  activeChatId: null,

  // Attached files state
  attachedFiles: [],

  // Project state
  connectedProject: null,
  projectFiles: [],
  selectedProjectFile: null,
  openEditorTabs: [],

  // Streaming control state
  streamState: 'idle' as StreamState,
  pausedMessage: null,

  // Context compression state
  contextCompressed: false,
  tokenUsage: null,

  // Reliability state
  healthMetrics: null,
  currentRetry: null,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setCurrentToolCall: (toolCall) => set({ currentToolCall: toolCall }),

  setMessages: (msgs) => set({ messages: msgs }),

  updateSettings: (newSettings) =>
    set((state) => ({
      settings: {
        primaryApi: { ...state.settings.primaryApi, ...newSettings.primaryApi },
        imageApi: { ...state.settings.imageApi, ...newSettings.imageApi },
        githubToken: newSettings.githubToken !== undefined ? newSettings.githubToken : state.settings.githubToken,
      } as AppSettings,
    })),

  saveSettings: () => {
    const { settings } = get();
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  },

  resetSettings: () => {
    set({ settings: defaultSettings });
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // ignore
    }
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),

  clearMessages: () =>
    set({
      messages: [],
      attachedFiles: [],
      toolCallHistory: [],
      currentToolCall: null,
      plan: null,
      subtasks: [],
      performance: null,
      progress: null,
      sessionStartTime: Date.now(),
      activeAgent: null,
      agentActivities: [],
      contextCompressed: false,
      tokenUsage: null,
      streamState: 'idle' as StreamState,
      pausedMessage: null,
    }),

  addToToolCallHistory: (toolCall) =>
    set((state) => ({
      toolCallHistory: [...state.toolCallHistory, toolCall],
    })),

  updateToolCallInHistory: (id, updates) =>
    set((state) => ({
      toolCallHistory: state.toolCallHistory.map((tc) =>
        tc.id === id ? { ...tc, ...updates } : tc
      ),
    })),

  clearToolCallHistory: () => set({ toolCallHistory: [], currentToolCall: null }),

  setWorkspaceFiles: (files) => set({ workspaceFiles: files }),

  triggerWorkspaceRefresh: () =>
    set((state) => ({ workspaceRefreshKey: state.workspaceRefreshKey + 1 })),

  setSelectedFilePath: (path) => set({ selectedFilePath: path }),

  setPlan: (plan) => set({ plan }),

  setSubtasks: (subtasks) => set({ subtasks }),

  updateSubtask: (id, updates) =>
    set((state) => {
      const idx = state.subtasks.findIndex((st) => st.id === id);
      if (idx !== -1) {
        const updated = [...state.subtasks];
        updated[idx] = { ...updated[idx], ...updates };
        return { subtasks: updated };
      }
      return state;
    }),

  setPerformance: (performance) => set({ performance }),

  setProgress: (progress) => set({ progress }),

  setActiveSkill: (activeSkill) => set({ activeSkill }),

  setManualSkill: (manualSkill) => set({ manualSkill }),

  setSkillClarification: (skillClarification) => set({ skillClarification }),

  // Multi-agent actions
  setActiveAgent: (activeAgent) => set({ activeAgent }),
  addAgentActivity: (activity) =>
    set((state) => ({
      agentActivities: [...state.agentActivities, activity],
    })),
  clearAgentActivities: () => set({ agentActivities: [] }),

  // Chat history actions
  setChatHistories: (chatHistories) => set({ chatHistories }),
  setActiveChatId: (activeChatId) => set({ activeChatId }),

  // Project actions
  setConnectedProject: (connectedProject) => set({ connectedProject }),
  setProjectFiles: (projectFiles) => set({ projectFiles }),
  setSelectedProjectFile: (selectedProjectFile) => set({ selectedProjectFile }),
  openEditorTab: (path) =>
    set((state) => {
      if (state.openEditorTabs.includes(path)) return state;
      return { openEditorTabs: [...state.openEditorTabs, path] };
    }),
  closeEditorTab: (path) =>
    set((state) => ({
      openEditorTabs: state.openEditorTabs.filter((t) => t !== path),
      selectedProjectFile: state.selectedProjectFile === path ? null : state.selectedProjectFile,
    })),

  // Streaming control actions
  setStreamState: (streamState) => set({ streamState }),
  setPausedMessage: (pausedMessage) => set({ pausedMessage }),

  // Context compression actions
  setContextCompressed: (contextCompressed) => set({ contextCompressed }),
  setTokenUsage: (tokenUsage) => set({ tokenUsage }),

  addAttachedFile: (file) => set((state) => ({ attachedFiles: [...state.attachedFiles, file] })),
  removeAttachedFile: (name) => set((state) => ({ attachedFiles: state.attachedFiles.filter(f => f.name !== name) })),
  clearAttachedFiles: () => set({ attachedFiles: [] }),

  // Reliability actions
  setHealthMetrics: (healthMetrics) => set({ healthMetrics }),
  setCurrentRetry: (currentRetry) => set({ currentRetry }),
}));

// Initialize settings from localStorage on client
if (typeof window !== 'undefined') {
  const stored = loadSettings();
  useChatStore.setState({ settings: stored });
}
