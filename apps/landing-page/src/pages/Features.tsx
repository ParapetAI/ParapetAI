import type { FC, ReactElement } from 'react';
import SEO from '../components/seo/SEO';
import FAQ from '../components/docs/FAQ';
import { Shield, Workflow, Gavel, PiggyBank, EyeOff, Activity, PlugZap, Database, Webhook, Layers, RotateCcw, Cog } from 'lucide-react';

const Features: FC = () => {
  const faqItems = [
    {
      question: 'What features does ParapetAI provide?',
      answer: 'ParapetAI provides authentication, route selection, policy enforcement, budget tracking, data redaction, drift detection, provider abstraction, telemetry, webhooks, caching, retry logic, and encrypted configuration. It supports OpenAI-compatible chat completions and embeddings with SSE streaming.',
    },
    {
      question: 'Does ParapetAI include a dashboard?',
      answer: 'No, ParapetAI does not include a dashboard UI. Configuration is done via YAML files and the CLI. Telemetry is stored in SQLite and can be queried directly or via webhooks.',
    },
    {
      question: 'How does budget tracking work?',
      answer: 'ParapetAI uses micro-dollar accounting with daily caps per tenant and per route. Costs are estimated before each request, reserved, then settled after completion. This prevents budget overruns.',
    },
    {
      question: 'What is drift detection?',
      answer: 'Drift detection flags when requests use models, fingerprints, or costs that differ from expectations. Strict mode blocks unauthorized models, while detection mode only flags anomalies for observability.',
    },
    {
      question: 'Can I use custom redaction patterns?',
      answer: 'Yes, ParapetAI includes built-in patterns for email, API keys, IP addresses, and phone numbers. You can also define custom regex patterns for any sensitive data you need to protect.',
    },
    {
      question: 'How do webhooks work?',
      answer: 'ParapetAI sends HMAC-SHA256 signed webhooks for policy decisions and provider errors. Receivers can verify signatures to ensure authenticity. Webhooks include policy context, costs, and optional prompt snippets.',
    },
  ];

  return (
    <>
      <SEO
        title="Features - ParapetAI"
        description="ParapetAI provides authentication, policy enforcement, budget tracking, data redaction, drift detection, and signed webhooks. OpenAI-compatible chat and embeddings with SSE streaming support."
        keywords="LLM gateway features, AI gateway capabilities, budget tracking, data redaction, model drift detection, OpenAI compatible API, LLM policy enforcement"
        canonical="https://parapetai.com/features"
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">Features</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            OpenAI‑compatible chat and embeddings (SSE streaming). Local OpenAI‑style endpoints.
            Not included: dashboard, rate limiter, circuit breaker.
          </p>
        </header>

      <section className="mt-12 grid gap-6 sm:grid-cols-2">
        <FeatureCard
          title="Authentication & Authorization"
          desc="Bearer tokens map to a service and its allowed routes. No token, no access."
          icon={<Shield className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
        <FeatureCard
          title="Route Selection & Model Matching"
          desc="Exact model + endpoint only. If it’s not on your allowlist, it’s a no."
          icon={<Workflow className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
        <FeatureCard
          title="Policy Enforcement Pipeline"
          desc="In order: cap tokens, preflight drift, scrub or block, estimate cost, reserve, call, settle."
          icon={<Gavel className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
        <FeatureCard
          title="Budget Tracking"
          desc="Micro‑dollar accounting with daily caps. Reserve before the call, settle after."
          icon={<PiggyBank className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
        <FeatureCard
          title="Redaction"
          desc="Built‑in email/keys/IP/phone plus custom regex. Warn (scrub) or block."
          icon={<EyeOff className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
        <FeatureCard
          title="Drift Detection"
          desc="Strict mode stops shadow usage. Detection flags model/fingerprint/cost anomalies."
          icon={<Activity className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
        <FeatureCard
          title="Provider System"
          desc="OpenAI and Local adapters. Merge/validate params. Swap providers without app rewrites."
          icon={<PlugZap className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
        <FeatureCard
          title="Telemetry & Observability"
          desc="SQLite events with batched writes. Replay budgets on boot. Your data stays in your infra."
          icon={<Database className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
        <FeatureCard
          title="Webhooks"
          desc="HMAC‑signed receipts for policy decisions and errors. Optional prompt snippet."
          icon={<Webhook className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
        <FeatureCard
          title="Caching"
          desc="Per‑route LRU for non‑streaming responses. Keys include payload, params, and redaction mode."
          icon={<Layers className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
        <FeatureCard
          title="Retry Logic"
          desc="Exponential backoff with jitter. Status‑aware; streaming retries at the reader."
          icon={<RotateCcw className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
        <FeatureCard
          title="Configuration System"
          desc="One YAML with strict schema checks. Secret refs from env. Encrypted into an immutable bootstrap."
          icon={<Cog className="h-5 w-5 text-accent" aria-hidden="true" />}
        />
      </section>

      <section className="mt-16">
        <h2 className="text-lg font-semibold text-text">Highlights</h2>
        <ul className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-3">
          <li className="rounded-none border-[3px] border-border bg-surface p-4 shadow-md">
            <span className="font-medium text-text">OpenAI‑compatible</span>
            <div className="mt-1">Swap providers or self‑host without rewriting your app.</div>
          </li>
          <li className="rounded-none border-[3px] border-border bg-surface p-4 shadow-md">
            <span className="font-medium text-text">Self‑hosted</span>
            <div className="mt-1">Immutable runtime; config built offline by a CLI.</div>
          </li>
          <li className="rounded-none border-[3px] border-border bg-surface p-4 shadow-md">
            <span className="font-medium text-text">Signed receipts</span>
            <div className="mt-1">HMAC‑signed webhooks for auditability and compliance.</div>
          </li>
        </ul>
      </section>

      <FAQ items={faqItems} />
    </div>
    </>
  );
};

const FeatureCard: FC<{ title: string; desc: string; icon?: ReactElement }> = ({ title, desc, icon }) => {
  return (
    <div className="rounded-none border-[3px] border-border bg-surface p-5 shadow-md">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-base font-semibold text-text">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-muted">{desc}</p>
    </div>
  );
};

export default Features;


