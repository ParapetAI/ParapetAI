import type { FC } from 'react';
import CodeSnippet from '../components/ui/CodeSnippet';
import SEO from '../components/seo/SEO';
import FAQ from '../components/docs/FAQ';

const DocsConfig: FC = () => {
  const faqItems = [
    {
      question: 'How do I configure ParapetAI?',
      answer: 'Create a parapet.yaml file with tenants, routes, and services. Use environment variable references (ENV:NAME) for secrets. The CLI validates the schema and encrypts it into a bootstrap file that the runtime reads.',
    },
    {
      question: 'What is the minimum configuration needed?',
      answer: 'You need at least one tenant with a daily spend cap, one route with a provider configuration, and one service with an allowed route. The CLI will guide you through validation.',
    },
    {
      question: 'How do I reference secrets in the configuration?',
      answer: 'Use ENV:VARIABLE_NAME format for provider keys, service tokens, and webhook secrets. The CLI will prompt for missing values or read them from your environment.',
    },
    {
      question: 'Can I use multiple providers?',
      answer: 'Yes, define multiple routes with different provider configurations. Each route can point to different endpoints, models, or provider types (OpenAI or local).',
    },
    {
      question: 'How do I set up policies?',
      answer: 'Add a policy section to your route with max_tokens_in, max_tokens_out, budget_daily_usd, drift_strict, and redaction settings. Policies are enforced per-route.',
    },
    {
      question: 'What parameters are allowed for chat completions?',
      answer: 'ParapetAI supports all standard OpenAI chat completion parameters including model, messages, temperature, max_tokens, stream, and more. See the configuration docs for the complete list.',
    },
  ];

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
        name: 'Configuration',
        item: 'https://parapetai.com/docs/config',
      },
    ],
  };

  return (
    <>
      <SEO
        title="Configuration Reference - ParapetAI"
        description="Complete configuration reference for ParapetAI. Learn the YAML schema, environment variable references, policy options, and all supported parameters for chat completions and embeddings."
        keywords="ParapetAI configuration, LLM gateway config, YAML schema, AI gateway setup, self-hosted LLM gateway configuration"
        canonical="https://parapetai.com/docs/config"
        structuredData={breadcrumbSchema}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">Configuration</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            ParapetAI uses a single YAML file. The CLI validates, hydrates secrets from env references, and outputs an encrypted bootstrap passed to the runtime via environment variables.
          </p>
        </header>

      <section className="mt-8">
        <CodeSnippet
          title="YAML structure (high‑level)"
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
            '      type: openai           # or "local"',
            '      model: gpt-4o-mini',
            '      endpoint: https://api.openai.com/v1   # required for openai and local',
            '      provider_key_ref: ENV:OPENAI_API_KEY  # required for openai only',
            '    # optional:',
            '    # endpoint_type: embeddings              # default: chat_completions',
            '    # policy:',
            '    #   max_tokens_in: 2000                  # required when policy present',
            '    #   max_tokens_out: 2000                 # required when policy present',
            '    #   budget_daily_usd: 10                 # required when policy present',
            '    #   drift_strict: true                   # required when policy present',
            '    #   redaction:',
            '    #     mode: warn                          # required when policy present',
            '    #     patterns: []                        # required when policy present',
            '    # retries:',
            '    #   max_attempts: 3                       # 2..5; if retries present, all fields required',
            '    #   base_ms: 200                          # 100..1000',
            '    #   jitter: true                          # boolean',
            '    #   retry_on: [429, 500, 502, 503, 504]   # allowed values only',
            '    #   max_elapsed_ms: 2000                  # >= base_ms',
            '    # cache:',
            '    #   enabled: true                         # defaults: ttl_ms=30000, max_entries=5000, include_params=true',
            '    # webhook:',
            '    #   url: https://example.com/parapet/webhook  # required when webhook present',
            '    #   secret_ref: ENV:PARAPET_WEBHOOK_SECRET  # required when webhook present',
            '    #   include_prompt_snippet: false          # optional',
            '    #   events:                                # optional',
            '    #     policy_decisions: true                # optional',
            '    #     request_errors: true                  # optional',
            '    #     provider_errors: true                 # optional',
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
          title="Local provider example"
          lines={[
            'routes:',
            '  - name: local-embed',
            '    tenant: acme',
            '    provider:',
            '      type: local',
            '      model: text-embedding-3-small',
            '      endpoint: http://localhost:11434/v1',
            '    # provider_key_ref is not required for local',
          ]}
        />
      </section>

      <section className="mt-6">
        <CodeSnippet
          title="Embeddings route (OpenAI)"
          lines={[
            'routes:',
            '  - name: acme-embeddings',
            '    tenant: acme',
            '    provider:',
            '      type: openai',
            '      model: text-embedding-3-small',
            '      endpoint_type: embeddings',
            '      endpoint: https://api.openai.com/v1',
            '      provider_key_ref: ENV:OPENAI_API_KEY',
          ]}
        />
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-text">Requirements and constraints</h2>
        <div className="mt-4 text-sm space-y-8">
          {/* Schema */}
          <div>
            <h3 className="text-base font-semibold text-text">Schema</h3>
            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/10">
              <table className="min-w-full text-left">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text">Key</th>
                    <th className="px-4 py-2 font-medium text-text">Purpose</th>
                    <th className="px-4 py-2 font-medium text-text">Values / Constraints</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>version</code></td>
                    <td className="px-4 py-3 text-muted">Schema version</td>
                    <td className="px-4 py-3 text-muted">Number. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>tenants[]</code></td>
                    <td className="px-4 py-3 text-muted">Tenant definitions</td>
                    <td className="px-4 py-3 text-muted">Array. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>routes[]</code></td>
                    <td className="px-4 py-3 text-muted">Routing and provider binding</td>
                    <td className="px-4 py-3 text-muted">Array. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>services[]</code></td>
                    <td className="px-4 py-3 text-muted">Service access control</td>
                    <td className="px-4 py-3 text-muted">Array. Required.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tenants */}
          <div>
            <h3 className="text-base font-semibold text-text">Tenants</h3>
            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/10">
              <table className="min-w-full text-left">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text">Field</th>
                    <th className="px-4 py-2 font-medium text-text">Description</th>
                    <th className="px-4 py-2 font-medium text-text">Constraints</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>name</code></td>
                    <td className="px-4 py-3 text-muted">Tenant identifier</td>
                    <td className="px-4 py-3 text-muted">String. Unique. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>spend.daily_usd_cap</code></td>
                    <td className="px-4 py-3 text-muted">Daily spend cap</td>
                    <td className="px-4 py-3 text-muted">Number. ≥ 0. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>notes</code></td>
                    <td className="px-4 py-3 text-muted">Free-form notes</td>
                    <td className="px-4 py-3 text-muted">String. Optional.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Routes */}
          <div>
            <h3 className="text-base font-semibold text-text">Routes</h3>
            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/10">
              <table className="min-w-full text-left">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text">Field</th>
                    <th className="px-4 py-2 font-medium text-text">Description</th>
                    <th className="px-4 py-2 font-medium text-text">Constraints</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>name</code></td>
                    <td className="px-4 py-3 text-muted">Route identifier</td>
                    <td className="px-4 py-3 text-muted">String. Unique. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>tenant</code></td>
                    <td className="px-4 py-3 text-muted">Associated tenant</td>
                    <td className="px-4 py-3 text-muted">Must reference an existing tenant <code>name</code>. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>provider.endpoint_type</code></td>
                    <td className="px-4 py-3 text-muted">API endpoint binding</td>
                    <td className="px-4 py-3 text-muted"><code>chat_completions</code> (default) or <code>embeddings</code>. A route bound to one cannot call the other.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Provider */}
          <div>
            <h3 className="text-base font-semibold text-text">Provider</h3>
            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/10">
              <table className="min-w-full text-left">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text">Field</th>
                    <th className="px-4 py-2 font-medium text-text">Description</th>
                    <th className="px-4 py-2 font-medium text-text">Constraints</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>type</code></td>
                    <td className="px-4 py-3 text-muted">Provider selection</td>
                    <td className="px-4 py-3 text-muted"><code>openai</code> | <code>local</code>. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>model</code></td>
                    <td className="px-4 py-3 text-muted">Model identifier</td>
                    <td className="px-4 py-3 text-muted">String. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>endpoint</code></td>
                    <td className="px-4 py-3 text-muted">HTTP base URL</td>
                    <td className="px-4 py-3 text-muted">Required for <code>openai</code> and <code>local</code>.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>provider_key_ref</code></td>
                    <td className="px-4 py-3 text-muted">Secret reference for provider API key</td>
                    <td className="px-4 py-3 text-muted">Required when <code>type = openai</code>. Not required for <code>local</code>.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>default_params</code></td>
                    <td className="px-4 py-3 text-muted">Route-level parameter defaults</td>
                    <td className="px-4 py-3 text-muted">Object. Keys must be allowed for the bound endpoint type.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Policy */}
          <div>
            <h3 className="text-base font-semibold text-text">Policy</h3>
            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/10">
              <table className="min-w-full text-left">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text">Field</th>
                    <th className="px-4 py-2 font-medium text-text">Description</th>
                    <th className="px-4 py-2 font-medium text-text">Constraints</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>max_tokens_in</code></td>
                    <td className="px-4 py-3 text-muted">Max input tokens</td>
                    <td className="px-4 py-3 text-muted">Number. ≥ 0. Required when policy present.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>max_tokens_out</code></td>
                    <td className="px-4 py-3 text-muted">Max output tokens</td>
                    <td className="px-4 py-3 text-muted">Number. ≥ 0. Required when policy present.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>budget_daily_usd</code></td>
                    <td className="px-4 py-3 text-muted">Daily route budget</td>
                    <td className="px-4 py-3 text-muted">Number. ≥ 0. Required when policy present.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>drift_strict</code></td>
                    <td className="px-4 py-3 text-muted">Strict drift control toggle</td>
                    <td className="px-4 py-3 text-muted">Boolean. Required when policy present.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>drift_detection.enabled</code></td>
                    <td className="px-4 py-3 text-muted">Enable drift detection</td>
                    <td className="px-4 py-3 text-muted">Boolean. Defaults to <code>drift_strict</code> when omitted.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>drift_detection.sensitivity</code></td>
                    <td className="px-4 py-3 text-muted">Sensitivity level</td>
                    <td className="px-4 py-3 text-muted"><code>low</code> | <code>medium</code> | <code>high</code>. Default: <code>medium</code>.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>drift_detection.cost_anomaly_threshold</code></td>
                    <td className="px-4 py-3 text-muted">Cost anomaly threshold</td>
                    <td className="px-4 py-3 text-muted">Number in [0, 1]. Optional. Defaults based on sensitivity.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>redaction.mode</code></td>
                    <td className="px-4 py-3 text-muted">Action when sensitive data detected</td>
                    <td className="px-4 py-3 text-muted"><code>warn</code> (scrub), <code>block</code> (reject), <code>off</code> (disabled). Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3 align-top"><code>redaction.patterns[]</code></td>
                    <td className="px-4 py-3 text-muted">Built-ins and/or custom patterns</td>
                    <td className="px-4 py-3 text-muted">Array. Required. See pattern rules below.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/10">
              <table className="min-w-full text-left">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text">Redaction patterns</th>
                    <th className="px-4 py-2 font-medium text-text">Meaning</th>
                    <th className="px-4 py-2 font-medium text-text">Notes</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>email</code> | <code>api_key</code> | <code>ip</code> | <code>phone</code></td>
                    <td className="px-4 py-3 text-muted">Enable built-in detectors</td>
                    <td className="px-4 py-3 text-muted">Shortcuts for common PII/secrets.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>re:...</code></td>
                    <td className="px-4 py-3 text-muted">Custom RegExp body</td>
                    <td className="px-4 py-3 text-muted">Compiled with <code>gi</code> flags.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>/pattern/flags</code></td>
                    <td className="px-4 py-3 text-muted">Slash regex syntax</td>
                    <td className="px-4 py-3 text-muted">Example: <code>/secret\d+/i</code>.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3">Literal text</td>
                    <td className="px-4 py-3 text-muted">Escaped and matched as substring</td>
                    <td className="px-4 py-3 text-muted">Case-insensitive.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Retries */}
          <div>
            <h3 className="text-base font-semibold text-text">Retries</h3>
            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/10">
              <table className="min-w-full text-left">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text">Field</th>
                    <th className="px-4 py-2 font-medium text-text">Description</th>
                    <th className="px-4 py-2 font-medium text-text">Constraints</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>max_attempts</code></td>
                    <td className="px-4 py-3 text-muted">Maximum attempts</td>
                    <td className="px-4 py-3 text-muted">Number 2..5. Required when retries present.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>base_ms</code></td>
                    <td className="px-4 py-3 text-muted">Base backoff (ms)</td>
                    <td className="px-4 py-3 text-muted">Number 100..1000. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>jitter</code></td>
                    <td className="px-4 py-3 text-muted">Full jitter toggle</td>
                    <td className="px-4 py-3 text-muted">Boolean. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>retry_on[]</code></td>
                    <td className="px-4 py-3 text-muted">Retryable HTTP statuses</td>
                    <td className="px-4 py-3 text-muted">Subset of <code>[429, 500, 502, 503, 504]</code>. Non-empty. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>max_elapsed_ms</code></td>
                    <td className="px-4 py-3 text-muted">Max total backoff time</td>
                    <td className="px-4 py-3 text-muted">Number. ≥ <code>base_ms</code>. Required.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Cache */}
          <div>
            <h3 className="text-base font-semibold text-text">Cache</h3>
            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/10">
              <table className="min-w-full text-left">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text">Field</th>
                    <th className="px-4 py-2 font-medium text-text">Description</th>
                    <th className="px-4 py-2 font-medium text-text">Constraints</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>enabled</code></td>
                    <td className="px-4 py-3 text-muted">Enable response caching</td>
                    <td className="px-4 py-3 text-muted">Boolean. Optional.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>mode</code></td>
                    <td className="px-4 py-3 text-muted">Cache matching mode</td>
                    <td className="px-4 py-3 text-muted">When set, must be <code>exact</code>.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>ttl_ms</code></td>
                    <td className="px-4 py-3 text-muted">Time-to-live</td>
                    <td className="px-4 py-3 text-muted">Number ≥ 0. Default: <code>30000</code>.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>max_entries</code></td>
                    <td className="px-4 py-3 text-muted">Max cache entries</td>
                    <td className="px-4 py-3 text-muted">Positive integer. Default: <code>5000</code>.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>include_params</code></td>
                    <td className="px-4 py-3 text-muted">Include params in cache key</td>
                    <td className="px-4 py-3 text-muted">Boolean. Default: <code>true</code>.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Webhook */}
          <div>
            <h3 className="text-base font-semibold text-text">Webhook</h3>
            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/10">
              <table className="min-w-full text-left">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text">Field</th>
                    <th className="px-4 py-2 font-medium text-text">Description</th>
                    <th className="px-4 py-2 font-medium text-text">Constraints</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>url</code></td>
                    <td className="px-4 py-3 text-muted">Receiver endpoint</td>
                    <td className="px-4 py-3 text-muted">String. Required when webhook present.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>secret_ref</code></td>
                    <td className="px-4 py-3 text-muted">Secret for signing</td>
                    <td className="px-4 py-3 text-muted">String env ref. Required when webhook present.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>include_prompt_snippet</code></td>
                    <td className="px-4 py-3 text-muted">Include prompt snippet</td>
                    <td className="px-4 py-3 text-muted">Boolean. Optional.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>events.policy_decisions</code></td>
                    <td className="px-4 py-3 text-muted">Emit policy decisions</td>
                    <td className="px-4 py-3 text-muted">Boolean. Optional.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>events.request_errors</code></td>
                    <td className="px-4 py-3 text-muted">Emit request errors</td>
                    <td className="px-4 py-3 text-muted">Boolean. Optional.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>events.provider_errors</code></td>
                    <td className="px-4 py-3 text-muted">Emit provider errors</td>
                    <td className="px-4 py-3 text-muted">Boolean. Optional.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-base font-semibold text-text">Services</h3>
            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/10">
              <table className="min-w-full text-left">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text">Field</th>
                    <th className="px-4 py-2 font-medium text-text">Description</th>
                    <th className="px-4 py-2 font-medium text-text">Constraints</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>label</code></td>
                    <td className="px-4 py-3 text-muted">Service/client label</td>
                    <td className="px-4 py-3 text-muted">String. Unique. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>tenant</code></td>
                    <td className="px-4 py-3 text-muted">Associated tenant</td>
                    <td className="px-4 py-3 text-muted">Must reference an existing tenant <code>name</code>. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>allowed_routes[]</code></td>
                    <td className="px-4 py-3 text-muted">Permitted route names</td>
                    <td className="px-4 py-3 text-muted">Each entry must reference an existing route <code>name</code>. Required.</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>parapet_token_ref</code></td>
                    <td className="px-4 py-3 text-muted">Service token reference</td>
                    <td className="px-4 py-3 text-muted">String env ref. Required.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-text">Environment references & secrets</h2>
        <p className="mt-3 text-sm text-muted pb-2">
          Secrets can be referenced as <code>ENV:NAME</code>. If you provide a plain suffix like <code>openai_api_key_ref</code>, the CLI will try <code>OPENAI_API_KEY</code> and <code>PARAPET_OPENAI_API_KEY</code> from the environment. Service tokens are resolved from <code>parapet_token_ref</code> or generated by the CLI, and printed for client usage.
        </p>
        <CodeSnippet
          title="Env reference examples"
          lines={[
            '# OpenAI route: resolves provider key from env',
            'provider_key_ref: ENV:OPENAI_API_KEY',
            '',
            '# Webhook secret: resolved and injected into runtime vault',
            'webhook:',
            '  url: https://example.com/parapet/webhook',
            '  secret_ref: ENV:PARAPET_WEBHOOK_SECRET',
            '',
            '# Service token: read from env or generated by CLI',
            'parapet_token_ref: ENV:PARAPET_SERVICE_MYAPP_TOKEN',
          ]}
        />
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-text">Allowed request parameters</h2>
        <p className="mt-3 text-sm text-muted pb-2">Only a known subset of OpenAI parameters are accepted per endpoint type.</p>
        <CodeSnippet
          title="Chat completions: allowed params"
          lines={[
            'temperature, top_p, frequency_penalty, presence_penalty,',
            'max_tokens, max_completion_tokens, stop, n,',
            'logit_bias, logprobs, top_logprobs, seed,',
            'response_format, tools, tool_choice, parallel_tool_calls,',
            'service_tier, store, stream_options,',
            'modalities, metadata, reasoning_effort,',
            'prompt_cache_key, safety_identifier, prediction',
          ]}
        />
        <div className="mt-4" />
        <CodeSnippet
          title="Embeddings: allowed params"
          lines={['dimensions, encoding_format, user']}
        />
      </section>

      <FAQ items={faqItems} />
    </div>
    </>
  );
};

export default DocsConfig;



