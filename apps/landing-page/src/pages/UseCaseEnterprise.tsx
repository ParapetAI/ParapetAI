import type { FC } from 'react';
import SEO from '../components/seo/SEO';
import FAQ from '../components/docs/FAQ';
import CodeSnippet from '../components/ui/CodeSnippet';
import { Link } from 'react-router-dom';
import { Shield, Gavel, Database, Lock } from 'lucide-react';

const UseCaseEnterprise: FC = () => {
  const faqItems = [
    {
      question: 'How does ParapetAI help with AI governance for enterprises?',
      answer: 'ParapetAI enforces policies, tracks budgets, redacts sensitive data, and provides signed receipts for compliance. It gives enterprises complete control over LLM usage, costs, and data protection without vendor lock-in.',
    },
    {
      question: 'Can ParapetAI help with compliance requirements?',
      answer: 'Yes, ParapetAI provides HMAC-signed webhooks for audit trails, data redaction for PII protection, and complete data sovereignty since everything runs in your infrastructure. Telemetry stays local for compliance.',
    },
    {
      question: 'How do I enforce budgets across multiple teams?',
      answer: 'Define multiple tenants in your configuration, each with daily spend caps. Assign services to tenants and routes. ParapetAI tracks spending per tenant and enforces hard caps to prevent overruns.',
    },
    {
      question: 'How does ParapetAI protect sensitive enterprise data?',
      answer: 'ParapetAI includes built-in and custom redaction patterns to detect and scrub PII, API keys, and other sensitive data before requests reach LLM providers. Redaction can warn or block requests.',
    },
    {
      question: 'Can I audit LLM usage across my organization?',
      answer: 'Yes, ParapetAI stores all telemetry in SQLite with policy decisions, costs, tokens, and drift flags. Signed webhooks provide real-time audit trails. All data remains in your infrastructure.',
    },
  ];

  return (
    <>
      <SEO
        title="AI Governance for Enterprises - ParapetAI"
        description="Enterprise AI governance solution with policy enforcement, budget controls, data redaction, and compliance features. Self-hosted LLM gateway for secure, auditable AI usage."
        keywords="enterprise AI governance, AI policy enforcement, LLM governance, enterprise AI security, AI compliance, self-hosted AI gateway enterprise"
        canonical="https://parapetai.com/use-cases/enterprise-governance"
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">AI Governance for Enterprises</h1>
          <div className="mt-6 rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <p className="text-base leading-7 text-text">
              <strong>How do I implement AI governance for my enterprise?</strong> ParapetAI provides a self-hosted LLM policy gateway that enforces budgets, redacts sensitive data, detects model drift, and provides signed receipts for compliance. Deploy in your infrastructure with complete data sovereignty, multi-tenant budget controls, and audit trails.
            </p>
          </div>
        </header>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">The Challenge</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Enterprises adopting LLMs face critical challenges: uncontrolled costs, data privacy risks, compliance requirements, and lack of visibility into AI usage. Without proper governance, organizations risk budget overruns, data breaches, and regulatory violations.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted list-disc list-inside">
            <li>Teams using LLMs without budget controls or spending limits</li>
            <li>Sensitive data accidentally sent to third-party LLM providers</li>
            <li>No audit trail for compliance and regulatory requirements</li>
            <li>Vendor lock-in with hosted services that hold your data</li>
            <li>Difficulty tracking and enforcing policies across multiple teams</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">How ParapetAI Solves It</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Budget Controls</h3>
              </div>
              <p className="text-sm text-muted">
                Enforce hard caps per tenant and per route with micro-dollar precision. Costs are estimated before requests, reserved, then settled after completion. Prevent budget overruns across all teams.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Data Protection</h3>
              </div>
              <p className="text-sm text-muted">
                Built-in and custom redaction patterns detect and scrub PII, API keys, and sensitive data before requests reach providers. Warn mode scrubs; block mode rejects requests entirely.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Gavel className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Policy Enforcement</h3>
              </div>
              <p className="text-sm text-muted">
                Enforce token limits, model restrictions, and drift detection. Strict mode blocks unauthorized models. All policy decisions are logged with signed receipts for auditability.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Database className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Complete Auditability</h3>
              </div>
              <p className="text-sm text-muted">
                HMAC-signed webhooks provide tamper-proof audit trails. All telemetry stored locally in SQLite. Complete data sovereignty with no data leaving your infrastructure.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Implementation Example</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Configure multiple tenants with budget caps, enforce redaction policies, and set up webhooks for audit trails:
          </p>
          <div className="mt-6">
            <CodeSnippet
              title="Enterprise configuration example"
              lines={[
                'version: 1',
                '',
                'tenants:',
                '  - name: engineering',
                '    spend:',
                '      daily_usd_cap: 500',
                '  - name: marketing',
                '    spend:',
                '      daily_usd_cap: 200',
                '',
                'routes:',
                '  - name: eng-chat',
                '    tenant: engineering',
                '    provider:',
                '      type: openai',
                '      model: gpt-4o-mini',
                '      endpoint: https://api.openai.com/v1',
                '      provider_key_ref: ENV:OPENAI_API_KEY',
                '    policy:',
                '      max_tokens_in: 4000',
                '      max_tokens_out: 2000',
                '      budget_daily_usd: 100',
                '      drift_strict: true',
                '      redaction:',
                '        mode: warn',
                '        patterns:',
                '          - email',
                '          - api_key',
                '          - phone',
                '    webhook:',
                '      url: https://audit.example.com/webhook',
                '      secret_ref: ENV:WEBHOOK_SECRET',
                '      events:',
                '        policy_decisions: true',
                '',
                'services:',
                '  - label: eng-app',
                '    tenant: engineering',
                '    allowed_routes: [eng-chat]',
                '    parapet_token_ref: ENV:PARAPET_SERVICE_ENG_TOKEN',
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Other Use Cases</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Learn about <Link to="/use-cases/multi-cloud-llm" className="underline">managing multi-cloud LLM APIs</Link>, <Link to="/use-cases/data-privacy-compliance" className="underline">data privacy and compliance</Link>, <Link to="/use-cases/saas-integration" className="underline">SaaS product integration</Link>, or <Link to="/use-cases/cost-control-startups" className="underline">cost control for startups</Link> with ParapetAI.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Get Started</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Ready to implement AI governance for your enterprise? Start with the <Link to="/docs/quickstart" className="underline">Quickstart guide</Link> or review the <Link to="/docs/config" className="underline">Configuration reference</Link> for detailed options.
          </p>
        </section>

        <FAQ items={faqItems} />
      </div>
    </>
  );
};

export default UseCaseEnterprise;

