import { describe, it, expect } from 'vitest';
import { getToolDefinitions } from '@/agent/tools';

/**
 * Guards the Zod→JSON-Schema conversion. The previous hand-rolled converter
 * silently dropped field descriptions and defaults; this verifies the native
 * `z.toJSONSchema()` path keeps them, which is what steers the LLM's arguments.
 */
describe('getToolDefinitions', () => {
  const defs = getToolDefinitions();

  it('produces a definition for every tool with a name and description', () => {
    expect(defs.length).toBeGreaterThan(10);
    for (const d of defs) {
      expect(d.name).toBeTruthy();
      expect(typeof d.description).toBe('string');
      expect(d.parameters).toBeTruthy();
    }
  });

  it('preserves field-level descriptions in the JSON schema', () => {
    const webSearch = defs.find((d) => d.name === 'web_search');
    expect(webSearch).toBeDefined();
    const params = webSearch!.parameters as {
      properties?: { query?: { description?: string } };
    };
    expect(params.properties?.query).toBeDefined();
    expect(params.properties?.query?.description).toBeTruthy();
  });
});
