// ============================================================
// AI Agent System - Type Definitions
// ============================================================

// === Skill Types ===
export interface SkillInfo {
  name: string;
  displayName: string;
  icon: string;
  confidence: number;
}

// === Planning Types ===
export interface Plan {
  goal: string;
  steps: string[];
  tools_needed: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
}

// === Task Decomposition Types ===
export interface Subtask {
  id: number;
  task: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTool?: string;
}

export interface TaskDecomposition {
  mainTask: string;
  complexity: 'low' | 'medium' | 'high';
  subtasks: Subtask[];
}

// === Performance Stats ===
export interface PerformanceStats {
  totalToolCalls: number;
  totalTokens: number;
  sessionDuration: number;
  averageResponseTime: number;
  toolUsageCounts: Record<string, number>;
  sessionStartTime: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  images?: string[]; // base64 images embedded in message
  plan?: Plan;                  // NEW: the plan for this response
  subtasks?: Subtask[];         // NEW: task decomposition
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'running' | 'completed' | 'error';
  timestamp: number;
  duration?: number;          // NEW: how long the tool took in ms
  retryCount?: number;         // NEW: number of retries
  isParallel?: boolean;        // NEW: whether this ran in parallel
  batchId?: string;            // NEW: group ID for parallel tools
}

export interface ApiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ImageApiSettings {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AppSettings {
  primaryApi: ApiSettings;
  imageApi: ImageApiSettings;
  githubToken?: string;
}

export interface AttachedFile {
  name: string;
  content: string;
  type: 'text' | 'image';
  size: number;
}

export interface WorkspaceFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: WorkspaceFile[];
  content?: string;
  size?: number;
}

// === Multi-Agent Types ===
export type AgentRole = 'planner' | 'executor' | 'reviewer' | 'general';

export interface AgentActivity {
  role: AgentRole;
  status: 'active' | 'idle' | 'completed' | 'failed';
  description: string;
  timestamp: number;
}

export interface StreamEvent {
  type: 'token' | 'tool_start' | 'tool_end' | 'tool_error' | 'done' | 'error' | 'image'
      | 'plan' | 'reflection' | 'subtask_update' | 'progress' | 'performance'
      | 'skill_detected' | 'skill_clarify'
      | 'agent_activity' | 'context_compressed' | 'rag_injected' | 'interrupt'
      | 'retry' | 'health_update' | 'intent';
  data: unknown;
}

// === Chat History Types ===
export interface ChatHistory {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  messages: ChatMessage[];
  skill_used: string | null;
  project_context: string | null;
  pinned: boolean;
}

// === RAG Types ===
export interface RAGChunk {
  id: string;
  file_path: string;
  chunk_index: number;
  content: string;
  project_name: string;
  metadata?: Record<string, string>;
}

export interface RAGQueryResult {
  chunk: RAGChunk;
  score: number;
}

// === Project Types ===
export interface ProjectFile {
  path: string;
  name: string;
  content: string;
  language: string;
  size: number;
  modified_at: number;
  isDirty: boolean;  // unsaved changes
}

export interface ProjectDiff {
  filePath: string;
  additions: string[];
  deletions: string[];
  description: string;
  accepted: boolean | null;  // null = pending
}

// === Streaming Control Types ===
export type StreamState = 'idle' | 'streaming' | 'paused';
export type InterruptAction = 'stop' | 'pause' | 'redirect';

// === Reliability Types ===
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthMetrics {
  status: HealthStatus;
  apiAvgResponseMs: number;
  apiP95ResponseMs: number;
  apiErrorRate: number;
  toolSuccessRate: number;
  tokensUsed: number;
  errorsPerMinute: number;
  mostFailingTool: string | null;
  totalToolCalls: number;
  totalAPICalls: number;
  uptime: number;
}

export interface RetryInfo {
  attempt: number;
  maxRetries: number;
  reason: string;
  waitMs?: number;
}
