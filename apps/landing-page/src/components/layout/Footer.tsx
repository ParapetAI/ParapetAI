import type { FC } from 'react';
import { Link } from 'react-router-dom';

const Footer: FC = () => {
  const dockerUrl = (import.meta as any).env?.VITE_DOCKER_URL as string | undefined;
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>&copy; {new Date().getFullYear()} ParapetAI.</span>
        <nav className="flex items-center gap-4">
          <Link to="/docs" className="underline">Docs</Link>
          <Link to="/docs/quickstart" className="underline">Quickstart</Link>
          {dockerUrl ? (
            <a href={dockerUrl} target="_blank" rel="noopener noreferrer" className="underline">Docker image</a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
};

export default Footer;


