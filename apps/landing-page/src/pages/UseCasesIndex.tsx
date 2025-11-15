import type { FC } from 'react';
import SEO from '../components/seo/SEO';
import { Link } from 'react-router-dom';
import { Shield, Workflow, DollarSign, Users, Code, Lock } from 'lucide-react';

const UseCasesIndex: FC = () => {
  return (
    <>
      <SEO
        title="Use Cases - ParapetAI"
        description="Explore use cases for ParapetAI including enterprise AI governance and multi-cloud LLM management. Learn how to implement policy enforcement, budget controls, and provider routing."
        keywords="LLM gateway use cases, enterprise AI governance, multi-cloud LLM, AI policy management, LLM provider routing"
        canonical="https://parapetai.com/use-cases"
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">Use Cases</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            Explore how ParapetAI solves real-world challenges for enterprises and teams managing LLM infrastructure.
          </p>
        </header>

        <section className="mt-12 grid gap-6 sm:grid-cols-2">
          <Link
            to="/use-cases/enterprise-governance"
            className="block rounded-none border-[3px] border-border bg-surface p-6 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-accent" />
              <h2 className="text-xl font-semibold text-text">AI Governance for Enterprises</h2>
            </div>
            <p className="text-sm text-muted">
              Implement comprehensive AI governance with policy enforcement, budget controls, data redaction, and compliance features. Perfect for enterprises needing audit trails and data sovereignty.
            </p>
          </Link>

          <Link
            to="/use-cases/multi-cloud-llm"
            className="block rounded-none border-[3px] border-border bg-surface p-6 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <Workflow className="h-6 w-6 text-accent" />
              <h2 className="text-xl font-semibold text-text">Managing Multi-Cloud LLM APIs</h2>
            </div>
            <p className="text-sm text-muted">
              Unify multiple LLM providers under a single gateway. Route requests across OpenAI, local LLMs, and other providers with consistent policies and budgets.
            </p>
          </Link>

          <Link
            to="/use-cases/cost-control-startups"
            className="block rounded-none border-[3px] border-border bg-surface p-6 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="h-6 w-6 text-accent" />
              <h2 className="text-xl font-semibold text-text">Cost Control for Startups</h2>
            </div>
            <p className="text-sm text-muted">
              Prevent budget overruns and track LLM costs for startups and small teams. Simple setup with hard budget caps, cost visibility, and spending controls.
            </p>
          </Link>

          <Link
            to="/use-cases/saas-integration"
            className="block rounded-none border-[3px] border-border bg-surface p-6 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-6 w-6 text-accent" />
              <h2 className="text-xl font-semibold text-text">SaaS Product Integration</h2>
            </div>
            <p className="text-sm text-muted">
              Multi-tenant LLM gateway for SaaS products. Per-customer budgets, tenant isolation, and service token management for companies offering AI features to their customers.
            </p>
          </Link>

          <Link
            to="/use-cases/development-testing"
            className="block rounded-none border-[3px] border-border bg-surface p-6 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <Code className="h-6 w-6 text-accent" />
              <h2 className="text-xl font-semibold text-text">Development & Testing</h2>
            </div>
            <p className="text-sm text-muted">
              Prevent expensive mistakes during development. Test with different models, track costs, and use local LLMs with the same policy framework.
            </p>
          </Link>

          <Link
            to="/use-cases/data-privacy-compliance"
            className="block rounded-none border-[3px] border-border bg-surface p-6 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <Lock className="h-6 w-6 text-accent" />
              <h2 className="text-xl font-semibold text-text">Data Privacy & Compliance</h2>
            </div>
            <p className="text-sm text-muted">
              LLM gateway for regulated industries. PII protection, audit trails, signed receipts, and data sovereignty for healthcare, finance, and other compliance-focused organizations.
            </p>
          </Link>
        </section>
      </div>
    </>
  );
};

export default UseCasesIndex;

