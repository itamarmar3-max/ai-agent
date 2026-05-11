/**
 * Skill Detection System
 *
 * Analyzes user messages to determine which skill module
 * is most appropriate. Uses a combination of keyword matching,
 * pattern scoring, and contextual analysis.
 */

import type { SkillModule } from './modules/android_dev';
import { androidDevSkill } from './modules/android_dev';
import { webDevSkill } from './modules/web_dev';
import { researcherSkill } from './modules/researcher';
import { debuggerSkill } from './modules/debugger';
import { codeReviewerSkill } from './modules/code_reviewer';
import { architectSkill } from './modules/architect';
import { writerSkill } from './modules/writer';
import { dataAnalystSkill } from './modules/data_analyst';
import { backendDevSkill } from './modules/backend_dev';
import { automatorSkill } from './modules/automator';

// Re-export the SkillModule type from the canonical location
export type { SkillModule } from './modules/android_dev';

// Re-export all skills
export {
  androidDevSkill,
  webDevSkill,
  researcherSkill,
  debuggerSkill,
  codeReviewerSkill,
  architectSkill,
  writerSkill,
  dataAnalystSkill,
  backendDevSkill,
  automatorSkill,
};

/**
 * Detection rule definition.
 * Each rule maps a set of keyword groups to a skill.
 * A message matches a rule if it contains keywords from
 * enough groups (determined by minGroupMatches).
 */
interface DetectionRule {
  skillName: string;
  keywordGroups: string[][]; // Each group is an OR — match ANY keyword in the group
  minGroupMatches: number;   // How many groups must match (AND between groups)
  boostPatterns?: RegExp[];  // Regex patterns that boost confidence
  negativePatterns?: RegExp[]; // Patterns that disqualify this skill
}

/**
 * Detection rules ordered by specificity (most specific first).
 */
const DETECTION_RULES: DetectionRule[] = [
  {
    skillName: 'android_dev',
    keywordGroups: [
      ['android', 'kotlin', 'java', 'gradle', 'apk', 'android studio', 'jetpack compose', 'activity', 'fragment', 'xml layout', 'intent', 'recyclerview', 'viewmodel', 'room database'],
      ['app', 'mobile', 'application'],
    ],
    minGroupMatches: 1,
    boostPatterns: [/android/i, /kotlin/i, /gradle/i, /jetpack/i],
    negativePatterns: [/web app/i, /website/i, /frontend/i],
  },
  {
    skillName: 'web_dev',
    keywordGroups: [
      ['website', 'web app', 'webpage', 'web page', 'landing page', 'frontend', 'react', 'next.js', 'nextjs', 'vue', 'angular', 'html', 'css', 'tailwind', 'component', 'page route'],
      ['build', 'create', 'make', 'develop', 'design', 'scaffold'],
    ],
    minGroupMatches: 1,
    boostPatterns: [/next\.?js/i, /react/i, /vue/i, /tailwind/i, /website/i, /web\s*app/i],
    negativePatterns: [/android/i, /kotlin/i, /mobile app/i],
  },
  {
    skillName: 'researcher',
    keywordGroups: [
      ['research', 'find', 'analyze', 'investigate', 'study', 'explore', 'compare', 'what is', 'how does', 'why does', 'history of', 'future of'],
    ],
    minGroupMatches: 1,
    boostPatterns: [/research/i, /investigate/i, /compare and/i, /pros and cons/i, /analysis/i],
    negativePatterns: [/debug/i, /fix/i, /error/i, /bug/i, /build/i, /create/i, /write code/i],
  },
  {
    skillName: 'debugger',
    keywordGroups: [
      ['bug', 'error', 'issue', 'problem', 'crash', 'broken', 'not working', 'fail', 'exception', 'stack trace', 'segfault', 'null pointer', 'undefined', 'type error', 'syntax error', 'runtime error', 'compile error'],
    ],
    minGroupMatches: 1,
    boostPatterns: [/error/i, /bug/i, /not working/i, /stack trace/i, /exception/i, /broken/i],
    negativePatterns: [/build/i, /create from scratch/i, /new project/i, /research/i],
  },
  {
    skillName: 'code_reviewer',
    keywordGroups: [
      ['review', 'check', 'improve', 'refactor', 'optimize', 'critique', 'evaluate', 'assess', 'audit', 'feedback'],
      ['code', 'my code', 'this code', 'function', 'class', 'module'],
    ],
    minGroupMatches: 2,
    boostPatterns: [/review\s*(my|this|the)?\s*code/i, /code\s*review/i, /improve\s*(my|this)?\s*code/i, /refactor/i],
    negativePatterns: [/debug/i, /fix/i, /error/i],
  },
  {
    skillName: 'architect',
    keywordGroups: [
      ['architecture', 'system design', 'design', 'plan', 'blueprint', 'strategy', 'roadmap', 'infrastructure'],
      ['scalab', 'microserv', 'monolith', 'distributed', 'event-driven', 'cloud', 'aws', 'gcp', 'azure', 'kubernetes', 'docker'],
    ],
    minGroupMatches: 1,
    boostPatterns: [/architecture/i, /system\s*design/i, /tech\s*stack/i, /infrastructure/i, /roadmap/i],
    negativePatterns: [/debug/i, /fix/i, /write code/i],
  },
  {
    skillName: 'writer',
    keywordGroups: [
      ['write', 'draft', 'compose', 'create article', 'create blog', 'documentation', 'readme', 'guide', 'tutorial', 'manual', 'report', 'essay', 'story', 'content'],
    ],
    minGroupMatches: 1,
    boostPatterns: [/write\s*(me|a|an)?\s*(article|blog|documentation|guide|readme|report|essay)/i, /draft/i, /compose/i],
    negativePatterns: [/code/i, /program/i, /build/i, /fix/i, /debug/i, /android/i, /website/i],
  },
  {
    skillName: 'data_analyst',
    keywordGroups: [
      ['data', 'csv', 'dataset', 'spreadsheet', 'excel', 'json data', 'database', 'sql', 'analytics', 'statistics', 'chart', 'graph', 'visualization', 'pivot', 'aggregate'],
      ['analyz', 'insight', 'trend', 'pattern', 'correlation', 'distribution', 'summariz', 'metrics', 'kpi'],
    ],
    minGroupMatches: 1,
    boostPatterns: [/data\s*analy/i, /csv/i, /dataset/i, /visualization/i, /chart\s*(the|my)?\s*data/i],
    negativePatterns: [/build app/i, /create website/i, /write code/i],
  },
  {
    skillName: 'backend_dev',
    keywordGroups: [
      ['api', 'backend', 'server', 'endpoint', 'rest', 'graphql', 'microservice', 'express', 'fastify', 'nest', 'koa', 'hapi', 'database', 'prisma', 'sequelize', 'typeorm'],
      ['build', 'create', 'develop', 'implement'],
    ],
    minGroupMatches: 1,
    boostPatterns: [/api\s*(endpoint|server|route)/i, /backend/i, /rest\s*api/i, /graphql/i, /microserv/i],
    negativePatterns: [/frontend/i, /ui\s*component/i, /css/i, /webpage/i],
  },
  {
    skillName: 'automator',
    keywordGroups: [
      ['automat', 'script', 'workflow', 'cron', 'scheduled', 'batch', 'pipeline', 'ci/cd', 'cicd', 'hook', 'trigger', 'cronjob'],
      ['process', 'task', 'job', 'repeat', 'scheduled', 'periodic'],
    ],
    minGroupMatches: 1,
    boostPatterns: [/automat/i, /workflow/i, /cron\s*job/i, /pipeline/i, /ci\/cd/i, /script/i],
    negativePatterns: [/build app/i, /website/i, /article/i],
  },
];

/**
 * Skill detection result.
 */
export interface SkillDetectionResult {
  skill: SkillModule | null;
  confidence: number;    // 0-1
  needsClarification: boolean;
  clarificationQuestion?: string;
  alternativeSkills: string[];
}

/**
 * Detect the most appropriate skill for a user message.
 *
 * Strategy:
 * 1. Score each rule against the message
 * 2. Check negative patterns to disqualify
 * 3. Apply boost patterns for higher confidence
 * 4. Return the highest-scoring skill or null if unclear
 *
 * @param message - The user's message text
 * @param manualSkill - If the user manually selected a skill, use it directly
 * @param conversationHistory - Optional recent messages for context
 */
export function detectSkill(
  message: string,
  manualSkill?: string | null,
  conversationHistory?: Array<{ role: string; content: string }>,
): SkillDetectionResult {
  // If user manually selected a skill, use it directly
  if (manualSkill && manualSkill !== 'auto') {
    const skill = getSkillByName(manualSkill);
    if (skill) {
      return {
        skill,
        confidence: 1.0,
        needsClarification: false,
        alternativeSkills: [],
      };
    }
  }

  const normalizedMessage = message.toLowerCase().trim();
  const scores: Array<{ skillName: string; score: number; boosted: boolean }> = [];

  // Build context from recent messages for better detection
  const contextMessages = conversationHistory
    ?.slice(-4) // Last 4 messages for context
    .map((m) => m.content.toLowerCase())
    .join(' ') ?? '';

  for (const rule of DETECTION_RULES) {
    // Check negative patterns first
    if (rule.negativePatterns) {
      const hasNegative = rule.negativePatterns.some((pattern) =>
        pattern.test(normalizedMessage),
      );
      if (hasNegative) continue;
    }

    // Score keyword group matches
    let matchedGroups = 0;
    for (const group of rule.keywordGroups) {
      const groupMatch = group.some((keyword) =>
        normalizedMessage.includes(keyword.toLowerCase()),
      );
      if (groupMatch) matchedGroups++;
    }

    // Also check context messages (lower weight)
    if (matchedGroups === 0 && contextMessages) {
      for (const group of rule.keywordGroups) {
        const groupMatch = group.some((keyword) =>
          contextMessages.includes(keyword.toLowerCase()),
        );
        if (groupMatch) {
          matchedGroups = Math.max(matchedGroups, 0.5); // Partial credit from context
          break;
        }
      }
    }

    if (matchedGroups >= rule.minGroupMatches) {
      // Base score proportional to how many groups matched
      let score = matchedGroups / rule.keywordGroups.length;

      // Apply boost patterns for extra confidence
      let boosted = false;
      if (rule.boostPatterns) {
        const boostCount = rule.boostPatterns.filter((pattern) =>
          pattern.test(normalizedMessage),
        ).length;
        if (boostCount > 0) {
          score = Math.min(1.0, score + boostCount * 0.15);
          boosted = true;
        }
      }

      // Bonus for longer messages (more context = more confidence)
      if (message.length > 100) {
        score = Math.min(1.0, score + 0.05);
      }

      scores.push({ skillName: rule.skillName, score, boosted });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Determine result
  if (scores.length === 0) {
    return {
      skill: null,
      confidence: 0,
      needsClarification: false,
      alternativeSkills: getAllSkillNames(),
    };
  }

  const topScore = scores[0];
  const threshold = 0.3;
  const clarificationThreshold = 0.5;

  if (topScore.score < threshold) {
    // No clear skill detected — general assistant
    return {
      skill: null,
      confidence: topScore.score,
      needsClarification: false,
      alternativeSkills: scores.slice(0, 3).map((s) => s.skillName),
    };
  }

  const skill = getSkillByName(topScore.skillName);

  if (topScore.score < clarificationThreshold && skill?.clarifyingQuestions?.length) {
    // Low confidence — ask a clarifying question
    return {
      skill,
      confidence: topScore.score,
      needsClarification: true,
      clarificationQuestion: skill.clarifyingQuestions[0],
      alternativeSkills: scores.slice(1, 3).map((s) => s.skillName),
    };
  }

  return {
    skill,
    confidence: topScore.score,
    needsClarification: false,
    alternativeSkills: scores.slice(1, 3).map((s) => s.skillName),
  };
}

/**
 * Get a skill module by its name.
 */
export function getSkillByName(name: string): SkillModule | null {
  const allSkills = getAllSkills();
  return allSkills.find((s) => s.name === name) ?? null;
}

/**
 * Get all registered skill modules.
 */
export function getAllSkills(): SkillModule[] {
  return [
    androidDevSkill,
    webDevSkill,
    researcherSkill,
    debuggerSkill,
    codeReviewerSkill,
    architectSkill,
    writerSkill,
    dataAnalystSkill,
    backendDevSkill,
    automatorSkill,
  ];
}

/**
 * Get all skill names.
 */
export function getAllSkillNames(): string[] {
  return getAllSkills().map((s) => s.name);
}

/**
 * Get a summary of all skills for display purposes.
 */
export function getSkillSummaries(): Array<{
  name: string;
  displayName: string;
  description: string;
  icon: string;
}> {
  return getAllSkills().map((s) => ({
    name: s.name,
    displayName: s.displayName,
    description: s.description,
    icon: s.icon,
  }));
}
