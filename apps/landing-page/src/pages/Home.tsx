import type { FC, ReactElement } from 'react';
import Button from '../components/ui/Button';
import CodeSnippet from '../components/ui/CodeSnippet';
import { Shield, Shuffle, Receipt, Rocket, Sparkles, Book } from 'lucide-react';

const Home: FC = () => {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      {/* Hero */}
      <section aria-labelledby="hero" className="relative">
        <div className="mx-auto grid max-w-6xl items-start gap-10 md:grid-cols-2">
          <div>
            <h1 id="hero" className="text-5xl font-semibold tracking-tight text-text sm:text-6xl">
              Self‑hosted LLM policy gateway
            </h1>
            <p className="mt-4 text-base leading-7 text-muted max-w-[60ch]">
              Enforce budgets, drift guard, and redaction with OpenAI‑compatible endpoints. Self‑hosted runtime, encrypted config, signed receipts. Totally free.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
              <Button
                href="/docs/quickstart"
                size="large"
                icon={<Rocket className="h-5 w-5" aria-hidden="true" />}
              >
                Get Started
              </Button>
              <Button
                href="/docs"
                size="large"
                variant="secondary"
                icon={<Book className="h-5 w-5" aria-hidden="true" />}
              >
                Read the Docs
              </Button>
            </div>
          </div>
          <div className="mt-2">
            <CodeSnippet
              title="Run locally in three commands"
              lines={[
                '# Build encrypted config (.env) from your YAML',
                'npx @parapetai/cli@latest build-config --file parapet.yaml --non-interactive --out .env',
                '',
                '# Pull the runtime container',
                'docker pull parapetai/parapetai-runtime:latest',
                '',
                '# Run it with the encrypted config',
                'docker run -p 8000:8000 -v parapet-data:/data --env-file .env parapetai/parapetai-runtime:latest',
              ]}
            />
          </div>
        </div>
      </section>

      {/* Value tiles */}
      <section aria-labelledby="value" className="mt-24">
        <h2 id="value" className="sr-only">Why Parapet</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <Tile title="Budgets (hard caps)" desc="Daily per‑tenant and per‑route caps. Reserve before call; settle after." icon={<Shield className="h-5 w-5 text-accent" aria-hidden="true" />} />
          <Tile title="Redaction (off/warn/block)" desc="Builtin patterns + custom regex. Scrub on warn; block on match." icon={<Shuffle className="h-5 w-5 text-accent" aria-hidden="true" />} />
          <Tile title="Signed webhooks (receipts)" desc="HMAC‑SHA256 receipts for policy decisions and provider errors." icon={<Receipt className="h-5 w-5 text-accent" aria-hidden="true" />} />
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mt-16 sm:mt-24">
        <h2 id="how" className="text-lg font-semibold text-text">How it works</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          <li className="rounded-none border-[3px] border-border bg-surface p-5 shadow-md">
            <div className="text-sm font-semibold text-text">1) Define config</div>
            <p className="mt-2 text-sm text-muted">Write <code>parapet.yaml</code> with tenants, routes, policies, and services.</p>
          </li>
          <li className="rounded-none border-[3px] border-border bg-surface p-5 shadow-md">
            <div className="text-sm font-semibold text-text">2) Build bootstrap</div>
            <p className="mt-2 text-sm text-muted">Use the CLI to validate and encrypt into an <code>.env</code> bootstrap.</p>
          </li>
          <li className="rounded-none border-[3px] border-border bg-surface p-5 shadow-md">
            <div className="text-sm font-semibold text-text">3) Run container</div>
            <p className="mt-2 text-sm text-muted">Start the runtime. Call OpenAI‑compatible endpoints with your service token.</p>
          </li>
        </ol>
      </section>

      {/* Quickstart teaser */}
      <section aria-labelledby="teaser" className="mt-16 sm:mt-24">
        <h2 id="teaser" className="text-lg font-semibold text-text">Try it now</h2>
        <p className="mt-2 text-sm text-muted">Point your existing OpenAI client at Parapet’s base URL and use your service token.</p>
        <div className="mt-4">
          <CodeSnippet
            lines={[
              'curl -sS http://localhost:8000/v1/chat/completions \\\\',
              '  -H "Authorization: Bearer $PARAPET_SERVICE_MYAPP_TOKEN" \\\\',
              '  -H "Content-Type: application/json" \\\\',
              '  -d "{\\\"model\\\":\\\"gpt-4o-mini\\\",\\\"messages\\\":[{\\\"role\\\":\\\"user\\\",\\\"content\\\":\\\"Hello\\\"}]}"',
            ]}
          />
        </div>
      </section>

      {/* Comparison */}
      <section aria-labelledby="compare" className="mt-16 sm:mt-24">
        <h2 id="compare" className="text-lg font-semibold text-text">ParapetAI LLM Gateway (self-hosted) vs Hosted Dashboard Services</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <h3 className="text-base font-semibold text-text mb-4">Parapet (Self-Hosted)</h3>
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><span className="font-medium text-text">Free to run:</span> No subscriptions, no usage caps.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><span className="font-medium text-text">Offline config:</span> Build locally; ship only encrypted bootstrap.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><span className="font-medium text-text">OpenAI‑compatible:</span> Swap providers without app rewrites.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><span className="font-medium text-text">Signed receipts:</span> HMAC‑signed webhooks for audits.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><span className="font-medium text-text">Data stays with you:</span> Telemetry/logs remain in your infra.</span>
              </li>
            </ul>
          </div>
          <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <h3 className="text-base font-semibold text-text mb-4">Hosted Dashboard Services</h3>
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex items-start gap-2">
                <span className="text-danger mt-0.5">×</span>
                <span><span className="font-medium text-text">Subscription fees:</span> Pay monthly/usage tiers with overages.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger mt-0.5">×</span>
                <span><span className="font-medium text-text">Secrets in vendor UIs:</span> Keys live in third‑party dashboards.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger mt-0.5">×</span>
                <span><span className="font-medium text-text">Vendor lock‑in:</span> Proprietary SDKs and migration friction.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger mt-0.5">×</span>
                <span><span className="font-medium text-text">Opaque observability:</span> Limited exports and audit trails.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger mt-0.5">×</span>
                <span><span className="font-medium text-text">Data leaves your infra:</span> Payloads/telemetry flow via vendors.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section aria-labelledby="cta" className="mt-16 sm:mt-24">
        <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 id="cta" className="text-lg font-semibold text-text">Run locally in 60 seconds</h2>
            <p className="mt-1 text-sm text-muted">One container. OpenAI‑compatible. Policies, budgets, and signed receipts.</p>
          </div>
          <div>
            <Button href="/docs/quickstart" size="large" icon={<Rocket className="h-5 w-5" aria-hidden="true" />}>Get Started</Button>
          </div>
        </div>
      </section>
    </div>
  );
};

const Tile: FC<{ title: string; desc: string; icon?: ReactElement }> = ({ title, desc, icon }) => {
  return (
    <div className="rounded-none border-[3px] border-border bg-surface p-5 shadow-md transition">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-base font-semibold text-text">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-muted">{desc}</p>
    </div>
  );
};

export default Home;


