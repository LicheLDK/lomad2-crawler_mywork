import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  resolveTheme,
  setTheme,
  type ThemeMode,
} from '../lib/theme';

/**
 * Light/Dark toggle — preference persisted in localStorage (`lomad.theme`).
 */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    typeof document !== 'undefined' ? resolveTheme() : 'light',
  );

  useEffect(() => {
    setThemeState(resolveTheme());
  }, []);

  function onToggle() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
        aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        className="mx-auto mt-3 flex h-9 w-9 items-center justify-center rounded-lg border border-ink-100/80 text-ink-600 transition hover:bg-sand-100 hover:text-ink-900"
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg border border-ink-100/80 bg-sand-50/80 px-3 py-2 text-xs font-medium text-ink-700 transition hover:bg-sand-100 hover:text-ink-900"
    >
      <span>{theme === 'dark' ? '다크 모드' : '라이트 모드'}</span>
      {theme === 'dark' ? (
        <Sun className="h-3.5 w-3.5 text-teal-400" />
      ) : (
        <Moon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
