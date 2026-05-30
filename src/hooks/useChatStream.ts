'use client';

import { useRef, useCallback } from 'react';
import { useChatStore } from '@/lib/store';
import type { ChatMessage, ToolCall, StreamEvent, Plan, Subtask, PerformanceStats, SkillInfo, AgentActivity, AttachedFile } from '@/types';
import { toast } from 'sonner';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChatStream() {
  const {
    messages,
    settings,
    addMessage,
    updateMessage,
    setStreaming,
    setCurrentToolCall,
    addToToolCallHistory,
    updateToolCallInHistory,
    triggerWorkspaceRefresh,
  } = useChatStore();

  const abortControllerRef = useRef<AbortController | null>(null);
  const assistantIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (content: string, attachments: AttachedFile[] = []) => {
      const trimmed = content.trim();
      if (!trimmed && attachments.length === 0) return;
      if (useChatStore.getState().isStreaming) return;

      const settings = useChatStore.getState().settings;
      if (!settings.primaryApi.apiKey) {
        toast.warning('API key missing', {
          description: 'Open Settings to configure your API key before sending a message.',
          duration: 5000,
        });
        return;
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      const assistantId = generateId();
      assistantIdRef.current = assistantId;

      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [],
        images: [],
      };

      addMessage(userMessage);
      addMessage(assistantMessage);
      setStreaming(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const allMessages = [...messages, userMessage];
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            settings: useChatStore.getState().settings,
            skill: useChatStore.getState().manualSkill,
            project: useChatStore.getState().connectedProject || null,
            mode:
              useChatStore.getState().responseMode === 'auto'
                ? undefined
                : useChatStore.getState().responseMode,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let currentToolCalls: ToolCall[] = [];
        let currentImages: string[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

            const jsonStr = trimmedLine.slice(6);
            if (jsonStr === '[DONE]') continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(jsonStr) as StreamEvent;
            } catch {
              continue;
            }

            switch (event.type) {
              case 'token': {
                const token = event.data as string;
                fullContent += token;
                updateMessage(assistantId, { content: fullContent });
                break;
              }

              case 'tool_start': {
                const toolData = event.data as {
                  name: string;
                  input: Record<string, unknown>;
                };
                const toolCall: ToolCall = {
                  id: generateId(),
                  name: toolData.name,
                  input: toolData.input,
                  status: 'running',
                  timestamp: Date.now(),
                };
                currentToolCalls.push(toolCall);
                setCurrentToolCall(toolCall);
                addToToolCallHistory(toolCall);
                updateMessage(assistantId, { toolCalls: [...currentToolCalls] });
                break;
              }

              case 'tool_end': {
                const endData = event.data as {
                  name: string;
                  output: string;
                  duration?: number;
                  timestamp?: number;
                };
                // Toast for file-related tools
                if (endData.name === 'write_file') {
                  const inputMatch = currentToolCalls.find(tc => tc.name === 'write_file' && tc.status === 'running');
                  if (inputMatch?.input?.path) {
                    toast.success('File written', { description: String(inputMatch.input.path) });
                  }
                }
                // Match by name + earliest-start to handle parallel same-named tools correctly
                const candidates = currentToolCalls
                  .map((tc, idx) => ({ tc, idx }))
                  .filter(({ tc }) => tc.name === endData.name && tc.status === 'running');
                const matchEntry = candidates.length > 0 ? candidates[0] : null;
                if (matchEntry) {
                  const { tc: lastTool, idx } = matchEntry;
                  currentToolCalls[idx] = {
                    ...currentToolCalls[idx],
                    status: 'completed',
                    output: endData.output,
                    duration: endData.duration,
                  };
                  updateToolCallInHistory(lastTool.id, {
                    status: 'completed',
                    output: endData.output,
                    duration: endData.duration,
                  });
                  updateMessage(assistantId, {
                    toolCalls: [...currentToolCalls],
                  });
                }
                // Refresh workspace after file-related tools
                const fileToolNames = [
                  'write_file',
                  'delete_file',
                  'create_zip',
                  'extract_zip',
                  'webpage_screenshot',
                  'generate_file_structure',
                  'memory_save',
                ];
                if (fileToolNames.includes(endData.name)) {
                  triggerWorkspaceRefresh();
                }
                break;
              }

              case 'tool_error': {
                const errData = event.data as {
                  name: string;
                  error: string;
                };
                toast.error(`Tool failed: ${errData.name}`, {
                  description: errData.error?.substring(0, 100) || 'Unknown error',
                  duration: 4000,
                });
                const errCandidates = currentToolCalls
                  .map((tc, idx) => ({ tc, idx }))
                  .filter(({ tc }) => tc.name === errData.name && tc.status === 'running');
                const errEntry = errCandidates.length > 0 ? errCandidates[0] : null;
                if (errEntry) {
                  const { tc: lastToolErr, idx } = errEntry;
                  currentToolCalls[idx] = {
                    ...currentToolCalls[idx],
                    status: 'error',
                    output: `Error: ${errData.error}`,
                  };
                  updateToolCallInHistory(lastToolErr.id, {
                    status: 'error',
                    output: `Error: ${errData.error}`,
                  });
                  updateMessage(assistantId, {
                    toolCalls: [...currentToolCalls],
                  });
                }
                break;
              }

              case 'image': {
                const imageData = event.data as string;
                currentImages.push(imageData);
                updateMessage(assistantId, { images: [...currentImages] });
                break;
              }

              case 'done': {
                setCurrentToolCall(null);
                useChatStore.getState().setCurrentRetry(null);
                toast.success('Response complete', { description: 'Chat saved', duration: 2000 });

                // Save to chat history
                try {
                  const state = useChatStore.getState();
                  const msgs = state.messages;
                  const chatId = state.activeChatId;

                  if (msgs.length >= 2) {
                    if (chatId) {
                      // Add latest messages to existing chat
                      await fetch('/api/history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'addMessages',
                          chatId,
                          messages: msgs.slice(-2),
                        }),
                      });
                    } else {
                      // Create new chat
                      const title = msgs[0]?.content?.slice(0, 50) || 'New Chat';
                      const res = await fetch('/api/history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'create',
                          title,
                          messages: msgs,
                        }),
                      });
                      const data = await res.json();
                      if (data.chat?.id) {
                        state.setActiveChatId(data.chat.id);
                      }
                    }
                  }
                } catch {
                  // Non-critical — history save failure
                }
                break;
              }

              case 'error': {
                const errorMsg = event.data as string;
                updateMessage(assistantId, {
                  content: fullContent || `Error: ${errorMsg}`,
                });
                toast.error('Stream error', { description: errorMsg });
                break;
              }

              case 'plan': {
                const planData = event.data as Plan;
                updateMessage(assistantId, { plan: planData });
                useChatStore.getState().setPlan(planData);
                break;
              }

              case 'reflection': {
                // Reflection events are informational — show in tool call history
                // The reflection data contains { toolName, success, shouldRetry, analysis }
                // We can attach this info to the current running tool call
                const reflData = event.data as { toolName: string; success: boolean; shouldRetry: boolean; analysis: string };
                const runningTool = [...currentToolCalls].reverse().find(
                  (tc) => tc.name === reflData.toolName && tc.status === 'running'
                );
                if (runningTool) {
                  const idx = currentToolCalls.findIndex((tc) => tc.id === runningTool.id);
                  if (idx !== -1) {
                    currentToolCalls[idx] = {
                      ...currentToolCalls[idx],
                      output: currentToolCalls[idx].output
                        ? `${currentToolCalls[idx].output}\n[Reflection: ${reflData.analysis}]`
                        : `[Reflection: ${reflData.analysis}]`,
                    };
                    updateToolCallInHistory(runningTool.id, {
                      output: currentToolCalls[idx].output,
                    });
                    updateMessage(assistantId, { toolCalls: [...currentToolCalls] });
                  }
                }
                break;
              }

              case 'subtask_update': {
                const subtask = event.data as Subtask;
                const store = useChatStore.getState();
                const existing = store.subtasks;
                const idx = existing.findIndex(st => st.id === subtask.id);
                if (idx !== -1) {
                  const updated = [...existing];
                  updated[idx] = subtask;
                  useChatStore.setState({ subtasks: updated });
                } else {
                  useChatStore.setState({ subtasks: [...existing, subtask] });
                }
                break;
              }

              case 'progress': {
                // Progress events are informational — show in progress bar
                const progData = event.data as { current: number; total: number; description: string };
                useChatStore.getState().setProgress(progData);
                break;
              }

              case 'performance': {
                const perfData = event.data as PerformanceStats;
                useChatStore.getState().setPerformance(perfData);
                break;
              }

              case 'skill_detected': {
                const skillData = event.data as SkillInfo | null;
                useChatStore.getState().setActiveSkill(skillData);
                break;
              }

              case 'skill_clarify': {
                const clarifyData = event.data as { question: string; alternatives: string[] };
                useChatStore.getState().setSkillClarification(clarifyData.question);
                break;
              }

              case 'agent_activity': {
                const actData = event.data as AgentActivity;
                useChatStore.getState().addAgentActivity(actData);
                useChatStore.getState().setActiveAgent(actData.role);
                break;
              }

              case 'context_compressed': {
                useChatStore.getState().setContextCompressed(true);
                break;
              }

              case 'rag_injected': {
                // Informational — RAG context was injected
                break;
              }

              case 'interrupt': {
                // Handle interrupt events from server
                break;
              }

              case 'retry': {
                const retryData = event.data as { attempt: number; maxRetries: number; reason: string; waitMs?: number };
                useChatStore.getState().setCurrentRetry(retryData);
                if (retryData.reason?.toLowerCase().includes('rate') || retryData.reason?.toLowerCase().includes('429')) {
                  toast.warning('Rate limited', {
                    description: `Retrying in ${retryData.waitMs ? Math.ceil(retryData.waitMs / 1000) : 5}s...`,
                    duration: 4000,
                  });
                }
                break;
              }

              case 'health_update': {
                const healthData = event.data as import('@/types').HealthMetrics;
                useChatStore.getState().setHealthMetrics(healthData);
                break;
              }

              case 'intent': {
                const intentData = event.data as { intent: string; reason: string };
                useChatStore.getState().setLastIntent(intentData);
                break;
              }
            }
          }
        }

        // Handle any remaining buffer
        if (buffer.trim()) {
          const trimmedBuf = buffer.trim();
          if (trimmedBuf.startsWith('data: ') && trimmedBuf.slice(6) !== '[DONE]') {
            try {
              const event = JSON.parse(trimmedBuf.slice(6)) as StreamEvent;
              if (event.type === 'token') {
                fullContent += event.data as string;
                updateMessage(assistantId, { content: fullContent });
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          updateMessage(assistantId, {
            content:
              useChatStore.getState().messages.find((m) => m.id === assistantId)
                ?.content || '',
          });
          setCurrentToolCall(null);
        } else {
          const errorMessage =
            err instanceof Error ? err.message : 'An unexpected error occurred';
          updateMessage(assistantId, {
            content: `**Error:** ${errorMessage}`,
          });
          toast.error('Request failed', { description: errorMessage });
        }
      } finally {
        setStreaming(false);
        setCurrentToolCall(null);
        abortControllerRef.current = null;
        assistantIdRef.current = null;
      }
    },
    [
      messages,
      settings,
      addMessage,
      updateMessage,
      setStreaming,
      setCurrentToolCall,
      addToToolCallHistory,
      updateToolCallInHistory,
      triggerWorkspaceRefresh,
    ]
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { sendMessage, stopStreaming };
}
