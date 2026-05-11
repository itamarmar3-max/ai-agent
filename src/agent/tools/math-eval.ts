import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { evaluate } from 'mathjs';

/**
 * math_eval - Evaluate mathematical expressions safely.
 */
export const mathEvalTool = tool(
  async ({ expression }: { expression: string }): Promise<string> => {
    try {
      if (!expression.trim()) {
        return 'Error: No mathematical expression provided.';
      }

      // Validate expression: only allow math characters
      const sanitized = expression.replace(/\s/g, '');
      if (!/^[0-9+\-*/().^%eE,piPIsincostalogqrtabsceilfloormaxminpowmod\b]+$/.test(sanitized) &&
          !/^[0-9+\-*/().^%eE,\s]+$/.test(expression)) {
        // Allow common math function names
        const allowedPatterns = /\b(sin|cos|tan|asin|acos|atan|log|log2|log10|sqrt|abs|ceil|floor|round|pi|e|PI|E|pow|mod|max|min|exp|atan2|sign|cbrt)\b/g;
        if (!allowedPatterns.test(expression)) {
          return 'Error: Expression contains potentially unsafe characters. Only mathematical operations are allowed.';
        }
      }

      const result = evaluate(expression);

      if (typeof result === 'number') {
        // Format large/small numbers in scientific notation
        if (Math.abs(result) > 1e10 || (Math.abs(result) < 1e-10 && result !== 0)) {
          return `Result: ${result.toExponential(6)}`;
        }
        // Check if integer
        if (Number.isInteger(result)) {
          return `Result: ${result}`;
        }
        return `Result: ${result} (approximate)`;
      }

      if (typeof result === 'object' && result !== null) {
        return `Result: ${JSON.stringify(result, null, 2)}`;
      }

      return `Result: ${String(result)}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error evaluating expression: ${msg}. Please check your mathematical syntax.`;
    }
  },
  {
    name: 'math_eval',
    description:
      'Evaluate mathematical expressions and computations safely. Supports basic arithmetic (+, -, *, /, ^), trigonometric functions, logarithms, and more.',
    schema: z.object({
      expression: z.string().describe('The mathematical expression to evaluate (e.g., "2 + 3 * 4", "sin(pi/4)", "sqrt(144)")'),
    }),
  }
);
