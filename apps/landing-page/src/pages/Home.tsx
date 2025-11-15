import type { FC, ReactElement } from 'react';
import Button from '../components/ui/Button';
import CodeSnippet from '../components/ui/CodeSnippet';
import SEO from '../components/seo/SEO';
import FAQ from '../components/docs/FAQ';
import { Shield, Shuffle, Receipt, Rocket, Sparkles, Book, GitFork } from 'lucide-react';

const Home: FC = () => {
  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ParapetAI',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Docker',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'Self-hosted LLM policy gateway with budgets, redaction, and signed receipts. Enforce policies, track costs, and protect sensitive data with OpenAI-compatible endpoints.',
    featureList: [
      'Budget tracking and hard caps',
      'Data redaction and PII protection',
      'Model drift detection',
      'Signed webhook receipts',
      'OpenAI-compatible API',
      'Self-hosted deployment',
    ],
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ParapetAI',
    url: 'https://parapetai.com',
    description: 'Open source self-hosted LLM policy gateway',
    sameAs: [
      'https://github.com/ParapetAI/ParapetAI',
    ],
  };

  const homeStructuredData = [softwareAppSchema, organizationSchema];

  const faqItems = [
    {
      question: 'What is ParapetAI?',
      answer: 'ParapetAI is a self-hosted LLM policy gateway that enforces budgets, detects model drift, redacts sensitive data, and provides signed receipts for all policy decisions. It acts as a proxy between your applications and LLM providers like OpenAI.',
    },
    {
      question: 'How does ParapetAI work?',
      answer: 'You define a YAML configuration with tenants, routes, and policies. The CLI encrypts this into a bootstrap file. The runtime container reads the bootstrap and enforces policies on all LLM API requests, tracking costs and applying redaction rules.',
    },
    {
      question: 'Is ParapetAI free?',
      answer: 'Yes, ParapetAI is completely free and open source. There are no subscription fees, usage limits, or hidden costs. You run it yourself in your own infrastructure.',
    },
    {
      question: 'How do I route requests to multiple LLMs?',
      answer: 'Define multiple routes in your parapet.yaml, each pointing to different providers or models. Services can be granted access to specific routes. ParapetAI handles routing based on the model parameter in your requests.',
    },
    {
      question: 'What is the best self-hosted LLM gateway?',
      answer: 'ParapetAI is designed as the best self-hosted LLM gateway for teams needing policy enforcement, budget controls, and data protection. It offers encrypted configuration, signed receipts, and complete data sovereignty.',
    },
    {
      question: 'How does ParapetAI compare to hosted services?',
      answer: 'Unlike hosted dashboard services, ParapetAI is free, keeps your data in your infrastructure, uses offline configuration, and provides signed receipts for compliance. There is no vendor lock-in or subscription fees.',
    },
    {
      question: 'Can I use ParapetAI with local LLMs?',
      answer: 'Yes, ParapetAI supports both OpenAI and local providers. Configure a local route with endpoint_type and point it to your local LLM API endpoint. The same policies and budgets apply.',
    },
  ];

  return (
    <>
      <SEO
        title="ParapetAI - Self-hosted LLM Policy Gateway"
        description="Self-hosted LLM gateway with budgets, redaction, and signed receipts. Enforce policies, track costs, and protect sensitive data with OpenAI-compatible endpoints. Free and open source."
        keywords="LLM gateway, self-hosted LLM gateway, AI gateway, LLM policy gateway, OpenAI compatible gateway, budget tracking, AI governance, self-hosted AI infrastructure"
        canonical="https://parapetai.com/"
        structuredData={homeStructuredData}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        {/* Hero */}
        <section aria-labelledby="hero" className="relative">
          <div className="mx-auto grid max-w-6xl items-stretch gap-10 md:grid-cols-2">
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
              <Button
                href="https://github.com/ParapetAI/ParapetAI/fork"
                size="large"
                variant="secondary"
                icon={<GitFork className="h-5 w-5" aria-hidden="true" />}
                target="_blank"
                rel="noopener noreferrer"
              >
                Fork on GitHub
              </Button>
              </div>
            </div>
          <div className="mt-2 flex h-full">
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

      {/* How it works */}
      <section aria-labelledby="how" className="mt-16 sm:mt-24">
        <h2 id="how" className="text-2xl font-semibold text-text sm:text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          <li className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-[3px] border-border bg-surface text-base font-semibold text-text shadow-sm">1</span>
              <h3 className="text-base font-semibold text-text">Define config</h3>
            </div>
            <p className="text-sm leading-6 text-muted">Write <code>parapet.yaml</code> with tenants, routes, policies, and services.</p>
          </li>
          <li className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-[3px] border-border bg-surface text-base font-semibold text-text shadow-sm">2</span>
              <h3 className="text-base font-semibold text-text">Build bootstrap</h3>
            </div>
            <p className="text-sm leading-6 text-muted">Use the CLI to validate and encrypt into an <code>.env</code> bootstrap.</p>
          </li>
          <li className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-[3px] border-border bg-surface text-base font-semibold text-text shadow-sm">3</span>
              <h3 className="text-base font-semibold text-text">Run container</h3>
            </div>
            <p className="text-sm leading-6 text-muted">Start the runtime. Call OpenAI‑compatible endpoints with your service token.</p>
          </li>
        </ol>
      </section>

      {/* Comparison */}
      <section aria-labelledby="compare" className="mt-16 sm:mt-24">
        <h2 id="compare" className="text-lg font-semibold text-text">ParapetAI LLM Gateway (self-hosted) vs Hosted Dashboard Services</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <h3 className="text-base font-semibold text-text mb-4">ParapetAI (Self-Hosted)</h3>
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
            <p className="mt-2 text-sm text-muted">Open source — <a href="https://github.com/ParapetAI/ParapetAI" target="_blank" rel="noopener noreferrer" className="underline">contribute by forking</a>.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="/docs/quickstart" size="large" icon={<Rocket className="h-5 w-5" aria-hidden="true" />}>Get Started</Button>
            <Button href="https://github.com/ParapetAI/ParapetAI/fork" size="large" variant="secondary" icon={<GitFork className="h-5 w-5" aria-hidden="true" />} target="_blank" rel="noopener noreferrer">Fork on GitHub</Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQ items={faqItems} />
    </div>
    </>
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


