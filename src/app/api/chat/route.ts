import { runAgent, type AgentConfig, type AgentMode } from '@/agent';
import { healthMonitor } from '@/agent/reliability';
import type { ChatMessage, AppSettings } from '@/types';

/**
 * POST /api/chat
 *
 * Accepts { messages: ChatMessage[], settings: AppSettings }
 * and streams agent events back as Server-Sent Events (SSE).
 *
 * SSE event types:
 *  - token: streaming text token
 *  - tool_start: tool execution started
 *  - tool_end: tool execution completed
 *  - tool_error: tool execution failed
 *  - image: image data generated
 *  - plan: task plan created
 *  - reflection: post-tool reflection
 *  - subtask_update: subtask status changed
 *  - progress: iteration progress
 *  - performance: session performance stats
 *  - skill_detected: skill was auto-detected for this message
 *  - skill_clarify: skill needs user clarification
 *  - retry: API retry in progress
 *  - health_update: health metrics update
 *  - done: agent finished
 *  - error: fatal error
 */

export async function POST(request: Request) {
  let body: { messages?: ChatMessage[]; settings?: AppSettings; skill?: string; project?: string; mode?: AgentMode };

  try {
    const raw = await request.json();
    body = raw as typeof body;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'messages array is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (body.messages.length > 500) {
    return new Response(
      JSON.stringify({ error: 'messages array exceeds maximum length of 500' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }


  const invalidMessage = body.messages.find(
    (m) => !m || !['user', 'assistant', 'system'].includes(m.role) || typeof m.content !== 'string',
  );
  if (invalidMessage) {
    return new Response(
      JSON.stringify({ error: 'Each message must have a valid role and string content' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (body.messages.some((m) => m.content.length > 200_000)) {
    return new Response(
      JSON.stringify({ error: 'message content exceeds maximum length of 200000 characters' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (body.mode && !['quick', 'smart', 'deep'].includes(body.mode)) {
    return new Response(
      JSON.stringify({ error: 'mode must be one of: quick, smart, deep' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!body.settings?.primaryApi?.apiKey) {
    return new Response(
      JSON.stringify({ error: 'API key is required in settings.primaryApi' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { messages, settings } = body;
  const api = settings.primaryApi;
  const imageApi = settings.imageApi;

  if (!api.baseUrl || !api.model) {
    return new Response(
      JSON.stringify({ error: 'settings.primaryApi.baseUrl and model are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to push an SSE event.
      function sendEvent(event: { type: string; data: unknown }) {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      // Track API call timing for health monitoring
      const apiCallStart = Date.now();

      const agentConfig: AgentConfig = {
        apiKey: api.apiKey,
        baseUrl: api.baseUrl,
        model: api.model,
        githubToken: settings.githubToken,
        imageApiConfig:
          imageApi?.apiKey
            ? { apiKey: imageApi.apiKey, baseUrl: imageApi.baseUrl, model: imageApi.model }
            : undefined,
        mode: body.mode,
        onIntent(intent) {
          sendEvent({ type: 'intent', data: intent });
        },
        onToken(token: string) {
          sendEvent({ type: 'token', data: token });
        },
        onToolStart(toolName: string, input: Record<string, unknown>) {
          sendEvent({ type: 'tool_start', data: { name: toolName, input, timestamp: Date.now() } });
        },
        onToolEnd(toolName: string, output: string, duration?: number) {
          // Record successful tool call (with real duration) for health monitoring
          healthMonitor.recordToolCall(toolName, duration ?? 0, true);
          sendEvent({ type: 'tool_end', data: { name: toolName, output, duration, timestamp: Date.now() } });
        },
        onToolError(toolName: string, error: string) {
          // Record failed tool call for health monitoring
          healthMonitor.recordToolCall(toolName, 0, false);
          sendEvent({ type: 'tool_error', data: { name: toolName, error, timestamp: Date.now() } });
        },
        onImage(imageData: string) {
          sendEvent({ type: 'image', data: imageData });
        },
        onPlan(plan) {
          sendEvent({ type: 'plan', data: plan });
        },
        onReflection(toolName, reflection) {
          sendEvent({ type: 'reflection', data: { toolName, ...reflection, timestamp: Date.now() } });
        },
        onSubtaskUpdate(subtask) {
          sendEvent({ type: 'subtask_update', data: subtask });
        },
        onProgress(current, total, description) {
          sendEvent({ type: 'progress', data: { current, total, description } });
        },
        onPerformance(stats) {
          sendEvent({ type: 'performance', data: stats });
        },
        onSkillDetected(skill) {
          sendEvent({ type: 'skill_detected', data: skill });
        },
        onSkillClarify(question, alternatives) {
          sendEvent({ type: 'skill_clarify', data: { question, alternatives } });
        },
        onAgentActivity(activity) {
          sendEvent({ type: 'agent_activity', data: activity });
        },
        onRetry(info) {
          // Surface transient LLM-call retries to the UI (rate limits, 5xx, …)
          sendEvent({ type: 'retry', data: info });
        },
        connectedProject: body.project as string | null,
        onDone() {
          // Record overall API call for health monitoring
          const duration = Date.now() - apiCallStart;
          healthMonitor.recordAPICall(duration, true);
          // Send final health update
          const metrics = healthMonitor.getMetrics();
          sendEvent({ type: 'health_update', data: metrics });
          sendEvent({ type: 'done', data: {} });
        },
        onError(error: string) {
          // Record failed API call for health monitoring
          const duration = Date.now() - apiCallStart;
          healthMonitor.recordAPICall(duration, false, error);
          sendEvent({ type: 'error', data: error });
        },
      };

      try {
        // Send initial health status
        const initialHealth = healthMonitor.getMetrics();
        sendEvent({ type: 'health_update', data: initialHealth });

        // Convert ChatMessage[] -> plain messages for the agent.
        const plainMessages = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Get manual skill override from request
        const manualSkill = body.skill as string | null | undefined;

        await runAgent(plainMessages, { ...agentConfig, manualSkill: manualSkill ?? null });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const duration = Date.now() - apiCallStart;
        healthMonitor.recordAPICall(duration, false, msg);
        sendEvent({ type: 'error', data: msg });
        sendEvent({ type: 'done', data: {} });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
