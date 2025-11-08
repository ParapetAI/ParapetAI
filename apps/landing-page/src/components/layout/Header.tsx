import type { FC } from 'react';
import ThemeToggle from '../ui/ThemeToggle';
import Logo from '../ui/Logo';
import { Link } from 'react-router-dom';

const Header: FC = () => {
  const githubUrl = (import.meta as any).env?.VITE_GITHUB_URL as string | undefined;
  return (
    <header className="sticky top-0 z-10 w-full border-b-[3px] border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link to="/" aria-label="Home" className="inline-flex items-center">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <nav aria-label="Primary" className="hidden items-center gap-3 sm:flex">
            <Link
              to="/features"
              className="inline-flex items-center rounded-none border-[3px] border-border bg-surface px-3 py-1.5 text-sm text-text shadow-md transition-all duration-200 will-change-transform hover:bg-surface/90 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm"
            >
              Features
            </Link>
            <a
              href="/docs"
              className="inline-flex items-center rounded-none border-[3px] border-border bg-surface px-3 py-1.5 text-sm text-text shadow-md transition-all duration-200 will-change-transform hover:bg-surface/90 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm"
            >
              Docs
            </a>
            {githubUrl ? (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-none border-[3px] border-border bg-surface px-3 py-1.5 text-sm text-text shadow-md transition-all duration-200 will-change-transform hover:bg-surface/90 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm"
              >
                GitHub
              </a>
            ) : null}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Header;


