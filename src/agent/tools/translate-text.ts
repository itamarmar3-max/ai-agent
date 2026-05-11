import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * translate_text - Translate text between languages.
 * Since this is a tool-level implementation without LLM access,
 * it provides basic word replacement for common phrases and
 * recommends using the AI conversation for proper translations.
 */
export const translateTextTool = tool(
  async ({
    text,
    target_language,
    source_language,
  }: {
    text: string;
    target_language: string;
    source_language?: string;
  }): Promise<string> => {
    try {
      if (!text.trim()) {
        return 'Error: No text provided to translate.';
      }

      const source = source_language || 'auto-detected';

      // This tool works as a pass-through that signals the need for AI-based translation.
      // In a real implementation, you would connect to a translation API or LLM here.
      // For now, we return a structured request that the agent runner can handle.

      const commonTranslations: Record<string, Record<string, string>> = {
        hello: { spanish: 'hola', french: 'bonjour', german: 'hallo', japanese: 'こんにちは', chinese: '你好', korean: '안녕하세요', portuguese: 'olá', italian: 'ciao', russian: 'привет', arabic: 'مرحبا' },
        thank_you: { spanish: 'gracias', french: 'merci', german: 'danke', japanese: 'ありがとう', chinese: '谢谢', korean: '감사합니다', portuguese: 'obrigado', italian: 'grazie', russian: 'спасибо', arabic: 'شكرا' },
        goodbye: { spanish: 'adiós', french: 'au revoir', german: 'auf wiedersehen', japanese: 'さようなら', chinese: '再见', korean: '안녕히 가세요', portuguese: 'adeus', italian: 'arrivederci', russian: 'до свидания', arabic: 'مع السلامة' },
        yes: { spanish: 'sí', french: 'oui', german: 'ja', japanese: 'はい', chinese: '是', korean: '네', portuguese: 'sim', italian: 'sì', russian: 'да', arabic: 'نعم' },
        no: { spanish: 'no', french: 'non', german: 'nein', japanese: 'いいえ', chinese: '不', korean: '아니요', portuguese: 'não', italian: 'no', russian: 'нет', arabic: 'لا' },
      };

      // Check for common single-word translations
      const lowerText = text.toLowerCase().trim();
      const langKey = target_language.toLowerCase();

      for (const [, translations] of Object.entries(commonTranslations)) {
        if (translations[langKey]) {
          // Check if the input matches any key
          const keyMatch = Object.entries(commonTranslations).find(
            ([key]) => lowerText === key.replace(/_/g, ' ') || lowerText === key
          );
          if (keyMatch) {
            return `${translations[langKey]}`;
          }
        }
      }

      // For anything more complex, return a message suggesting the AI handles it
      return `[TRANSLATION_REQUEST]
Source language: ${source}
Target language: ${target_language}
Text to translate: "${text}"

Note: Complex translations are best handled by the AI model directly through conversation. The AI will provide a natural, accurate translation.]`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error translating text: ${msg}`;
    }
  },
  {
    name: 'translate_text',
    description:
      'Translate text from one language to another. For best results with complex text, the AI model handles translation through conversation.',
    schema: z.object({
      text: z.string().describe('The text to translate'),
      target_language: z.string().describe('The language to translate to (e.g., "Spanish", "French", "Japanese")'),
      source_language: z.string().optional().describe('The source language (auto-detected if not provided)'),
    }),
  }
);
