import type { FC } from 'react';
import CodeSnippet from '../components/ui/CodeSnippet';
import { Link } from 'react-router-dom';
import ToggleExamples from '../components/docs/ToggleExamples';

const DocsQuickstart: FC = () => {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">Quickstart</h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Pull and run the Parapet runtime container, then point your app to its OpenAI‑compatible endpoints.
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
    </div>
  );
};

export default DocsQuickstart;



