import type { FC } from 'react';
import CodeSnippet from '../components/ui/CodeSnippet';
import SEO from '../components/seo/SEO';
import FAQ from '../components/docs/FAQ';
import { Link } from 'react-router-dom';

const DocsAPI: FC = () => {
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
        name: 'API Reference',
        item: 'https://parapetai.com/docs/api',
      },
    ],
  };

  const faqItems = [
    {
      question: 'What response format does ParapetAI use?',
      answer: 'ParapetAI uses OpenAI-compatible response formats. Chat completions and embeddings responses match OpenAI\'s API structure exactly, making it a drop-in replacement for OpenAI clients.',
    },
    {
      question: 'How do I handle streaming responses?',
      answer: 'Streaming responses use Server-Sent Events (SSE) format with Content-Type: text/event-stream. Each chunk contains a data field with JSON. The final chunk has [DONE] to indicate completion.',
    },
    {
      question: 'What error codes can I expect?',
      answer: 'ParapetAI returns standard HTTP status codes with OpenAI-compatible error objects. Common errors include invalid_parapet_api_key (401), drift_violation (400), budget_exceeded (429), and upstream_error (502). See the Error Responses section for complete details.',
    },
    {
      question: 'How do webhook events work?',
      answer: 'Webhooks send POST requests to your configured URL with HMAC-SHA256 signatures. Events include policy_decision, request_error, and provider_error types. Each event contains tenant, route, cost, and decision information.',
    },
    {
      question: 'Can I use ParapetAI with existing OpenAI SDKs?',
      answer: 'Yes, ParapetAI is fully OpenAI-compatible. Simply change the baseURL to point to your ParapetAI instance and use your service token as the API key. No code changes are required.',
    },
  ];

  return (
    <>
      <SEO
        title="API Reference - ParapetAI"
        description="Complete API reference for ParapetAI including response structures, error codes, webhook payloads, and comprehensive examples for chat completions, embeddings, and error handling."
        keywords="ParapetAI API reference, LLM gateway API, OpenAI compatible API, API documentation, webhook events, error codes"
        canonical="https://parapetai.com/docs/api"
        structuredData={breadcrumbSchema}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">API Reference</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            Complete reference for ParapetAI API endpoints, response structures, error codes, and webhook events. All endpoints are OpenAI-compatible.
          </p>
        </header>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">API Response Structures</h2>
          
          <div className="mt-6 space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-text">Health Endpoint</h3>
              <p className="mt-2 text-sm text-muted">
                GET <code>/health</code> returns runtime health status for monitoring and probes.
              </p>
              <div className="mt-4">
                <CodeSnippet
                  title="Response: 200 OK"
                  lines={[
                    '{',
                    '  "statusCode": 200,',
                    '  "data": {',
                    '    "isValid": true',
                    '  }',
                    '}',
                  ]}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text">Chat Completions (Non-Streaming)</h3>
              <p className="mt-2 text-sm text-muted">
                POST <code>/v1/chat/completions</code> with <code>stream: false</code> (or omitted) returns a complete response object.
              </p>
              <div className="mt-4">
                <CodeSnippet
                  title="Response: 200 OK"
                  lines={[
                    '{',
                    '  "id": "chatcmpl-abc123",',
                    '  "object": "chat.completion",',
                    '  "created": 1677652288,',
                    '  "model": "gpt-4o-mini",',
                    '  "choices": [',
                    '    {',
                    '      "index": 0,',
                    '      "message": {',
                    '        "role": "assistant",',
                    '        "content": "Hello! How can I help you today?"',
                    '      },',
                    '      "finish_reason": "stop"',
                    '    }',
                    '  ],',
                    '  "usage": {',
                    '    "prompt_tokens": 9,',
                    '    "completion_tokens": 12,',
                    '    "total_tokens": 21',
                    '  },',
                    '  "system_fingerprint": "fp_abc123"',
                    '}',
                  ]}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text">Chat Completions (Streaming)</h3>
              <p className="mt-2 text-sm text-muted">
                POST <code>/v1/chat/completions</code> with <code>stream: true</code> returns Server-Sent Events (SSE) with Content-Type: <code>text/event-stream</code>.
              </p>
              <div className="mt-4">
                <CodeSnippet
                  title="Streaming Response Format"
                  lines={[
                    'data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}',
                    '',
                    'data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}',
                    '',
                    'data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
                    '',
                    'data: [DONE]',
                  ]}
                />
              </div>
              <p className="mt-3 text-sm text-muted">
                Each line starts with <code>data: </code> followed by JSON. The final chunk contains <code>[DONE]</code> to signal completion. Empty lines separate chunks.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text">Embeddings</h3>
              <p className="mt-2 text-sm text-muted">
                POST <code>/v1/embeddings</code> returns a list of embedding vectors.
              </p>
              <div className="mt-4">
                <CodeSnippet
                  title="Response: 200 OK"
                  lines={[
                    '{',
                    '  "object": "list",',
                    '  "data": [',
                    '    {',
                    '      "object": "embedding",',
                    '      "embedding": [0.1, 0.2, 0.3, ...],',
                    '      "index": 0',
                    '    }',
                    '  ],',
                    '  "model": "text-embedding-3-small",',
                    '  "usage": {',
                    '    "prompt_tokens": 5,',
                    '    "total_tokens": 5',
                    '  }',
                    '}',
                  ]}
                />
              </div>
              <p className="mt-3 text-sm text-muted">
                For multiple inputs, each embedding is returned as a separate object in the <code>data</code> array with its corresponding <code>index</code>.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Error Responses</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            All errors follow OpenAI-compatible format with <code>error</code> object containing <code>message</code>, <code>type</code>, and optional <code>code</code> fields.
          </p>

          <div className="mt-6 overflow-x-auto rounded-lg ring-1 ring-black/10">
            <table className="min-w-full text-left">
              <thead className="bg-black/5">
                <tr>
                  <th className="px-4 py-2 font-medium text-text">HTTP Status</th>
                  <th className="px-4 py-2 font-medium text-text">Error Code</th>
                  <th className="px-4 py-2 font-medium text-text">Error Type</th>
                  <th className="px-4 py-2 font-medium text-text">When It Occurs</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-t border-black/10">
                  <td className="px-4 py-3"><code>400</code></td>
                  <td className="px-4 py-3"><code>invalid_json</code></td>
                  <td className="px-4 py-3 text-muted">invalid_request_error</td>
                  <td className="px-4 py-3 text-muted">Request body is not valid JSON</td>
                </tr>
                <tr className="border-t border-black/10">
                  <td className="px-4 py-3"><code>400</code></td>
                  <td className="px-4 py-3"><code>invalid_body</code></td>
                  <td className="px-4 py-3 text-muted">invalid_request_error</td>
                  <td className="px-4 py-3 text-muted">Required fields missing (model, messages, or input)</td>
                </tr>
                <tr className="border-t border-black/10">
                  <td className="px-4 py-3"><code>400</code></td>
                  <td className="px-4 py-3"><code>unknown_route</code></td>
                  <td className="px-4 py-3 text-muted">invalid_request_error</td>
                  <td className="px-4 py-3 text-muted">Route referenced in config but not found at runtime</td>
                </tr>
                <tr className="border-t border-black/10">
                  <td className="px-4 py-3"><code>400</code></td>
                  <td className="px-4 py-3"><code>drift_violation</code></td>
                  <td className="px-4 py-3 text-muted">invalid_request_error</td>
                  <td className="px-4 py-3 text-muted">Requested model not allowed for this service token (drift_strict enabled)</td>
                </tr>
                <tr className="border-t border-black/10">
                  <td className="px-4 py-3"><code>400</code></td>
                  <td className="px-4 py-3"><code>max_tokens_in_exceeded</code></td>
                  <td className="px-4 py-3 text-muted">invalid_request_error</td>
                  <td className="px-4 py-3 text-muted">Input tokens exceed route policy max_tokens_in limit</td>
                </tr>
                <tr className="border-t border-black/10">
                  <td className="px-4 py-3"><code>400</code></td>
                  <td className="px-4 py-3"><code>redaction_blocked</code></td>
                  <td className="px-4 py-3 text-muted">invalid_request_error</td>
                  <td className="px-4 py-3 text-muted">Sensitive data detected and redaction mode is "block"</td>
                </tr>
                <tr className="border-t border-black/10">
                  <td className="px-4 py-3"><code>401</code></td>
                  <td className="px-4 py-3"><code>invalid_parapet_api_key</code></td>
                  <td className="px-4 py-3 text-muted">invalid_request_error</td>
                  <td className="px-4 py-3 text-muted">Missing or invalid Authorization Bearer token</td>
                </tr>
                <tr className="border-t border-black/10">
                  <td className="px-4 py-3"><code>401</code></td>
                  <td className="px-4 py-3"><code>invalid_openai_api_key</code></td>
                  <td className="px-4 py-3 text-muted">invalid_request_error</td>
                  <td className="px-4 py-3 text-muted">Provider API key is invalid or expired</td>
                </tr>
                <tr className="border-t border-black/10">
                  <td className="px-4 py-3"><code>403</code></td>
                  <td className="px-4 py-3"><code>insufficient_permissions</code></td>
                  <td className="px-4 py-3 text-muted">insufficient_permissions</td>
                  <td className="px-4 py-3 text-muted">Service token not authorized for requested route</td>
                </tr>
                <tr className="border-t border-black/10">
                  <td className="px-4 py-3"><code>429</code></td>
                  <td className="px-4 py-3"><code>budget_exceeded</code></td>
                  <td className="px-4 py-3 text-muted">rate_limit_exceeded</td>
                  <td className="px-4 py-3 text-muted">Route or tenant daily budget cap exceeded</td>
                </tr>
                <tr className="border-t border-black/10">
                  <td className="px-4 py-3"><code>502</code></td>
                  <td className="px-4 py-3"><code>upstream_error</code></td>
                  <td className="px-4 py-3 text-muted">server_error</td>
                  <td className="px-4 py-3 text-muted">Provider API returned an error (after retries if configured)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <CodeSnippet
              title="Error Response Format"
              lines={[
                '{',
                '  "error": {',
                '    "message": "Invalid ParapetAI API key in Authorization header.",',
                '    "type": "invalid_request_error",',
                '    "code": "invalid_api_key"',
                '  }',
                '}',
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Webhook Event Payloads</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            Webhooks send POST requests to your configured URL with HMAC-SHA256 signatures in the <code>X-Parapet-Signature</code> header. All events use the same payload structure.
          </p>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-text">Event Types</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted list-disc list-inside">
              <li><code>policy_decision</code> - Emitted when a request is allowed or blocked by policy</li>
              <li><code>request_error</code> - Emitted when request validation fails (not currently implemented)</li>
              <li><code>provider_error</code> - Emitted when the upstream provider returns an error</li>
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-text">Payload Structure</h3>
            <div className="mt-4 overflow-x-auto rounded-lg ring-1 ring-black/10">
              <table className="min-w-full text-left">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text">Field</th>
                    <th className="px-4 py-2 font-medium text-text">Type</th>
                    <th className="px-4 py-2 font-medium text-text">Description</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>timestamp</code></td>
                    <td className="px-4 py-3 text-muted">string (ISO 8601)</td>
                    <td className="px-4 py-3 text-muted">Event timestamp</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>tenant</code></td>
                    <td className="px-4 py-3 text-muted">string | null</td>
                    <td className="px-4 py-3 text-muted">Tenant identifier</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>route</code></td>
                    <td className="px-4 py-3 text-muted">string | null</td>
                    <td className="px-4 py-3 text-muted">Route name</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>model</code></td>
                    <td className="px-4 py-3 text-muted">string | null</td>
                    <td className="px-4 py-3 text-muted">Model identifier</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>decision</code></td>
                    <td className="px-4 py-3 text-muted">"allow" | "block"</td>
                    <td className="px-4 py-3 text-muted">Policy decision outcome</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>reason_if_blocked</code></td>
                    <td className="px-4 py-3 text-muted">string | null</td>
                    <td className="px-4 py-3 text-muted">Reason for block (null if allowed)</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>estimated_cost_usd</code></td>
                    <td className="px-4 py-3 text-muted">number</td>
                    <td className="px-4 py-3 text-muted">Pre-call cost estimate</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>actual_cost_usd</code></td>
                    <td className="px-4 py-3 text-muted">number</td>
                    <td className="px-4 py-3 text-muted">Final cost after completion</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>budget_daily_usd</code></td>
                    <td className="px-4 py-3 text-muted">number | null</td>
                    <td className="px-4 py-3 text-muted">Route daily budget cap</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>budget_spend_today_usd</code></td>
                    <td className="px-4 py-3 text-muted">number | null</td>
                    <td className="px-4 py-3 text-muted">Route spend today</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>tenant_budget_daily_usd</code></td>
                    <td className="px-4 py-3 text-muted">number | null</td>
                    <td className="px-4 py-3 text-muted">Tenant daily spend cap</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>tenant_budget_spend_today_usd</code></td>
                    <td className="px-4 py-3 text-muted">number | null</td>
                    <td className="px-4 py-3 text-muted">Tenant spend today</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>redaction_mode</code></td>
                    <td className="px-4 py-3 text-muted">"warn" | "block" | "off" | null</td>
                    <td className="px-4 py-3 text-muted">Redaction mode for route</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>drift_strict</code></td>
                    <td className="px-4 py-3 text-muted">boolean | null</td>
                    <td className="px-4 py-3 text-muted">Whether drift_strict is enabled</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>prompt_excerpt</code></td>
                    <td className="px-4 py-3 text-muted">string</td>
                    <td className="px-4 py-3 text-muted">First 80 characters of prompt (if include_prompt_snippet enabled)</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>retry_count</code></td>
                    <td className="px-4 py-3 text-muted">number (optional)</td>
                    <td className="px-4 py-3 text-muted">Number of retries attempted</td>
                  </tr>
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-3"><code>cache_hit</code></td>
                    <td className="px-4 py-3 text-muted">boolean (optional)</td>
                    <td className="px-4 py-3 text-muted">Whether response was served from cache</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-text">Example: Policy Decision (Allow)</h3>
            <CodeSnippet
              title="Webhook Payload"
              lines={[
                '{',
                '  "timestamp": "2024-01-15T10:30:00.000Z",',
                '  "tenant": "acme",',
                '  "route": "acme-chat",',
                '  "model": "gpt-4o-mini",',
                '  "decision": "allow",',
                '  "reason_if_blocked": null,',
                '  "estimated_cost_usd": 0.000012,',
                '  "actual_cost_usd": 0.000011,',
                '  "budget_daily_usd": 10.0,',
                '  "budget_spend_today_usd": 2.5,',
                '  "tenant_budget_daily_usd": 50.0,',
                '  "tenant_budget_spend_today_usd": 15.3,',
                '  "redaction_mode": "warn",',
                '  "drift_strict": true,',
                '  "prompt_excerpt": "Hello, how can I help you today?",',
                '  "retry_count": 0,',
                '  "cache_hit": false',
                '}',
              ]}
            />
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-text">Example: Policy Decision (Block)</h3>
            <CodeSnippet
              title="Webhook Payload"
              lines={[
                '{',
                '  "timestamp": "2024-01-15T10:30:00.000Z",',
                '  "tenant": "acme",',
                '  "route": "acme-chat",',
                '  "model": "gpt-4o-mini",',
                '  "decision": "block",',
                '  "reason_if_blocked": "budget_exceeded",',
                '  "estimated_cost_usd": 0.000012,',
                '  "actual_cost_usd": 0.0,',
                '  "budget_daily_usd": 10.0,',
                '  "budget_spend_today_usd": 10.0,',
                '  "tenant_budget_daily_usd": 50.0,',
                '  "tenant_budget_spend_today_usd": 15.3,',
                '  "redaction_mode": "warn",',
                '  "drift_strict": true,',
                '  "prompt_excerpt": "",',
                '  "retry_count": 0',
                '}',
              ]}
            />
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-text">Signature Verification</h3>
            <p className="mt-2 text-sm text-muted">
              Verify webhook signatures using HMAC-SHA256. The signature is in the <code>X-Parapet-Signature</code> header as <code>sha256=&lt;hex-digest&gt;</code>.
            </p>
            <CodeSnippet
              title="Node.js Verification Example"
              lines={[
                'import crypto from "node:crypto";',
                '',
                'function verifyParapetSignature(rawBody, signatureHeader, secret) {',
                '  const expected = crypto',
                '    .createHmac("sha256", secret)',
                '    .update(rawBody, "utf8")',
                '    .digest("hex");',
                '  const provided = signatureHeader.replace(/^sha256=/, "");',
                '  return crypto.timingSafeEqual(',
                '    Buffer.from(expected, "hex"),',
                '    Buffer.from(provided, "hex")',
                '  );',
                '}',
                '',
                '// Usage',
                'const signature = req.headers["x-parapet-signature"];',
                'const isValid = verifyParapetSignature(req.body, signature, WEBHOOK_SECRET);',
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Request/Response Examples</h2>

          <div className="mt-6 space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-text">Basic Chat Completion</h3>
              <CodeSnippet
                title="Request"
                lines={[
                  'curl -X POST http://localhost:8000/v1/chat/completions \\',
                  '  -H "Authorization: Bearer $PARAPET_SERVICE_MYAPP_TOKEN" \\',
                  '  -H "Content-Type: application/json" \\',
                  '  -d \'{',
                  '    "model": "gpt-4o-mini",',
                  '    "messages": [',
                  '      { "role": "user", "content": "Hello!" }',
                  '    ]',
                  '  }\'',
                ]}
              />
              <div className="mt-4">
                <CodeSnippet
                  title="Response: 200 OK"
                  lines={[
                    '{',
                    '  "id": "chatcmpl-abc123",',
                    '  "object": "chat.completion",',
                    '  "created": 1677652288,',
                    '  "model": "gpt-4o-mini",',
                    '  "choices": [{',
                    '    "index": 0,',
                    '    "message": {',
                    '      "role": "assistant",',
                    '      "content": "Hello! How can I assist you today?"',
                    '    },',
                    '    "finish_reason": "stop"',
                    '  }],',
                    '  "usage": {',
                    '    "prompt_tokens": 9,',
                    '    "completion_tokens": 12,',
                    '    "total_tokens": 21',
                    '  }',
                    '}',
                  ]}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text">Streaming Chat Completion</h3>
              <CodeSnippet
                title="Request"
                lines={[
                  'curl -X POST http://localhost:8000/v1/chat/completions \\',
                  '  -H "Authorization: Bearer $PARAPET_SERVICE_MYAPP_TOKEN" \\',
                  '  -H "Content-Type: application/json" \\',
                  '  -d \'{',
                  '    "model": "gpt-4o-mini",',
                  '    "messages": [',
                  '      { "role": "user", "content": "Count to 5" }',
                  '    ],',
                  '    "stream": true',
                  '  }\'',
                ]}
              />
              <div className="mt-4">
                <CodeSnippet
                  title="Response: 200 OK (text/event-stream)"
                  lines={[
                    'data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant","content":"1"},"finish_reason":null}]}',
                    '',
                    'data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":" 2"},"finish_reason":null}]}',
                    '',
                    'data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
                    '',
                    'data: [DONE]',
                  ]}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text">Embeddings</h3>
              <CodeSnippet
                title="Request"
                lines={[
                  'curl -X POST http://localhost:8000/v1/embeddings \\',
                  '  -H "Authorization: Bearer $PARAPET_SERVICE_MYAPP_TOKEN" \\',
                  '  -H "Content-Type: application/json" \\',
                  '  -d \'{',
                  '    "model": "text-embedding-3-small",',
                  '    "input": "The quick brown fox"',
                  '  }\'',
                ]}
              />
              <div className="mt-4">
                <CodeSnippet
                  title="Response: 200 OK"
                  lines={[
                    '{',
                    '  "object": "list",',
                    '  "data": [{',
                    '    "object": "embedding",',
                    '    "embedding": [0.1, 0.2, 0.3, ...],',
                    '    "index": 0',
                    '  }],',
                    '  "model": "text-embedding-3-small",',
                    '  "usage": {',
                    '    "prompt_tokens": 5,',
                    '    "total_tokens": 5',
                    '  }',
                    '}',
                  ]}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text">Error Handling</h3>
              <CodeSnippet
                title="Request with Invalid Token"
                lines={[
                  'curl -X POST http://localhost:8000/v1/chat/completions \\',
                  '  -H "Authorization: Bearer invalid-token" \\',
                  '  -H "Content-Type: application/json" \\',
                  '  -d \'{',
                  '    "model": "gpt-4o-mini",',
                  '    "messages": [{ "role": "user", "content": "Hello" }]',
                  '  }\'',
                ]}
              />
              <div className="mt-4">
                <CodeSnippet
                  title="Response: 401 Unauthorized"
                  lines={[
                    '{',
                    '  "error": {',
                    '    "message": "Invalid ParapetAI API key in Authorization header.",',
                    '    "type": "invalid_request_error",',
                    '    "code": "invalid_api_key"',
                    '  }',
                    '}',
                  ]}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text">Cache Hit Example</h3>
              <p className="mt-2 text-sm text-muted">
                When caching is enabled and a matching request is found, the response is served from cache with <code>cache_hit: true</code> in telemetry. The response format is identical to a non-cached response.
              </p>
              <CodeSnippet
                title="First Request (Cache Miss)"
                lines={[
                  'curl -X POST http://localhost:8000/v1/chat/completions \\',
                  '  -H "Authorization: Bearer $PARAPET_SERVICE_MYAPP_TOKEN" \\',
                  '  -H "Content-Type: application/json" \\',
                  '  -d \'{',
                  '    "model": "gpt-4o-mini",',
                  '    "messages": [{ "role": "user", "content": "Hello" }]',
                  '  }\'',
                  '',
                  '# Response includes full completion, cached for 30s (default)',
                ]}
              />
              <div className="mt-4">
                <CodeSnippet
                  title="Second Request (Cache Hit)"
                  lines={[
                    '# Same request within TTL returns cached response',
                    '# Telemetry shows cache_hit: true, actual_cost_usd: 0',
                    '# Response format is identical to first request',
                  ]}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text">Retry Behavior</h3>
              <p className="mt-2 text-sm text-muted">
                When retries are configured, ParapetAI automatically retries on specific HTTP status codes (429, 500, 502, 503, 504) with exponential backoff. The <code>retry_count</code> field in webhooks indicates how many retries were attempted.
              </p>
              <CodeSnippet
                title="Retry Configuration Example"
                lines={[
                  'routes:',
                  '  - name: acme-chat',
                  '    tenant: acme',
                  '    provider:',
                  '      type: openai',
                  '      model: gpt-4o-mini',
                  '      endpoint: https://api.openai.com/v1',
                  '      provider_key_ref: ENV:OPENAI_API_KEY',
                  '    retries:',
                  '      max_attempts: 3',
                  '      base_ms: 200',
                  '      jitter: true',
                  '      retry_on: [429, 500, 502, 503, 504]',
                  '      max_elapsed_ms: 2000',
                ]}
              />
              <p className="mt-3 text-sm text-muted">
                If the provider returns 429 (rate limit), ParapetAI will retry up to 3 times with exponential backoff before returning <code>upstream_error</code>.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text">Webhook Integration</h3>
              <CodeSnippet
                title="Webhook Receiver (Node.js)"
                lines={[
                  'import http from "node:http";',
                  'import crypto from "node:crypto";',
                  '',
                  'const SECRET = process.env.WEBHOOK_SECRET;',
                  '',
                  'const server = http.createServer((req, res) => {',
                  '  if (req.method !== "POST") {',
                  '    res.writeHead(405);',
                  '    res.end("Method not allowed");',
                  '    return;',
                  '  }',
                  '',
                  '  let body = "";',
                  '  req.on("data", (chunk) => {',
                  '    body += chunk.toString();',
                  '  });',
                  '',
                  '  req.on("end", () => {',
                  '    const signature = req.headers["x-parapet-signature"];',
                  '    const expected = crypto',
                  '      .createHmac("sha256", SECRET)',
                  '      .update(body)',
                  '      .digest("hex");',
                  '    const provided = signature?.replace("sha256=", "");',
                  '',
                  '    if (provided !== expected) {',
                  '      console.error("Invalid signature");',
                  '      res.writeHead(401);',
                  '      res.end("Unauthorized");',
                  '      return;',
                  '  }',
                  '',
                  '    const event = JSON.parse(body);',
                  '    console.log("Event:", event.decision, event.reason_if_blocked);',
                  '    res.writeHead(200);',
                  '    res.end(JSON.stringify({ ok: true }));',
                  '  });',
                  '});',
                  '',
                  'server.listen(3000);',
                ]}
              />
            </div>
          </div>
        </section>

        <section className="mt-12">
          <p className="text-sm text-muted">
            Need help? See the <Link to="/docs/troubleshooting" className="underline">Troubleshooting</Link> guide or review <Link to="/docs/config" className="underline">Configuration</Link> options.
          </p>
        </section>

        <FAQ items={faqItems} />
      </div>
    </>
  );
};

export default DocsAPI;

