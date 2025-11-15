import type { FC } from 'react';
import SEO from '../components/seo/SEO';
import FAQ from '../components/docs/FAQ';
import CodeSnippet from '../components/ui/CodeSnippet';
import { Link } from 'react-router-dom';
import { Workflow, Shuffle, PlugZap, Layers } from 'lucide-react';

const UseCaseMultiCloud: FC = () => {
  const faqItems = [
    {
      question: 'How do I manage multiple LLM providers with ParapetAI?',
      answer: 'Define multiple routes in your configuration, each pointing to different providers (OpenAI, local LLMs, or other OpenAI-compatible APIs). Services can access specific routes, and ParapetAI handles routing based on the model parameter.',
    },
    {
      question: 'Can I use ParapetAI to route between different cloud providers?',
      answer: 'Yes, configure routes for different providers like OpenAI, Anthropic (via compatible endpoints), or local LLMs. ParapetAI acts as a unified gateway, allowing you to swap providers without changing your application code.',
    },
    {
      question: 'How do I load balance across multiple LLM providers?',
      answer: 'Define multiple routes with the same model name but different providers. Your application can call any route, and ParapetAI will route to the configured provider. You can implement load balancing logic in your application layer.',
    },
    {
      question: 'Can I use local LLMs alongside cloud providers?',
      answer: 'Yes, ParapetAI supports both OpenAI and local provider types. Configure local routes pointing to your self-hosted LLM endpoints. The same policies, budgets, and redaction rules apply to all providers.',
    },
    {
      question: 'How do I migrate from one provider to another?',
      answer: 'Update your route configuration to point to the new provider endpoint. Since ParapetAI uses OpenAI-compatible APIs, your application code doesn\'t need to change. Just update the route and rebuild the configuration.',
    },
  ];

  return (
    <>
      <SEO
        title="Managing Multi-Cloud LLM APIs - ParapetAI"
        description="Unified LLM gateway for managing multiple cloud providers and local LLMs. Route requests across OpenAI, local models, and other providers with consistent policies and budgets."
        keywords="multi-cloud LLM, LLM provider routing, OpenAI compatible gateway, local LLM gateway, multi-provider AI gateway, LLM load balancing"
        canonical="https://parapetai.com/use-cases/multi-cloud-llm"
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">Managing Multi-Cloud LLM APIs</h1>
          <div className="mt-6 rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
            <p className="text-base leading-7 text-text">
              <strong>How do I manage requests to multiple LLM providers?</strong> ParapetAI acts as a unified gateway for multiple LLM providers. Define routes for OpenAI, local LLMs, or any OpenAI-compatible API. Your application uses a single endpoint while ParapetAI routes to the configured provider based on the model parameter. Swap providers without changing application code.
            </p>
          </div>
        </header>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">The Challenge</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Modern applications often need to work with multiple LLM providers for redundancy, cost optimization, or feature availability. Managing different APIs, authentication methods, and provider-specific quirks adds complexity and vendor lock-in.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted list-disc list-inside">
            <li>Different API formats and authentication for each provider</li>
            <li>Vendor lock-in makes it difficult to switch providers</li>
            <li>No unified policy enforcement across providers</li>
            <li>Complex routing logic scattered across application code</li>
            <li>Inconsistent error handling and retry logic</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">How ParapetAI Solves It</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Workflow className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Unified API</h3>
              </div>
              <p className="text-sm text-muted">
                Single OpenAI-compatible endpoint for all providers. Your application code doesn't change when switching providers. ParapetAI handles routing based on route configuration.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Shuffle className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Provider Abstraction</h3>
              </div>
              <p className="text-sm text-muted">
                Support for OpenAI and local providers with the same interface. Easily add new providers by configuring new routes. No code changes required.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <PlugZap className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Consistent Policies</h3>
              </div>
              <p className="text-sm text-muted">
                Same budget controls, redaction rules, and drift detection across all providers. Enforce policies uniformly regardless of which provider handles the request.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Easy Migration</h3>
              </div>
              <p className="text-sm text-muted">
                Switch providers by updating route configuration. Test new providers alongside existing ones. Migrate gradually without application downtime.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Implementation Example</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Configure routes for multiple providers with the same model interface:
          </p>
          <div className="mt-6">
            <CodeSnippet
              title="Multi-provider configuration example"
              lines={[
                'version: 1',
                '',
                'tenants:',
                '  - name: acme',
                '    spend:',
                '      daily_usd_cap: 1000',
                '',
                'routes:',
                '  - name: openai-gpt4',
                '    tenant: acme',
                '    provider:',
                '      type: openai',
                '      model: gpt-4o-mini',
                '      endpoint: https://api.openai.com/v1',
                '      provider_key_ref: ENV:OPENAI_API_KEY',
                '',
                '  - name: local-llama',
                '    tenant: acme',
                '    provider:',
                '      type: local',
                '      model: llama-3-8b',
                '      endpoint: http://local-llm:8000/v1',
                '',
                '  - name: anthropic-claude',
                '    tenant: acme',
                '    provider:',
                '      type: openai',
                '      model: claude-3-haiku',
                '      endpoint: https://api.anthropic.com/v1',
                '      provider_key_ref: ENV:ANTHROPIC_API_KEY',
                '',
                'services:',
                '  - label: myapp',
                '    tenant: acme',
                '    allowed_routes: [openai-gpt4, local-llama, anthropic-claude]',
                '    parapet_token_ref: ENV:PARAPET_SERVICE_MYAPP_TOKEN',
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Other Use Cases</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Learn about <Link to="/use-cases/enterprise-governance" className="underline">AI governance for enterprises</Link>, <Link to="/use-cases/development-testing" className="underline">development and testing workflows</Link>, <Link to="/use-cases/saas-integration" className="underline">SaaS product integration</Link>, or <Link to="/use-cases/cost-control-startups" className="underline">cost control for startups</Link> with ParapetAI.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Get Started</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Ready to unify your LLM provider management? Start with the <Link to="/docs/quickstart" className="underline">Quickstart guide</Link> or review the <Link to="/docs/config" className="underline">Configuration reference</Link> for provider setup.
          </p>
        </section>

        <FAQ items={faqItems} />
      </div>
    </>
  );
};

export default UseCaseMultiCloud;

