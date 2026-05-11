/**
 * Skills System — Public API
 *
 * This barrel file re-exports everything from the skills system
 * for clean imports in the agent loop and UI components.
 */

export {
  detectSkill,
  getSkillByName,
  getAllSkills,
  getAllSkillNames,
  getSkillSummaries,
} from './skill_detector';

export type { SkillModule, SkillDetectionResult } from './skill_detector';
