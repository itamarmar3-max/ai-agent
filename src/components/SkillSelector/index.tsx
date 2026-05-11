'use client';

import { useState, useMemo } from 'react';
import { useChatStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronsUpDown, Sparkles, Check } from 'lucide-react';

/**
 * Skill data for the selector.
 * We define skills inline here to avoid importing server-only code.
 */
interface SkillOption {
  name: string;
  displayName: string;
  icon: string;
  description: string;
}

const SKILL_OPTIONS: SkillOption[] = [
  { name: 'auto', displayName: 'Auto-Detect', icon: '\u{1F9E0}', description: 'Automatically detect the best skill for your request' },
  { name: 'android_dev', displayName: 'Android Dev', icon: '\u{1F4F1}', description: 'Kotlin, MVVM, Jetpack Compose, full Android projects' },
  { name: 'web_dev', displayName: 'Web Dev', icon: '\u{1F310}', description: 'Next.js, Tailwind CSS, TypeScript, responsive design' },
  { name: 'researcher', displayName: 'Researcher', icon: '\u{1F52C}', description: 'Deep research, multi-source search, cross-referencing' },
  { name: 'debugger', displayName: 'Debugger', icon: '\u{1F41B}', description: 'Root cause analysis, systematic bug diagnosis' },
  { name: 'code_reviewer', displayName: 'Code Reviewer', icon: '\u{1F441}\u{FE0F}', description: 'Code review with scoring and improvement suggestions' },
  { name: 'architect', displayName: 'Architect', icon: '\u{1F3D7}\u{FE0F}', description: 'System design, technology selection, trade-off analysis' },
  { name: 'writer', displayName: 'Writer', icon: '\u270D\u{FE0F}', description: 'Technical writing, documentation, articles, reports' },
  { name: 'data_analyst', displayName: 'Data Analyst', icon: '\u{1F4CA}', description: 'Data analysis, pattern recognition, visualization' },
  { name: 'backend_dev', displayName: 'Backend Dev', icon: '\u2699\u{FE0F}', description: 'Node.js, Express, REST API, database integration' },
  { name: 'automator', displayName: 'Automator', icon: '\u{1F916}', description: 'Workflows, scripts, cron jobs, task automation' },
];

/**
 * SkillSelector - Dropdown to manually select or override the active skill.
 */
export function SkillSelector() {
  const manualSkill = useChatStore((s) => s.manualSkill);
  const activeSkill = useChatStore((s) => s.activeSkill);
  const setManualSkill = useChatStore((s) => s.setManualSkill);
  const [open, setOpen] = useState(false);

  // Determine the currently displayed skill
  const displaySkill = useMemo(() => {
    if (manualSkill === null) {
      if (activeSkill) {
        return SKILL_OPTIONS.find((s) => s.name === activeSkill.name) ?? SKILL_OPTIONS[0];
      }
      return SKILL_OPTIONS[0];
    }
    return SKILL_OPTIONS.find((s) => s.name === manualSkill) ?? SKILL_OPTIONS[0];
  }, [manualSkill, activeSkill]);

  const isAutoMode = manualSkill === null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs h-7 px-2 rounded-lg transition-smooth"
          style={{ color: 'var(--ds-text-secondary)' }}
        >
          <Sparkles className="w-3 h-3" />
          <span className="hidden sm:inline">{displaySkill.icon}</span>
          <span className="hidden sm:inline">{displaySkill.displayName}</span>
          <ChevronsUpDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-1"
        align="start"
        style={{
          background: 'var(--ds-bg-secondary)',
          border: '1px solid var(--ds-border)',
        }}
      >
        <div className="px-2 py-1.5 text-xs font-medium" style={{ color: 'var(--ds-text-muted)' }}>
          Select Skill Mode
        </div>
        <div className="space-y-0.5 max-h-[320px] overflow-y-auto">
          {SKILL_OPTIONS.map((skill) => {
            const isSelected = isAutoMode
              ? skill.name === 'auto'
              : skill.name === manualSkill;

            return (
              <button
                key={skill.name}
                onClick={() => {
                  setManualSkill(skill.name === 'auto' ? null : skill.name);
                  setOpen(false);
                }}
                className="w-full flex items-start gap-2.5 rounded-md px-2 py-2 text-left transition-smooth"
                style={{
                  background: isSelected ? 'var(--ds-accent-glow)' : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--ds-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span className="text-base mt-0.5 shrink-0">{skill.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs" style={{ color: isSelected ? 'var(--ds-accent)' : 'var(--ds-text-primary)' }}>
                      {skill.displayName}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ds-accent)' }} />
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--ds-text-secondary)' }}>
                    {skill.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        {isAutoMode && activeSkill && (
          <div className="mt-1 pt-1.5 px-2 pb-1" style={{ borderTop: '1px solid var(--ds-border)' }}>
            <p className="text-[10px]" style={{ color: 'var(--ds-text-muted)' }}>
              Auto-detected: {activeSkill.icon} {activeSkill.displayName} ({Math.round(activeSkill.confidence * 100)}%)
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
