'use client';

import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsConfig {
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onFocusInput: () => void;
  onCloseOrStop: () => void;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Ctrl+K or Cmd+K → New chat
      if (isMod && e.key === 'k') {
        e.preventDefault();
        config.onNewChat();
        return;
      }

      // Ctrl+B or Cmd+B → Toggle sidebar
      if (isMod && e.key === 'b') {
        e.preventDefault();
        config.onToggleSidebar();
        return;
      }

      // Ctrl+/ or Cmd+/ → Focus chat input
      if (isMod && e.key === '/') {
        e.preventDefault();
        config.onFocusInput();
        return;
      }

      // Escape → Close settings / stop streaming
      if (e.key === 'Escape') {
        e.preventDefault();
        config.onCloseOrStop();
        return;
      }
    },
    [config]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
