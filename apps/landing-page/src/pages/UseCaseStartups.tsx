import type { FC } from 'react';
import SEO from '../components/seo/SEO';
import FAQ from '../components/docs/FAQ';
import CodeSnippet from '../components/ui/CodeSnippet';
import { Link } from 'react-router-dom';
import { DollarSign, TrendingDown, AlertTriangle, BarChart3 } from 'lucide-react';

const UseCaseStartups: FC = () => {
  const faqItems = [
    {
      question: 'How does ParapetAI help startups control LLM costs?',
      answer: 'ParapetAI enforces hard budget caps per tenant and per route. Costs are estimated before requests, reserved, and settled after completion. Once a daily cap is reached, requests are blocked to prevent overruns.',
    },
    {
      question: 'What happens when a budget cap is reached?',
      answer: 'When a daily budget cap is reached, ParapetAI blocks further requests for that tenant or route. You receive webhook notifications about budget violations, and the system prevents any additional spending until the next day.',
    },
    {
      question: 'How do I track costs across my application?',
      answer: 'ParapetAI stores all telemetry in SQLite with detailed cost information. Each request includes estimated and final costs, token counts, and budget status. You can query the database or set up webhooks for real-time cost tracking.',
    },
    {
      question: 'Can I set different budgets for different features?',
      answer: 'Yes, define multiple routes with different budget_daily_usd values. Each route can have its own spending cap, allowing you to allocate budgets per feature or team. Services can access specific routes based on your configuration.',
    },
    {
      question: 'How accurate is the cost estimation?',
      answer: 'ParapetAI uses deterministic pricing models to estimate costs before requests. Estimates are based on token counts and model pricing. After completion, costs are finalized with actual usage data for accurate accounting.',
    },
  ];

  return (
    <>
      <SEO
        title="Cost Control for Startups - ParapetAI"
        description="Prevent budget overruns and track LLM costs for startups and small teams. Simple setup with hard budget caps, cost visibility, and spending controls."
        keywords="startup LLM costs, AI budget control, LLM cost tracking, startup AI gateway, prevent AI overruns, small team LLM management"
        canonical="https://parapetai.com/use-cases/cost-control-startups"
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">Cost Control for Startups & Small Teams</h1>
          <div className="mt-6 rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <p className="text-base leading-7 text-text">
              <strong>How do I prevent LLM costs from spiraling out of control?</strong> ParapetAI provides hard budget caps that block requests when limits are reached. Set daily budgets per route or tenant, track costs in real-time, and prevent expensive mistakes. Simple setup, no enterprise complexity.
            </p>
          </div>
        </header>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">The Challenge</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Startups and small teams building AI features face unpredictable costs. A single bug or runaway loop can result in thousands of dollars in LLM API charges. Without proper controls, teams risk budget overruns that can derail product development.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted list-disc list-inside">
            <li>No visibility into LLM spending until the monthly bill arrives</li>
            <li>Runaway costs from bugs, loops, or misconfigured retries</li>
            <li>Difficulty allocating budgets across different features or teams</li>
            <li>No way to prevent expensive mistakes before they happen</li>
            <li>Complex enterprise solutions that are overkill for small teams</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">How ParapetAI Solves It</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Hard Budget Caps</h3>
              </div>
              <p className="text-sm text-muted">
                Set daily spend limits per tenant and per route. ParapetAI estimates costs before requests, reserves budget, and blocks requests when caps are reached. No surprises, no overruns.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Cost Visibility</h3>
              </div>
              <p className="text-sm text-muted">
                Track every request with estimated and final costs stored in SQLite. Set up webhooks for real-time cost alerts. Complete transparency into where your LLM budget is going.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Prevent Mistakes</h3>
              </div>
              <p className="text-sm text-muted">
                Token limits prevent accidentally sending huge payloads. Drift detection catches model mismatches. Budget caps stop runaway loops before they drain your account.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Simple Setup</h3>
              </div>
              <p className="text-sm text-muted">
                No enterprise complexity. Define your config, build the bootstrap, run the container. Get budget controls and cost tracking in minutes, not weeks.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Implementation Example</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Configure budget caps for different features with per-route spending limits:
          </p>
          <div className="mt-6">
            <CodeSnippet
              title="Startup budget control configuration"
              lines={[
                'version: 1',
                '',
                'tenants:',
                '  - name: startup',
                '    spend:',
                '      daily_usd_cap: 100',
                '',
                'routes:',
                '  - name: chat-feature',
                '    tenant: startup',
                '    provider:',
                '      type: openai',
                '      model: gpt-4o-mini',
                '      endpoint: https://api.openai.com/v1',
                '      provider_key_ref: ENV:OPENAI_API_KEY',
                '    policy:',
                '      max_tokens_in: 2000',
                '      max_tokens_out: 1000',
                '      budget_daily_usd: 50',
                '',
                '  - name: embeddings-feature',
                '    tenant: startup',
                '    provider:',
                '      type: openai',
                '      model: text-embedding-3-small',
                '      endpoint_type: embeddings',
                '      endpoint: https://api.openai.com/v1',
                '      provider_key_ref: ENV:OPENAI_API_KEY',
                '    policy:',
                '      budget_daily_usd: 30',
                '',
                'services:',
                '  - label: myapp',
                '    tenant: startup',
                '    allowed_routes: [chat-feature, embeddings-feature]',
                '    parapet_token_ref: ENV:PARAPET_SERVICE_MYAPP_TOKEN',
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Other Use Cases</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Learn about <Link to="/use-cases/saas-integration" className="underline">SaaS product integration</Link>, <Link to="/use-cases/development-testing" className="underline">development and testing workflows</Link>, or <Link to="/use-cases/enterprise-governance" className="underline">enterprise AI governance</Link> with ParapetAI.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Get Started</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Ready to control your LLM costs? Start with the <Link to="/docs/quickstart" className="underline">Quickstart guide</Link> or review the <Link to="/docs/config" className="underline">Configuration reference</Link> for budget settings.
          </p>
        </section>

        <FAQ items={faqItems} />
      </div>
    </>
  );
};

export default UseCaseStartups;

