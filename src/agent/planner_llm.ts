/**
 * LLM-backed planner for DEEP mode.
 *
 * The heuristic planner (planner.ts) maps English keywords to tool groups, so
 * it produces shallow or empty plans for paraphrased or non-English requests
 * (e.g. Hebrew). For complex deep-mode tasks it pays off to spend one cheap LLM
 * call on a real plan. This module asks the model for a strict-JSON plan and
 * ALWAYS falls back to the heuristic planner if the call or parse fails, so the
 * agent never blocks on planning.
 */

import { ChatOpenAI } from '@langchain/openai';
import { createPlan, type Plan } from './planner';

export interface LlmPlannerConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const PLAN_SYSTEM_PROMPT = `You are a senior engineering planner. Given a user task and a list of available tool names, produce a concise execution plan.
Respond with ONLY a JSON object, no prose, in exactly this shape:
{"goal": string, "steps": string[], "tools_needed": string[], "estimated_complexity": "low" | "medium" | "high"}
Rules:
- 3 to 7 ordered, concrete steps.
- tools_needed must be a subset of the provided tool names.
- Keep it tight; no markdown, no commentary.`;

/**
 * Parse a Plan out of a raw LLM response. Tolerant of code fences and
 * surrounding prose; returns null when no valid plan can be recovered.
 */
export function parsePlanJson(raw: string, availableTools: string[]): Plan | null {
  if (!raw) return null;
  // Strip code fences and grab the outermost JSON object.
  const fenced = raw.replace(/```(?:json)?/gi, '').trim();
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const steps = Array.isArray(obj.steps) ? obj.steps.filter((s): s is string => typeof s === 'string') : [];
  if (steps.length === 0) return null;

  const toolSet = new Set(availableTools);
  const tools_needed = Array.isArray(obj.tools_needed)
    ? obj.tools_needed.filter((t): t is string => typeof t === 'string' && toolSet.has(t))
    : [];

  const complexity = obj.estimated_complexity;
  const estimated_complexity: Plan['estimated_complexity'] =
    complexity === 'low' || complexity === 'medium' || complexity === 'high' ? complexity : 'medium';

  return {
    goal: typeof obj.goal === 'string' && obj.goal.trim() ? obj.goal.trim() : 'Complete the requested task',
    steps,
    tools_needed,
    estimated_complexity,
  };
}

/**
 * Create a plan with the LLM, falling back to the heuristic planner on any
 * failure (network error, bad JSON, timeout).
 */
export async function createPlanWithLLM(
  userMessage: string,
  availableTools: string[],
  config: LlmPlannerConfig,
): Promise<Plan> {
  const fallback = () => createPlan(userMessage, availableTools);
  try {
    const llm = new ChatOpenAI({
      apiKey: config.apiKey,
      model: config.model,
      temperature: 0.2,
      streaming: false,
      configuration: { baseURL: config.baseUrl },
    });

    const response = await llm.invoke([
      { role: 'system', content: PLAN_SYSTEM_PROMPT },
      { role: 'user', content: `Task:\n${userMessage}\n\nAvailable tools:\n${availableTools.join(', ')}` },
    ]);

    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    return parsePlanJson(text, availableTools) ?? fallback();
  } catch {
    return fallback();
  }
}
