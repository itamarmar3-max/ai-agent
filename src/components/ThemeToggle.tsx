'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch — render a neutral icon until mounted.
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-[var(--ds-text-secondary)]"
        aria-label="Toggle theme"
      >
        <Monitor className="w-4 h-4" />
      </Button>
    );
  }

  const next = theme === 'system'
    ? 'light'
    : resolvedTheme === 'dark'
      ? 'light'
      : 'dark';

  const Icon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} theme (current: ${theme})`}
      aria-label="Toggle theme"
    >
      <Icon className="w-4 h-4" />
    </Button>
  );
}
