import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export interface ImageApiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Factory function to create the generate_image tool with image API config.
 */
export function createGenerateImageTool(config?: ImageApiConfig) {
  return tool(
    async ({ prompt, size }: { prompt: string; size?: string }): Promise<string> => {
      try {
        if (!config || !config.apiKey || !config.baseUrl) {
          return 'Error: Image generation API is not configured. Please configure the image API settings (provider, API key, base URL, and model) in the settings panel.';
        }

        const response = await fetch(config.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            prompt,
            n: 1,
            size: size || '1024x1024',
            response_format: 'b64_json',
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return `Error generating image: HTTP ${response.status} - ${errorText}`;
        }

        const data = await response.json();

        if (data.data && data.data[0] && data.data[0].b64_json) {
          return `data:image/png;base64,${data.data[0].b64_json}`;
        }

        if (data.data && data.data[0] && data.data[0].url) {
          return data.data[0].url;
        }

        // Try alternative response formats
        if (data.output || data.images || data.image) {
          const imgData = data.output || data.images?.[0] || data.image;
          if (typeof imgData === 'string') {
            if (imgData.startsWith('data:')) return imgData;
            if (imgData.startsWith('http')) return imgData;
            return `data:image/png;base64,${imgData}`;
          }
        }

        return `Error: Unexpected response format from image API. Response: ${JSON.stringify(data).slice(0, 500)}`;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error generating image: ${msg}`;
      }
    },
    {
      name: 'generate_image',
      description:
        'Generate an image from a text prompt using an AI image generation API. Returns a base64 encoded image.',
      schema: z.object({
        prompt: z.string().describe('The text prompt describing the image to generate'),
        size: z
          .string()
          .optional()
          .default('1024x1024')
          .describe('Image size (e.g., "1024x1024", "512x512")'),
      }),
    }
  );
}

/**
 * Default generate_image tool without config (will return error if no config).
 */
export const generateImageTool = createGenerateImageTool();
