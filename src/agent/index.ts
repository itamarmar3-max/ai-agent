/**
 * AI Agent Runner — Custom ReAct-style loop with streaming.
 *
 * Uses @langchain/openai ChatOpenAI for LLM interaction and
 * tool-calling. Does NOT use createReactAgent; the loop is hand-rolled
 * for full control over streaming callbacks and iteration limits.
 *
 * Integrated systems (all loaded dynamically to avoid circular deps):
 *  - planner.ts: keyword-based planning (createPlan, createResultSummary)
 *  - task_decomposer.ts: heuristic task decomposition
 *  - reflection.ts: post-tool self-reflection with retry decisions
 *  - memory/: unified short-term + long-term memory context
 *  - executor.ts: parallel tool execution with concurrency limit
 *  - error_handler.ts: exponential backoff retry
 *  - security.ts: input safety, rate limiting, call limits
 */

import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { getAllTools } from './tools';
import { detectSkill } from './skills';
import { buildSystemPrompt } from './system_prompt';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { Plan, Subtask, PerformanceStats, SkillInfo } from '@/types';
import { compressIfNeeded } from './context/compressor';
import { retrieveContext } from './rag';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageApiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AgentConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  imageApiConfig?: ImageApiConfig;
  githubToken?: string;
  onToken?: (token: string) => void;
  onToolStart?: (toolName: string, input: Record<string, unknown>) => void;
  onToolEnd?: (toolName: string, output: string) => void;
  onToolError?: (toolName: string, error: string) => void;
  onImage?: (imageData: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
  maxIterations?: number;
  // NEW: planning, reflection, task, progress, performance, skill callbacks
  onPlan?: (plan: Plan) => void;
  onReflection?: (toolName: string, reflection: { success: boolean; shouldRetry: boolean; analysis: string }) => void;
  onSubtaskUpdate?: (subtask: Subtask) => void;
  onProgress?: (current: number, total: number, description: string) => void;
  onPerformance?: (stats: PerformanceStats) => void;
  onSkillDetected?: (skill: SkillInfo | null) => void;
  onSkillClarify?: (question: string, alternatives: string[]) => void;
  manualSkill?: string | null;
  // NEW: multi-agent, RAG, interrupt callbacks
  onAgentActivity?: (activity: { role: string; status: string; description: string; timestamp: number }) => void;
  connectedProject?: string | null;
  interruptSignal?: { paused: boolean; redirect: string | null };
}

export interface AgentResult {
  text: string;
  toolCalls: Array<{
    name: string;
    input: Record<string, unknown>;
    output: string;
    duration?: number;
    retryCount?: number;
  }>;
  images: string[];
  plan?: Plan;
  subtasks?: Subtask[];
  performance?: PerformanceStats;
  detectedSkill?: SkillInfo | null;
}

// ---------------------------------------------------------------------------
// System prompt is now managed by system_prompt.ts
// ---------------------------------------------------------------------------
// The SYSTEM_PROMPT constant has been replaced by buildSystemPrompt() from
// ./system_prompt.ts. This provides dynamic prompt generation with skill-
// specific instructions, memory context, and task decomposition.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Agent runner
// ---------------------------------------------------------------------------

/**
 * Run the agent with a ReAct-style loop.
 *
 * 1. Build the ChatOpenAI model with tool bindings.
 * 2. Iterate: call LLM → check tool_calls → execute → feed results back.
 * 3. Stream tokens via `onToken`, tool events via `onToolStart/End/Error`.
 * 4. Integrated: planning, task decomposition, reflection, memory, security,
 *    parallel execution, retry, and performance tracking.
 */
export async function runAgent(
  userMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  config: AgentConfig,
): Promise<AgentResult> {
  const maxIterations = config.maxIterations ?? 15;
  const sessionStartTime = Date.now();

  // ---- 0. Detect skill (BEFORE anything else) -----------------------------
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';
  const detectionResult = detectSkill(
    lastUserMessage,
    config.manualSkill ?? null,
    userMessages.map((m) => ({ role: m.role, content: m.content })),
  );

  const activeSkillModule = detectionResult.skill;
  const detectedSkillInfo: SkillInfo | null = activeSkillModule
    ? {
        name: activeSkillModule.name,
        displayName: activeSkillModule.displayName,
        icon: activeSkillModule.icon,
        confidence: detectionResult.confidence,
      }
    : null;

  config.onSkillDetected?.(detectedSkillInfo);

  // If skill needs clarification, notify the UI
  if (detectionResult.needsClarification && detectionResult.clarificationQuestion) {
    config.onSkillClarify?.(
      detectionResult.clarificationQuestion,
      detectionResult.alternativeSkills,
    );
  }

  // ---- Collect tools (filter by skill preferences) -------------------------
  let tools: StructuredToolInterface[] = getAllTools(config.imageApiConfig, config.githubToken);

  // Filter tools based on active skill's preferences (soft filter — reorder, don't remove)
  if (activeSkillModule) {
    const preferredSet = new Set(activeSkillModule.preferredTools);
    const avoidedSet = new Set(activeSkillModule.avoidedTools);
    tools = [
      ...tools.filter((t) => preferredSet.has(t.name)),
      ...tools.filter((t) => !preferredSet.has(t.name) && !avoidedSet.has(t.name)),
    ];
  }

  const toolMap = new Map<string, StructuredToolInterface>();
  for (const t of tools) {
    toolMap.set(t.name, t);
  }

  // ---- 1. Initialize memory (dynamic, non-blocking) ------------------------
  let memoryContext = '';
  let memoryModule: {
    initializeMemory: () => Promise<string>;
    saveSessionMemory: () => Promise<void>;
    addToolOutput: (tool: string, input: Record<string, unknown>, output: string) => void;
    addDecision: (decision: string) => void;
    addFileCreated: (filePath: string) => void;
    getFullMemoryContext: () => Promise<string>;
  } | null = null;

  try {
    memoryModule = await import('./memory');
    memoryContext = await memoryModule.initializeMemory();
    const fullCtx = await memoryModule.getFullMemoryContext();
    if (fullCtx) {
      memoryContext = fullCtx;
    }
  } catch {
    // Memory init failed — continue without context (non-critical)
    memoryContext = '';
  }

  // ---- 2. Create plan (dynamic, non-blocking) ------------------------------
  let plan: Plan | undefined;
  try {
    const planner = await import('./planner');
    const lastMessage = userMessages[userMessages.length - 1]?.content || '';
    plan = planner.createPlan(lastMessage, [...getAllTools().map(t => t.name)]);
    config.onPlan?.(plan);
  } catch {
    // Planner failed — non-critical, continue without plan
  }

  // ---- 2b. Multi-agent orchestration (non-blocking) --------------------
  let orchestratorModule: any = null;
  try {
    orchestratorModule = await import('./multi_agent');
    orchestratorModule.orchestratePlan(lastUserMessage, tools.map(t => t.name), {
      onAgentActivity: (activity: any) => {
        config.onAgentActivity?.(activity);
      },
      onPlanCreated: (plan: any) => {
        config.onPlan?.(plan);
      },
      onStepUpdate: (subtask: any) => {
        config.onSubtaskUpdate?.(subtask);
      },
    });
  } catch {
    // Multi-agent failed — non-critical
  }

  // ---- 3. Task decomposition (dynamic, non-blocking) -----------------------
  let decomposition: {
    mainTask: string;
    complexity: string;
    subtasks: Subtask[];
  } | null = null;
  let decompositionModule: {
    decomposeTask: (msg: string) => any;
    updateSubtaskStatus: (d: any, id: number, status: any) => any;
    getNextPendingSubtask: (d: any) => Subtask | null;
    formatDecompositionForLLM: (d: any) => string;
  } | null = null;

  try {
    decompositionModule = await import('./task_decomposer');
    const lastMessage = userMessages[userMessages.length - 1]?.content || '';
    decomposition = decompositionModule.decomposeTask(lastMessage);
    if (decomposition) {
      for (const st of decomposition.subtasks) {
        config.onSubtaskUpdate?.(st);
      }
    }
  } catch {
    // Decomposition failed — non-critical
  }

  // ---- 4. Security (dynamic) ----------------------------------------------
  let securityModule: {
    checkToolCallLimit: () => { allowed: boolean; reason?: string };
    checkRateLimit: () => { allowed: boolean; reason?: string };
    checkInputSafety: (tool: string, input: Record<string, unknown>) => { allowed: boolean; reason?: string; sanitizedInput?: Record<string, unknown> };
  } | null = null;

  try {
    securityModule = await import('./security');
  } catch {
    // Security module failed — continue without checks (non-critical for dev)
  }

  // ---- 4b. RAG retrieval (if project is connected) -----------------------
  let ragContext = '';
  if (config.connectedProject) {
    try {
      const ragResult = await retrieveContext(lastUserMessage, config.connectedProject, 5);
      if (ragResult) {
        ragContext = ragResult.formattedContext;
      }
    } catch {
      // RAG retrieval failed — non-critical
    }
  }

  // ---- 5. Build LLM with skill-aware system prompt ------------------------
  const enhancedSystemPrompt = buildSystemPrompt({
    activeSkill: activeSkillModule?.name,
    skillSystemPrompt: activeSkillModule?.systemPrompt,
    memoryContext,
    taskDecomposition: decomposition && decompositionModule
      ? (() => { try { return decompositionModule.formatDecompositionForLLM(decomposition); } catch { return undefined; } })()
      : undefined,
    hasGithubToken: !!config.githubToken,
  });

  const llm = new ChatOpenAI({
    apiKey: config.apiKey,
    model: config.model,
    streaming: true,
    temperature: 0.6,
    configuration: {
      baseURL: config.baseUrl,
    },
    callbacks: config.onToken
      ? [
          {
            handleLLMNewToken(token: string) {
              config.onToken?.(token);
            },
          },
        ]
      : undefined,
  }).bindTools(tools);

  // ---- Build message history -----------------------------------------------
  const messages: BaseMessage[] = [new SystemMessage(enhancedSystemPrompt)];

  // Inject RAG context if available
  if (ragContext) {
    messages.push(new SystemMessage(ragContext));
  }

  // ---- Context compression (run BEFORE building message history) ------
  const compressedMessages = compressIfNeeded(
    userMessages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
  );

  // Build message history from (potentially compressed) messages
  for (const msg of compressedMessages) {
    switch (msg.role) {
      case 'user':
        messages.push(new HumanMessage(msg.content));
        break;
      case 'assistant':
        messages.push(new AIMessage(msg.content));
        break;
      case 'system':
        messages.push(new SystemMessage(msg.content));
        break;
    }
  }

  // ---- 6. ReAct loop with all integrations --------------------------------
  const result: AgentResult = { text: '', toolCalls: [], images: [], detectedSkill: detectedSkillInfo };
  let iteration = 0;
  const toolUsageCounts: Record<string, number> = {};
  let totalTokens = 0;
  const responseTimes: number[] = [];

  // Load executor and error_handler modules once
  let executorModule: {
    determineParallelGroups: (calls: Array<{ name: string; input: any }>) => Array<Array<{ name: string; input: any }>>;
    executeToolsInParallel: (execs: any[], toolMap: Map<string, any>) => Promise<any[]>;
  } | null = null;

  let errorHandlerModule: {
    executeWithRetry: (fn: () => Promise<string>, config?: any) => Promise<{ output: string; retries: number }>;
    logError: (error: any) => Promise<void>;
  } | null = null;

  let reflectionModule: {
    reflectOnOutput: (toolName: string, input: Record<string, unknown>, output: string, retryCount?: number) => {
      success: boolean;
      shouldRetry: boolean;
      adjustedInput?: Record<string, unknown>;
      analysis: string;
    };
  } | null = null;

  try {
    executorModule = await import('./executor');
  } catch { /* non-critical */ }

  try {
    errorHandlerModule = await import('./error_handler');
  } catch { /* non-critical */ }

  try {
    reflectionModule = await import('./reflection');
  } catch { /* non-critical */ }

  try {
    result.plan = plan;
    result.subtasks = decomposition?.subtasks;
  } catch { /* non-critical */ }

  try {
    while (iteration < maxIterations) {
      iteration++;

      // ---- Interrupt check ------------------------------------------------
      if (config.interruptSignal?.paused) {
        // Wait until resumed or redirected
        await new Promise((resolve) => {
          const check = setInterval(() => {
            if (!config.interruptSignal?.paused) {
              clearInterval(check);
              resolve(undefined);
            }
          }, 500);
        });
        // If redirected, add redirect message
        if (config.interruptSignal?.redirect) {
          const redirectMsg = config.interruptSignal.redirect;
          config.interruptSignal.redirect = null;
          userMessages.push({ role: 'user', content: redirectMsg });
          messages.push(new HumanMessage(redirectMsg));
          // Continue loop with new context
          continue;
        }
      }

      // ---- Security: tool call limit check --------------------------------
      if (securityModule) {
        try {
          const secCheck = securityModule.checkToolCallLimit();
          if (!secCheck.allowed) {
            const reason = secCheck.reason ?? 'Tool call limit reached';
            config.onError?.(reason);
            result.text = result.text || `Security: ${reason}`;
            break;
          }
        } catch { /* non-critical */ }

        // ---- Security: rate limit check ------------------------------------
        try {
          const rateCheck = securityModule.checkRateLimit();
          if (!rateCheck.allowed) {
            // Wait briefly then continue (don't hard-fail on rate limit)
            await new Promise((r) => setTimeout(r, 2000));
          }
        } catch { /* non-critical */ }
      }

      // ---- LLM invoke with timing -----------------------------------------
      const invokeStart = Date.now();
      const response = await llm.invoke(messages);
      const invokeDuration = Date.now() - invokeStart;
      responseTimes.push(invokeDuration);

      // If no tool calls, we are done — collect final text.
      if (!response.tool_calls || response.tool_calls.length === 0) {
        result.text = typeof response.content === 'string' ? response.content : '';
        break;
      }

      // Add the AI message (with tool_calls) to history.
      messages.push(response);

      // ---- Determine parallel groups --------------------------------------
      let groups: Array<Array<{ name: string; input: any }>> = [];
      if (executorModule) {
        try {
          const parsedCalls = response.tool_calls.map((tc) => ({
            name: (tc as { name?: string }).name ?? 'unknown',
            input: (tc as { args?: Record<string, unknown> }).args ?? {},
          }));
          groups = executorModule.determineParallelGroups(parsedCalls);
        } catch {
          // Fallback to sequential: one group per tool call
          groups = response.tool_calls.map((tc) => [{
            name: (tc as { name?: string }).name ?? 'unknown',
            input: (tc as { args?: Record<string, unknown> }).args ?? {},
          }]);
        }
      } else {
        // No executor — sequential execution (original behavior)
        groups = response.tool_calls.map((tc) => [{
          name: (tc as { name?: string }).name ?? 'unknown',
          input: (tc as { args?: Record<string, unknown> }).args ?? {},
        }]);
      }

      // ---- Map each group entry to its original tool_call index for correct ID matching ----
      let toolCallIndex = 0;

      // ---- Execute tool groups --------------------------------------------
      for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
        const group = groups[groupIdx];
        const batchId = group.length > 1 ? `batch_${iteration}_${groupIdx}` : undefined;

        if (group.length === 1) {
          // ---- Sequential execution with retry + reflection ---------------
          const tc = group[0];
          const toolName: string = tc.name;
          const toolInput = tc.input as Record<string, unknown>;
          const toolCallId = (response.tool_calls[toolCallIndex] as { id?: string })?.id ?? `call_${iteration}_${groupIdx}`;
          toolCallIndex++;

          // Security: input safety check
          if (securityModule) {
            try {
              const inputCheck = securityModule.checkInputSafety(toolName, toolInput);
              if (!inputCheck.allowed) {
                const reason = inputCheck.reason ?? 'Input safety check failed';
                config.onToolError?.(toolName, reason);
                messages.push(
                  new ToolMessage({
                    content: `Error: ${reason}`,
                    tool_call_id: toolCallId,
                  }),
                );
                result.toolCalls.push({ name: toolName, input: toolInput, output: `Error: ${reason}` });
                continue;
              }
            } catch { /* non-critical */ }
          }

          config.onToolStart?.(toolName, toolInput);
          const tool = toolMap.get(toolName);
          if (!tool) {
            const errMsg = `Tool "${toolName}" not found.`;
            config.onToolError?.(toolName, errMsg);
            messages.push(
              new ToolMessage({
                content: `Error: ${errMsg}`,
                tool_call_id: toolCallId,
              }),
            );
            result.toolCalls.push({ name: toolName, input: toolInput, output: `Error: ${errMsg}` });
            continue;
          }

          const toolStart = Date.now();
          let outputStr = '';
          let retryCount = 0;

          try {
            // Execute with retry if error_handler is available
            if (errorHandlerModule) {
              const retryResult = await errorHandlerModule.executeWithRetry(
                () => tool.invoke(toolInput).then((r) => typeof r === 'string' ? r : JSON.stringify(r)),
              );
              outputStr = retryResult.output;
              retryCount = retryResult.retries;
            } else {
              // Original behavior: no retry
              const output = await tool.invoke(toolInput);
              outputStr = typeof output === 'string' ? output : JSON.stringify(output);
            }

            const toolDuration = Date.now() - toolStart;

            // Reflect on output if reflection module is available
            if (reflectionModule) {
              try {
                const reflection = reflectionModule.reflectOnOutput(toolName, toolInput, outputStr, retryCount);
                config.onReflection?.(toolName, {
                  success: reflection.success,
                  shouldRetry: reflection.shouldRetry,
                  analysis: reflection.analysis,
                });
              } catch { /* non-critical */ }
            }

            // Add to memory
            if (memoryModule) {
              try {
                memoryModule.addToolOutput(toolName, toolInput, outputStr);
              } catch { /* non-critical */ }
            }

            // Track performance
            toolUsageCounts[toolName] = (toolUsageCounts[toolName] ?? 0) + 1;

            // Detect image data in output.
            if (outputStr.startsWith('data:image/') || outputStr.startsWith('http')) {
              result.images.push(outputStr);
              config.onImage?.(outputStr);
            }

            config.onToolEnd?.(toolName, outputStr);
            result.toolCalls.push({ name: toolName, input: toolInput, output: outputStr, duration: toolDuration, retryCount });

            messages.push(
              new ToolMessage({
                content: outputStr,
                tool_call_id: toolCallId,
              }),
            );
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const toolDuration = Date.now() - toolStart;

            config.onToolError?.(toolName, errMsg);
            messages.push(
              new ToolMessage({
                content: `Error: ${errMsg}`,
                tool_call_id: toolCallId,
              }),
            );
            result.toolCalls.push({ name: toolName, input: toolInput, output: `Error: ${errMsg}`, duration: toolDuration, retryCount });

            // Add to memory even on error
            if (memoryModule) {
              try {
                memoryModule.addToolOutput(toolName, toolInput, `Error: ${errMsg}`);
              } catch { /* non-critical */ }
            }

            toolUsageCounts[toolName] = (toolUsageCounts[toolName] ?? 0) + 1;

            // Log error if error handler available
            if (errorHandlerModule) {
              try {
                await errorHandlerModule.logError({
                  toolName,
                  input: toolInput,
                  error: errMsg,
                  timestamp: Date.now(),
                  retryCount,
                  resolved: false,
                });
              } catch { /* non-critical */ }
            }
          }
        } else {
          // ---- Parallel execution ------------------------------------------
          // Stream start for all tools in the batch
          for (const tc of group) {
            config.onToolStart?.(tc.name, tc.input);
          }

          const toolStart = Date.now();
          const batchToolNames = group.map((tc) => tc.name);

          try {
            // Map tool call IDs by index (not by name) to avoid ID collision
            const groupToolCallIds: string[] = [];
            for (let tcIdx = 0; tcIdx < group.length; tcIdx++) {
              groupToolCallIds.push(
                (response.tool_calls[toolCallIndex + tcIdx] as { id?: string })?.id ?? `call_${iteration}_${groupIdx}_${tcIdx}`,
              );
            }
            toolCallIndex += group.length;

            // Security checks for all tools in group
            let anyBlocked = false;
            if (securityModule) {
              for (const tc of group) {
                try {
                  const inputCheck = securityModule.checkInputSafety(tc.name, tc.input);
                  if (!inputCheck.allowed) {
                    const reason = inputCheck.reason ?? 'Input safety check failed';
                    config.onToolError?.(tc.name, reason);
                    anyBlocked = true;
                  }
                } catch { /* non-critical */ }
              }
            }

            if (anyBlocked) {
              continue;
            }

            if (executorModule) {
              const executions = group.map((tc) => ({
                toolName: tc.name,
                input: tc.input,
                isParallel: true,
                batchId,
              }));

              const parallelResults = await executorModule.executeToolsInParallel(executions, toolMap);

              for (let i = 0; i < parallelResults.length; i++) {
                const pr = parallelResults[i];
                const toolCallId = groupToolCallIds[i] ?? `call_${iteration}_${groupIdx}_${i}`;

                // Add to memory
                if (memoryModule) {
                  try {
                    memoryModule.addToolOutput(pr.toolName, group[i].input, pr.output);
                  } catch { /* non-critical */ }
                }

                toolUsageCounts[pr.toolName] = (toolUsageCounts[pr.toolName] ?? 0) + 1;

                if (pr.success) {
                  // Detect image data in output.
                  if (pr.output.startsWith('data:image/') || pr.output.startsWith('http')) {
                    result.images.push(pr.output);
                    config.onImage?.(pr.output);
                  }

                  config.onToolEnd?.(pr.toolName, pr.output);
                  result.toolCalls.push({ name: pr.toolName, input: group[i].input, output: pr.output, duration: pr.duration });
                } else {
                  config.onToolError?.(pr.toolName, pr.error ?? pr.output);
                  result.toolCalls.push({ name: pr.toolName, input: group[i].input, output: pr.output, duration: pr.duration });
                }

                messages.push(
                  new ToolMessage({
                    content: pr.output,
                    tool_call_id: toolCallId,
                  }),
                );
              }
            } else {
              // No executor module — fall back to sequential within group
              for (let i = 0; i < group.length; i++) {
                const tc = group[i];
                const tool = toolMap.get(tc.name);
                const toolCallId = groupToolCallIds[i];

                if (!tool) {
                  const errMsg = `Tool "${tc.name}" not found.`;
                  config.onToolError?.(tc.name, errMsg);
                  messages.push(new ToolMessage({ content: `Error: ${errMsg}`, tool_call_id: toolCallId }));
                  result.toolCalls.push({ name: tc.name, input: tc.input, output: `Error: ${errMsg}` });
                  continue;
                }

                try {
                  const output = await tool.invoke(tc.input);
                  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

                  if (memoryModule) {
                    try { memoryModule.addToolOutput(tc.name, tc.input, outputStr); } catch { /* */ }
                  }

                  toolUsageCounts[tc.name] = (toolUsageCounts[tc.name] ?? 0) + 1;

                  if (outputStr.startsWith('data:image/') || outputStr.startsWith('http')) {
                    result.images.push(outputStr);
                    config.onImage?.(outputStr);
                  }

                  config.onToolEnd?.(tc.name, outputStr);
                  result.toolCalls.push({ name: tc.name, input: tc.input, output: outputStr });
                  messages.push(new ToolMessage({ content: outputStr, tool_call_id: toolCallId }));
                } catch (err) {
                  const errMsg = err instanceof Error ? err.message : String(err);
                  config.onToolError?.(tc.name, errMsg);
                  result.toolCalls.push({ name: tc.name, input: tc.input, output: `Error: ${errMsg}` });
                  messages.push(new ToolMessage({ content: `Error: ${errMsg}`, tool_call_id: toolCallId }));
                }
              }
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            config.onError?.(`Parallel execution error: ${errMsg}`);
          }
        }
      }

      // ---- Update progress ------------------------------------------------
      config.onProgress?.(iteration, maxIterations, `Step ${iteration} of ${maxIterations}: Executing tools...`);

      // ---- Update subtask status (best-effort) -----------------------------
      if (decomposition && decompositionModule) {
        try {
          const nextPending = decompositionModule.getNextPendingSubtask(decomposition);
          if (nextPending) {
            decomposition = decompositionModule.updateSubtaskStatus(decomposition, nextPending.id, 'in_progress');
            config.onSubtaskUpdate?.(nextPending);
          }
        } catch { /* non-critical */ }
      }

      // Continue loop — the tool results are in messages, LLM will respond again.
    }

    // If we exhausted iterations, grab the last AI message content if any.
    if (iteration >= maxIterations && !result.text) {
      const last = messages[messages.length - 1];
      if (last instanceof AIMessage && typeof last.content === 'string') {
        result.text = last.content;
      } else {
        result.text = '[Agent reached maximum iterations. The task may be partially complete.]';
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    config.onError?.(errMsg);
    result.text = result.text || `Error: ${errMsg}`;
  }

  // ---- 7. Save memory and report performance ------------------------------
  if (memoryModule) {
    try {
      await memoryModule.saveSessionMemory();
    } catch { /* non-critical */ }
  }

  // Calculate performance stats
  const sessionDuration = Date.now() - sessionStartTime;
  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  const performanceStats: PerformanceStats = {
    totalToolCalls: result.toolCalls.length,
    totalTokens,
    sessionDuration,
    averageResponseTime: Math.round(averageResponseTime),
    toolUsageCounts,
    sessionStartTime,
  };

  result.performance = performanceStats;
  config.onPerformance?.(performanceStats);
  config.onDone?.();
  return result;
}
