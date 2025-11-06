import type { FC } from 'react';
import { Link } from 'react-router-dom';

const DocsIndex: FC = () => {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">Documentation</h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Start with Quickstart to run the container locally, then review configuration options. Parapet exposes OpenAI‑compatible endpoints (<code>/v1/chat/completions</code>, <code>/v1/embeddings</code>) secured with <code>Authorization: Bearer &lt;service_token&gt;</code>.
        </p>
      </header>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <DocCard
          title="Quickstart"
          desc="Docker + CLI flow with curl, streaming, and embeddings examples."
          to="/docs/quickstart"
        />
        <DocCard
          title="Configuration"
          desc="Exact YAML schema, constraints, env refs, and allowed params."
          to="/docs/config"
        />
      </section>
    </div>
  );
};

const DocCard: FC<{ title: string; desc: string; to: string }> = ({ title, desc, to }) => {
  return (
    <Link
      to={to}
      className="block rounded-none border-[3px] border-border bg-surface p-5 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <h2 className="text-base font-semibold text-text">{title}</h2>
      <p className="mt-1 text-sm text-muted">{desc}</p>
    </Link>
  );
};

export default DocsIndex;



