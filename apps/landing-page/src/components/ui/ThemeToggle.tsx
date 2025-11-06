import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const ThemeToggle: FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    const stored = window.localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored === 'dark';
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  useEffect(() => {
    try {
      const theme = isDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      window.localStorage.setItem('theme', theme);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        meta.setAttribute('content', `hsl(${bg})`);
      }
    } catch {
      // ignore
    }
  }, [isDark]);

  const toggle = () => {
    try {
      setIsDark((v) => !v);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-none border-[3px] border-border bg-surface text-text shadow-md transition-all duration-200 will-change-transform hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none"
    >
      {isDark ? (
        <Sun className="h-4 w-4 transition-transform duration-200" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 transition-transform duration-200" aria-hidden="true" />
      )}
    </button>
  );
};

export default ThemeToggle;


