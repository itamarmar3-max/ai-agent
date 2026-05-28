'use client';

import { useChatStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sparkles } from 'lucide-react';

/**
 * SkillIndicator - Displays the currently active skill as a pill-shaped badge.
 */
export function SkillIndicator() {
  const activeSkill = useChatStore((s) => s.activeSkill);
  const isStreaming = useChatStore((s) => s.isStreaming);

  if (!activeSkill) return null;

  const confidencePercent = Math.round(activeSkill.confidence * 100);
  const confidenceLabel =
    confidencePercent >= 80 ? 'High' : confidencePercent >= 50 ? 'Medium' : 'Low';

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={
              'gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-all duration-300 ' +
              (isStreaming ? 'animate-pulse-subtle' : '')
            }
            style={{
              background: 'var(--ds-accent-soft)',
              border: '1px solid var(--ds-accent-glow-strong)',
              color: 'var(--ds-accent)',
            }}
          >
            <Sparkles className="w-3 h-3" />
            <span>{activeSkill.icon}</span>
            <span>{activeSkill.displayName}</span>
            <span style={{ color: 'var(--ds-text-secondary)' }}>
              {confidencePercent}%
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <div className="font-medium">
              Active Skill: {activeSkill.icon} {activeSkill.displayName}
            </div>
            <div style={{ color: 'var(--ds-text-secondary)' }}>
              Confidence: {confidencePercent}% ({confidenceLabel})
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
