import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createContext, Script } from 'vm';
import { TextEncoder, TextDecoder } from 'util';

/**
 * run_javascript - Execute JavaScript code in a sandboxed environment.
 */
export const runJavascriptTool = tool(
  async ({ code }: { code: string }): Promise<string> => {
    const logs: string[] = [];
    const output: string[] = [];
    const startTime = Date.now();

    const sandbox = {
      console: {
        log: (...args: unknown[]) => {
          logs.push(args.map(String).join(' '));
        },
        error: (...args: unknown[]) => {
          logs.push(`[ERROR] ${args.map(String).join(' ')}`);
        },
        warn: (...args: unknown[]) => {
          logs.push(`[WARN] ${args.map(String).join(' ')}`);
        },
        info: (...args: unknown[]) => {
          logs.push(args.map(String).join(' '));
        },
        table: (data: unknown) => {
          logs.push(JSON.stringify(data, null, 2));
        },
      },
      result: undefined as unknown,
      TextEncoder,
      TextDecoder,
      JSON: { ...JSON },
      Math: { ...Math },
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      Promise,
      Error,
      TypeError,
      RangeError,
      SyntaxError,
      RegExp,
    };

    try {
      // Wrap code to capture the last expression value
      const wrappedCode = `
        'use strict';
        ${code}
      `;

      const context = createContext(sandbox);
      const script = new Script(wrappedCode, { filename: 'sandbox.js' });

      try {
        // vm's `timeout` aborts *synchronous* runaway code (e.g. `while(true){}`).
        // A bare setTimeout cannot do this — the blocked event loop never runs it.
        script.runInContext(context, { timeout: 10000, breakOnSigint: true });

        const elapsed = Date.now() - startTime;
        let outputStr = '';

        if (logs.length > 0) {
          outputStr += `Console output:\n${logs.join('\n')}\n\n`;
        }

        if (sandbox.result !== undefined) {
          let serialized: string;
          try {
            serialized = JSON.stringify(sandbox.result, null, 2);
          } catch {
            serialized = String(sandbox.result);
          }
          outputStr += `Return value: ${serialized}\n`;
        }

        outputStr += `Execution completed in ${elapsed}ms.`;
        return outputStr.trim();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const elapsed = Date.now() - startTime;

        let outputStr = '';
        if (logs.length > 0) {
          outputStr += `Console output before error:\n${logs.join('\n')}\n\n`;
        }

        outputStr += `Error: ${errMsg}\nExecution failed after ${elapsed}ms.`;
        return outputStr.trim();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (logs.length > 0) {
        return `Console output before error:\n${logs.join('\n')}\n\nError: ${msg}`;
      }
      return `Error: ${msg}`;
    }
  },
  {
    name: 'run_javascript',
    description:
      'Execute JavaScript code in a sandboxed environment. Returns the output or any errors. Use console.log() to output values. Set result = value to return a value.',
    schema: z.object({
      code: z.string().describe('The JavaScript code to execute'),
    }),
  }
);
