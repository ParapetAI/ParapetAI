import type { FC } from 'react';
import CodeSnippet from '../components/ui/CodeSnippet';
import SEO from '../components/seo/SEO';
import FAQ from '../components/docs/FAQ';
import { Link } from 'react-router-dom';
import ToggleExamples from '../components/docs/ToggleExamples';

const DocsQuickstart: FC = () => {
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to set up ParapetAI',
    description: 'Step-by-step guide to running ParapetAI locally with Docker',
    step: [
      {
        '@type': 'HowToStep',
        name: 'Create configuration file',
        text: 'Create a parapet.yaml file with tenants, routes, and services',
      },
      {
        '@type': 'HowToStep',
        name: 'Build encrypted config',
        text: 'Use the CLI to validate and encrypt the configuration into a bootstrap file',
      },
      {
        '@type': 'HowToStep',
        name: 'Run container',
        text: 'Pull and run the ParapetAI runtime container with the encrypted bootstrap',
      },
    ],
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://parapetai.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Documentation',
        item: 'https://parapetai.com/docs',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Quickstart',
        item: 'https://parapetai.com/docs/quickstart',
      },
    ],
  };

  const faqItems = [
    {
      question: 'How do I get started with ParapetAI?',
      answer: 'Create a parapet.yaml configuration file, use the CLI to build an encrypted bootstrap, then run the Docker container. Point your OpenAI client to the container endpoint using your service token.',
    },
    {
      question: 'What do I need to run ParapetAI?',
      answer: 'You need Docker installed and a parapet.yaml configuration file. The CLI is available via npx, so no local installation is required. You will also need API keys for your LLM providers.',
    },
    {
      question: 'How long does setup take?',
      answer: 'Setup takes about 60 seconds. Create the YAML file, run the CLI build command, pull the Docker image, and start the container. Your OpenAI-compatible endpoints will be available immediately.',
    },
    {
      question: 'Can I use ParapetAI with my existing OpenAI client?',
      answer: 'Yes, ParapetAI is fully OpenAI-compatible. Simply change the base URL to point to your ParapetAI instance and use your service token instead of your OpenAI API key.',
    },
    {
      question: 'How do I test if ParapetAI is working?',
      answer: 'Use curl or your OpenAI client to send a request to /v1/chat/completions with your service token. Check the /health endpoint to verify the runtime is running correctly.',
    },
  ];

  return (
    <>
      <SEO
        title="Quickstart Guide - ParapetAI"
        description="Get started with ParapetAI in 60 seconds. Learn how to create a configuration file, build an encrypted bootstrap, and run the Docker container with OpenAI-compatible endpoints."
        keywords="ParapetAI quickstart, LLM gateway setup, self-hosted AI gateway installation, OpenAI compatible gateway setup, how to set up LLM gateway"
        canonical="https://parapetai.com/docs/quickstart"
        structuredData={[howToSchema, breadcrumbSchema]}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">Get Started in 60 Seconds</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            Pull and run the ParapetAI runtime container, then point your app to its OpenAI‑compatible endpoints.
          </p>
        </header>

      <section className="mt-8">
        <CodeSnippet
          title="1) Create a parapet.yaml file"
          lines={[
            'version: 1',
            '',
            'tenants:',
            '  - name: acme',
            '    spend:',
            '      daily_usd_cap: 50',
            '',
            'routes:',
            '  - name: acme-chat',
            '    tenant: acme',
            '    provider:',
            '      type: openai',
            '      model: gpt-4o-mini',
            '      endpoint: https://api.openai.com/v1',
            '      provider_key_ref: ENV:OPENAI_API_KEY',
            '      endpoint_type: chat_completions',
            '',
            'services:',
            '  - label: myapp',
            '    tenant: acme',
            '    allowed_routes: [acme-chat]',
            '    parapet_token_ref: ENV:PARAPET_SERVICE_MYAPP_TOKEN',
          ]}
        />
      </section>

      <section className="mt-6">
        <CodeSnippet
          title="2) Build encrypted config (.env) with the CLI"
          lines={[
            '# Generate the encrypted bootstrap (.env) from parapet.yaml',
            'npx @parapetai/cli@latest build-config --file parapet.yaml --non-interactive --out .env'
          ]}
        />
      </section>

      <section className="mt-6">
        <CodeSnippet
          title="3) Pull & run the runtime container"
          lines={[
            'docker pull parapetai/parapetai-runtime:latest',
            'docker run -p 8000:8000 -v parapet-data:/data --env-file .env parapetai/parapetai-runtime:latest'
          ]}
        />
      </section>

      {/* 4) Single call example with toggles (chat completions only) */}
      <section className="mt-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl font-medium text-text">Call chat completions</span>
        </div>
        <div className="mb-4 text-sm text-muted">
          Example requests for how to call the chat completions endpoint in your code:
        </div>
        <ToggleExamples />
      </section>

      <section className="mt-6">
        <p className="text-sm text-muted">
          Need more options? See the <Link to="/docs/config" className="underline">Configuration</Link> page.
        </p>
      </section>

      <FAQ items={faqItems} />
    </div>
    </>
  );
};

export default DocsQuickstart;



