import type { FC } from 'react';
import SEO from '../components/seo/SEO';
import FAQ from '../components/docs/FAQ';
import CodeSnippet from '../components/ui/CodeSnippet';
import { Link } from 'react-router-dom';
import { Shield, FileCheck, Lock, ClipboardCheck } from 'lucide-react';

const UseCaseCompliance: FC = () => {
  const faqItems = [
    {
      question: 'How does ParapetAI help with regulatory compliance?',
      answer: 'ParapetAI provides HMAC-signed webhooks for tamper-proof audit trails, data redaction for PII protection, and complete data sovereignty since everything runs in your infrastructure. All telemetry stays local for compliance requirements.',
    },
    {
      question: 'What types of sensitive data can ParapetAI redact?',
      answer: 'ParapetAI includes built-in patterns for email, phone numbers, API keys, and credit cards. You can add custom regex patterns for any sensitive data format. Redaction can warn (scrub) or block requests entirely.',
    },
    {
      question: 'How do signed webhooks help with compliance?',
      answer: 'HMAC-SHA256 signed webhooks provide tamper-proof receipts for all policy decisions. Each webhook includes a signature header that can be verified, creating an immutable audit trail for compliance and regulatory requirements.',
    },
    {
      question: 'Can I audit all LLM usage for compliance?',
      answer: 'Yes, ParapetAI stores all telemetry in SQLite with policy decisions, costs, tokens, drift flags, and redaction status. Query the database or use webhooks to build comprehensive audit logs. All data remains in your infrastructure.',
    },
    {
      question: 'How does ParapetAI protect data in regulated industries?',
      answer: 'Data redaction prevents PII from reaching LLM providers. Complete data sovereignty means no data leaves your infrastructure. Signed receipts provide audit trails. Model drift detection prevents unauthorized model usage.',
    },
    {
      question: 'Can I use ParapetAI with HIPAA or GDPR requirements?',
      answer: 'ParapetAI provides tools for compliance including data redaction, audit trails, and data sovereignty. However, you should consult with legal and compliance teams to ensure your specific implementation meets regulatory requirements.',
    },
  ];

  return (
    <>
      <SEO
        title="Data Privacy & Compliance - ParapetAI"
        description="LLM gateway for regulated industries. PII protection, audit trails, signed receipts, and data sovereignty for healthcare, finance, and other compliance-focused organizations."
        keywords="LLM compliance, AI data privacy, PII protection, HIPAA LLM, GDPR AI gateway, healthcare AI, finance AI compliance, audit trail LLM"
        canonical="https://parapetai.com/use-cases/data-privacy-compliance"
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">Data Privacy & Compliance</h1>
          <div className="mt-6 rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <p className="text-base leading-7 text-text">
              <strong>How do I use LLMs in regulated industries while maintaining compliance?</strong> ParapetAI provides PII redaction, HMAC-signed audit trails, and complete data sovereignty. Redact sensitive data before it reaches providers. Generate tamper-proof receipts for all policy decisions. Keep all telemetry in your infrastructure. Perfect for healthcare, finance, and other compliance-focused organizations.
            </p>
          </div>
        </header>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">The Challenge</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Regulated industries face strict requirements for data protection, audit trails, and compliance. Using LLMs introduces risks: sensitive data may be sent to third-party providers, there's no audit trail of AI usage, and data sovereignty is lost when using hosted services.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted list-disc list-inside">
            <li>Risk of sending PII or sensitive data to LLM providers</li>
            <li>No audit trail for compliance and regulatory requirements</li>
            <li>Data sovereignty concerns with hosted services</li>
            <li>Difficulty proving compliance with regulatory bodies</li>
            <li>No way to prevent unauthorized model usage or data leakage</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">How ParapetAI Solves It</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Data Redaction</h3>
              </div>
              <p className="text-sm text-muted">
                Built-in and custom regex patterns detect and scrub PII, API keys, and sensitive data before requests reach providers. Warn mode scrubs data; block mode rejects requests entirely.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Signed Audit Trails</h3>
              </div>
              <p className="text-sm text-muted">
                HMAC-SHA256 signed webhooks provide tamper-proof receipts for all policy decisions. Each webhook includes verifiable signatures, creating immutable audit logs for compliance requirements.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Data Sovereignty</h3>
              </div>
              <p className="text-sm text-muted">
                All telemetry stored locally in SQLite. No data leaves your infrastructure. Complete control over where data is stored and who has access. Self-hosted runtime ensures data sovereignty.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Policy Enforcement</h3>
              </div>
              <p className="text-sm text-muted">
                Enforce model restrictions with drift detection. Block unauthorized models. Track all policy decisions with reasons. Complete visibility into what was allowed, blocked, and why.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Implementation Example</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Configure redaction policies, audit webhooks, and strict model controls for compliance:
          </p>
          <div className="mt-6">
            <CodeSnippet
              title="Compliance-focused configuration"
              lines={[
                'version: 1',
                '',
                'tenants:',
                '  - name: healthcare',
                '    spend:',
                '      daily_usd_cap: 1000',
                '',
                'routes:',
                '  - name: compliant-chat',
                '    tenant: healthcare',
                '    provider:',
                '      type: openai',
                '      model: gpt-4o',
                '      endpoint: https://api.openai.com/v1',
                '      provider_key_ref: ENV:OPENAI_API_KEY',
                '    policy:',
                '      max_tokens_in: 4000',
                '      max_tokens_out: 2000',
                '      budget_daily_usd: 1000',
                '      drift_strict: true',
                '      redaction:',
                '        mode: block',
                '        patterns:',
                '          - email',
                '          - phone',
                '          - ssn',
                '          - credit_card',
                '          - api_key',
                '          - custom_pattern: \\b\\d{3}-\\d{2}-\\d{4}\\b',
                '      drift_detection:',
                '        enabled: true',
                '        sensitivity: high',
                '    webhook:',
                '      url: https://audit.example.com/webhook',
                '      secret_ref: ENV:WEBHOOK_SECRET',
                '      include_prompt_snippet: false',
                '      events:',
                '        policy_decisions: true',
                '        provider_errors: true',
                '',
                'services:',
                '  - label: healthcare-app',
                '    tenant: healthcare',
                '    allowed_routes: [compliant-chat]',
                '    parapet_token_ref: ENV:PARAPET_SERVICE_HEALTHCARE_TOKEN',
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Other Use Cases</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Learn about <Link to="/use-cases/enterprise-governance" className="underline">enterprise AI governance</Link>, <Link to="/use-cases/saas-integration" className="underline">SaaS product integration</Link>, or <Link to="/use-cases/development-testing" className="underline">development and testing workflows</Link> with ParapetAI.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Get Started</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Ready to implement compliant LLM usage? Start with the <Link to="/docs/quickstart" className="underline">Quickstart guide</Link> or review the <Link to="/docs/config" className="underline">Configuration reference</Link> and <Link to="/docs/security" className="underline">Security documentation</Link> for compliance features.
          </p>
        </section>

        <FAQ items={faqItems} />
      </div>
    </>
  );
};

export default UseCaseCompliance;

