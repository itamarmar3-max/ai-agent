import { describe, it, expect } from 'vitest';
import { classifyIntent, describeIntent } from '@/agent/intent_classifier';

describe('classifyIntent', () => {
  it('treats greetings as smalltalk with no pipeline', () => {
    for (const msg of ['hi', 'hello', 'שלום', 'thanks!']) {
      const r = classifyIntent(msg);
      expect(r.intent).toBe('smalltalk');
      expect(r.needsPlanning).toBe(false);
      expect(r.needsMultiAgent).toBe(false);
    }
  });

  it('treats an empty message as smalltalk', () => {
    expect(classifyIntent('').intent).toBe('smalltalk');
    expect(classifyIntent('   ').intent).toBe('smalltalk');
  });

  it('promotes messages with attachments to a task', () => {
    const r = classifyIntent('look at this', true);
    expect(r.intent).toBe('task');
    expect(r.needsPlanning).toBe(true);
  });

  it('classifies a short factual question without planning', () => {
    const r = classifyIntent('what is the capital of France?');
    expect(r.intent).toBe('question');
    expect(r.needsPlanning).toBe(false);
  });

  it('classifies a single-action task as a planning task', () => {
    const r = classifyIntent('build a todo list component in React');
    expect(r.intent).toBe('task');
    expect(r.needsPlanning).toBe(true);
  });

  it('escalates a long multi-step task to decomposition / multi-agent', () => {
    const msg =
      'build a full e-commerce site and then create the backend API and after that ' +
      'design the database schema and also write integration tests for all of the endpoints ' +
      'and several payment flows step by step';
    const r = classifyIntent(msg);
    expect(r.intent).toBe('task');
    expect(r.needsDecomposition).toBe(true);
    expect(r.needsMultiAgent).toBe(true);
  });

  it('recognises Hebrew action verbs as tasks', () => {
    const r = classifyIntent('תבנה לי אפליקציה שלמה עם מסך התחברות');
    expect(r.intent).toBe('task');
  });

  it('describeIntent produces a readable label', () => {
    const r = classifyIntent('hi');
    expect(describeIntent(r)).toContain('smalltalk');
  });
});
