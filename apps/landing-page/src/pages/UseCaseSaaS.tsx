import type { FC } from 'react';
import SEO from '../components/seo/SEO';
import FAQ from '../components/docs/FAQ';
import CodeSnippet from '../components/ui/CodeSnippet';
import { Link } from 'react-router-dom';
import { Users, Key, Building2, Wallet } from 'lucide-react';

const UseCaseSaaS: FC = () => {
  const faqItems = [
    {
      question: 'How does ParapetAI support multi-tenant SaaS architectures?',
      answer: 'ParapetAI uses a tenant-based model where each customer is a tenant with their own budget caps. Services map to tenants and routes, allowing you to isolate customer spending and enforce per-customer limits.',
    },
    {
      question: 'Can I set different budgets for each customer?',
      answer: 'Yes, define each customer as a separate tenant with their own daily_usd_cap. You can also set per-route budgets within each tenant to allocate spending across different features or tiers.',
    },
    {
      question: 'How do I manage service tokens for multiple customers?',
      answer: 'Each service gets its own parapet_token_ref. Generate unique tokens for each customer or application. Services are scoped to specific tenants and allowed_routes, ensuring proper isolation.',
    },
    {
      question: 'What happens when a customer exceeds their budget?',
      answer: 'When a customer\'s daily budget cap is reached, ParapetAI blocks further requests for that tenant. You can configure webhooks to notify your system when budgets are exhausted, allowing you to handle upgrades or notifications.',
    },
    {
      question: 'Can I track costs per customer for billing?',
      answer: 'Yes, ParapetAI stores all telemetry with tenant information. Query the SQLite database or set up webhooks to track costs per customer. Each request includes tenant, route, and cost data for accurate billing.',
    },
    {
      question: 'How do I handle different customer tiers or plans?',
      answer: 'Configure different routes with varying budget_daily_usd values. Assign customers to routes based on their tier. Free tier customers get lower budgets, premium customers get higher limits, all enforced automatically.',
    },
  ];

  return (
    <>
      <SEO
        title="SaaS Product Integration - ParapetAI"
        description="Multi-tenant LLM gateway for SaaS products. Per-customer budgets, tenant isolation, and service token management for companies offering AI features to their customers."
        keywords="SaaS LLM gateway, multi-tenant AI, per-customer AI budgets, SaaS AI integration, tenant isolation LLM, customer AI spending control"
        canonical="https://parapetai.com/use-cases/saas-integration"
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">SaaS Product Integration</h1>
          <div className="mt-6 rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <p className="text-base leading-7 text-text">
              <strong>How do I offer AI features to my customers with per-customer budgets?</strong> ParapetAI provides multi-tenant architecture where each customer is a tenant with isolated budgets and routes. Generate unique service tokens per customer, enforce spending caps, and track costs for accurate billing. Perfect for SaaS companies building AI-powered features.
            </p>
          </div>
        </header>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">The Challenge</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            SaaS companies adding AI features need to manage costs per customer, enforce usage limits based on subscription tiers, and track spending for billing. Without proper controls, one customer can consume your entire LLM budget, or costs can spiral beyond what customers pay.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted list-disc list-inside">
            <li>No way to isolate spending per customer or account</li>
            <li>Difficulty enforcing usage limits based on subscription tiers</li>
            <li>Complex billing when LLM costs vary per customer</li>
            <li>Risk of one customer consuming entire budget allocation</li>
            <li>Need to generate and manage unique API keys per customer</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">How ParapetAI Solves It</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Multi-Tenant Isolation</h3>
              </div>
              <p className="text-sm text-muted">
                Each customer is a tenant with isolated budgets and routes. Services map to tenants, ensuring complete spending isolation. One customer cannot affect another's budget or access.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Per-Customer Budgets</h3>
              </div>
              <p className="text-sm text-muted">
                Set daily spend caps per tenant (customer). Configure per-route budgets to allocate spending across features. Enforce tier-based limits automatically based on subscription plans.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Key className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Service Token Management</h3>
              </div>
              <p className="text-sm text-muted">
                Generate unique service tokens per customer or application. Each token is scoped to specific tenants and routes. Revoke access by removing services from configuration.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Billing Integration</h3>
              </div>
              <p className="text-sm text-muted">
                Track costs per tenant with detailed telemetry. Query SQLite or use webhooks to integrate with billing systems. Accurate cost attribution for each customer enables proper pricing.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Implementation Example</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Configure multiple customers as tenants with tier-based routes and budgets:
          </p>
          <div className="mt-6">
            <CodeSnippet
              title="SaaS multi-tenant configuration"
              lines={[
                'version: 1',
                '',
                'tenants:',
                '  - name: customer-premium',
                '    spend:',
                '      daily_usd_cap: 500',
                '  - name: customer-free',
                '    spend:',
                '      daily_usd_cap: 10',
                '',
                'routes:',
                '  - name: premium-chat',
                '    tenant: customer-premium',
                '    provider:',
                '      type: openai',
                '      model: gpt-4o',
                '      endpoint: https://api.openai.com/v1',
                '      provider_key_ref: ENV:OPENAI_API_KEY',
                '    policy:',
                '      budget_daily_usd: 500',
                '      max_tokens_out: 4000',
                '',
                '  - name: free-chat',
                '    tenant: customer-free',
                '    provider:',
                '      type: openai',
                '      model: gpt-4o-mini',
                '      endpoint: https://api.openai.com/v1',
                '      provider_key_ref: ENV:OPENAI_API_KEY',
                '    policy:',
                '      budget_daily_usd: 10',
                '      max_tokens_out: 500',
                '',
                'services:',
                '  - label: premium-app',
                '    tenant: customer-premium',
                '    allowed_routes: [premium-chat]',
                '    parapet_token_ref: ENV:PARAPET_SERVICE_PREMIUM_TOKEN',
                '',
                '  - label: free-app',
                '    tenant: customer-free',
                '    allowed_routes: [free-chat]',
                '    parapet_token_ref: ENV:PARAPET_SERVICE_FREE_TOKEN',
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Other Use Cases</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Learn about <Link to="/use-cases/cost-control-startups" className="underline">cost control for startups</Link>, <Link to="/use-cases/development-testing" className="underline">development and testing workflows</Link>, or <Link to="/use-cases/enterprise-governance" className="underline">enterprise AI governance</Link> with ParapetAI.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Get Started</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Ready to add AI features to your SaaS product? Start with the <Link to="/docs/quickstart" className="underline">Quickstart guide</Link> or review the <Link to="/docs/config" className="underline">Configuration reference</Link> for multi-tenant setup.
          </p>
        </section>

        <FAQ items={faqItems} />
      </div>
    </>
  );
};

export default UseCaseSaaS;

