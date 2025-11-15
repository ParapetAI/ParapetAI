import type { FC } from 'react';
import SEO from '../components/seo/SEO';
import FAQ from '../components/docs/FAQ';
import CodeSnippet from '../components/ui/CodeSnippet';
import { Link } from 'react-router-dom';
import { Code, TestTube, Bug, Zap } from 'lucide-react';

const UseCaseDevelopment: FC = () => {
  const faqItems = [
    {
      question: 'How does ParapetAI prevent expensive mistakes during development?',
      answer: 'ParapetAI enforces token limits, budget caps, and drift detection. Set low daily budgets for dev environments. Token limits prevent accidentally sending huge payloads. Drift detection catches model mismatches that could cause unexpected costs.',
    },
    {
      question: 'Can I use local LLMs for development?',
      answer: 'Yes, ParapetAI supports local providers. Configure routes pointing to your local LLM endpoints. Use the same policies and budgets as cloud providers, but with zero API costs for local models.',
    },
    {
      question: 'How do I test with different models without changing code?',
      answer: 'Define multiple routes with different models. Your application code stays the same - just change which route your service token can access. Test GPT-4, GPT-3.5, and local models with identical code.',
    },
    {
      question: 'What happens if I accidentally trigger a loop in development?',
      answer: 'Budget caps will block requests once the daily limit is reached. Token limits prevent sending massive payloads. Combined with drift detection, ParapetAI stops expensive mistakes before they drain your account.',
    },
    {
      question: 'How do I track costs during development?',
      answer: 'ParapetAI stores all telemetry in SQLite with detailed cost information. Set up webhooks for real-time alerts. Query the database to see exactly which requests cost what, helping you optimize before production.',
    },
    {
      question: 'Can I use different budgets for dev, staging, and production?',
      answer: 'Yes, configure separate tenants or routes for each environment. Dev environments get low budgets to catch mistakes early. Production gets higher limits. Use different service tokens per environment.',
    },
  ];

  return (
    <>
      <SEO
        title="Development & Testing Workflows - ParapetAI"
        description="Prevent expensive mistakes during development. Test with different models, track costs, and use local LLMs with the same policy framework. Perfect for development and testing workflows."
        keywords="LLM development, AI testing, local LLM gateway, development AI gateway, prevent AI mistakes, dev environment LLM, test LLM models"
        canonical="https://parapetai.com/use-cases/development-testing"
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">Development & Testing Workflows</h1>
          <div className="mt-6 rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <p className="text-base leading-7 text-text">
              <strong>How do I prevent expensive mistakes while developing with LLMs?</strong> ParapetAI enforces budget caps, token limits, and drift detection to stop costly errors before they happen. Test with different models using the same code. Use local LLMs for zero-cost development. Track costs to optimize before production.
            </p>
          </div>
        </header>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">The Challenge</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Developing with LLMs is risky. A single bug, infinite loop, or misconfigured retry can result in thousands of dollars in API charges. Testing different models requires code changes. Local LLMs lack the same policy framework as cloud providers. Development environments need protection without production complexity.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted list-disc list-inside">
            <li>Accidental loops or bugs can drain API budgets instantly</li>
            <li>Testing different models requires code changes</li>
            <li>No cost visibility until the monthly bill arrives</li>
            <li>Local LLMs lack policy enforcement and budget controls</li>
            <li>Difficult to prevent expensive mistakes before production</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">How ParapetAI Solves It</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Bug className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Prevent Mistakes</h3>
              </div>
              <p className="text-sm text-muted">
                Budget caps stop runaway loops. Token limits prevent accidentally sending huge payloads. Drift detection catches model mismatches. Set low dev budgets to catch errors early.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <TestTube className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Model Testing</h3>
              </div>
              <p className="text-sm text-muted">
                Define multiple routes with different models. Your code stays the same - just change which route your service token accesses. Test GPT-4, GPT-3.5, and local models seamlessly.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Local LLM Support</h3>
              </div>
              <p className="text-sm text-muted">
                Use local LLMs with the same policy framework. Zero API costs for development. Same budgets, redaction, and drift detection. Switch between local and cloud providers without code changes.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Code className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Cost Tracking</h3>
              </div>
              <p className="text-sm text-muted">
                Track every request with detailed cost data. See which tests or features cost the most. Optimize before production. Set up webhooks for real-time cost alerts during development.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Implementation Example</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Configure dev and production environments with different budgets and models:
          </p>
          <div className="mt-6">
            <CodeSnippet
              title="Development and production configuration"
              lines={[
                'version: 1',
                '',
                'tenants:',
                '  - name: dev',
                '    spend:',
                '      daily_usd_cap: 10',
                '  - name: prod',
                '    spend:',
                '      daily_usd_cap: 500',
                '',
                'routes:',
                '  - name: dev-local',
                '    tenant: dev',
                '    provider:',
                '      type: local',
                '      model: llama-3-8b',
                '      endpoint: http://localhost:8000/v1',
                '    policy:',
                '      max_tokens_in: 1000',
                '      max_tokens_out: 500',
                '      budget_daily_usd: 0',
                '',
                '  - name: dev-openai',
                '    tenant: dev',
                '    provider:',
                '      type: openai',
                '      model: gpt-4o-mini',
                '      endpoint: https://api.openai.com/v1',
                '      provider_key_ref: ENV:OPENAI_API_KEY',
                '    policy:',
                '      max_tokens_in: 2000',
                '      max_tokens_out: 1000',
                '      budget_daily_usd: 10',
                '      drift_strict: true',
                '',
                '  - name: prod-chat',
                '    tenant: prod',
                '    provider:',
                '      type: openai',
                '      model: gpt-4o',
                '      endpoint: https://api.openai.com/v1',
                '      provider_key_ref: ENV:OPENAI_API_KEY',
                '    policy:',
                '      max_tokens_in: 8000',
                '      max_tokens_out: 4000',
                '      budget_daily_usd: 500',
                '',
                'services:',
                '  - label: dev-app',
                '    tenant: dev',
                '    allowed_routes: [dev-local, dev-openai]',
                '    parapet_token_ref: ENV:PARAPET_SERVICE_DEV_TOKEN',
                '',
                '  - label: prod-app',
                '    tenant: prod',
                '    allowed_routes: [prod-chat]',
                '    parapet_token_ref: ENV:PARAPET_SERVICE_PROD_TOKEN',
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Other Use Cases</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Learn about <Link to="/use-cases/cost-control-startups" className="underline">cost control for startups</Link>, <Link to="/use-cases/saas-integration" className="underline">SaaS product integration</Link>, or <Link to="/use-cases/multi-cloud-llm" className="underline">managing multi-cloud LLM APIs</Link> with ParapetAI.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Get Started</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Ready to protect your development workflow? Start with the <Link to="/docs/quickstart" className="underline">Quickstart guide</Link> or review the <Link to="/docs/config" className="underline">Configuration reference</Link> for local provider setup.
          </p>
        </section>

        <FAQ items={faqItems} />
      </div>
    </>
  );
};

export default UseCaseDevelopment;

