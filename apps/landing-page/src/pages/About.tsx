import type { FC } from 'react';
import SEO from '../components/seo/SEO';
import { Link } from 'react-router-dom';
import { Github, Shield, Code, Lock } from 'lucide-react';

const About: FC = () => {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ParapetAI',
    url: 'https://parapetai.com',
    description: 'Open source self-hosted LLM policy gateway for enterprises',
    sameAs: [
      'https://github.com/ParapetAI/ParapetAI',
    ],
  };

  return (
    <>
      <SEO
        title="About ParapetAI"
        description="Learn about ParapetAI, an open source self-hosted LLM policy gateway. Built for enterprises needing AI governance, budget controls, and data protection."
        keywords="about ParapetAI, open source LLM gateway, AI governance project, self-hosted AI infrastructure"
        canonical="https://parapetai.com/about"
        structuredData={organizationSchema}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">About ParapetAI</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            ParapetAI is an open source, self-hosted LLM policy gateway designed for enterprises that need AI governance, budget controls, and data protection.
          </p>
        </header>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Our Mission</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            ParapetAI was created to solve the critical challenges enterprises face when adopting LLMs: uncontrolled costs, data privacy risks, and lack of governance. We believe that AI infrastructure should be open, secure, and give organizations complete control over their data and spending.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Key Principles</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Code className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Open Source</h3>
              </div>
              <p className="text-sm text-muted">
                ParapetAI is completely open source and free to use. No subscriptions, no usage limits, no vendor lock-in. You own your infrastructure and your data.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Security First</h3>
              </div>
              <p className="text-sm text-muted">
                Built with security as a core principle. AES-256-GCM encryption, in-memory secret storage, HMAC-signed webhooks, and comprehensive data redaction.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Data Sovereignty</h3>
              </div>
              <p className="text-sm text-muted">
                Your data stays in your infrastructure. All telemetry, logs, and configuration remain on your servers. No data is sent to ParapetAI or third parties.
              </p>
            </div>
            <div className="rounded-none border-[3px] border-border bg-surface p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Github className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-text">Community Driven</h3>
              </div>
              <p className="text-sm text-muted">
                Built by the community, for the community. Contributions, feedback, and improvements are welcome. See our <a href="https://github.com/ParapetAI/ParapetAI" target="_blank" rel="noopener noreferrer" className="underline">GitHub repository</a>.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Expertise & Experience</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            ParapetAI is built by engineers who understand the challenges of production AI infrastructure. We've designed the system based on real-world requirements for:
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted list-disc list-inside">
            <li>Enterprise-grade security and compliance</li>
            <li>Multi-tenant budget controls and cost management</li>
            <li>Data protection and privacy regulations</li>
            <li>High availability and observability</li>
            <li>Open source best practices and maintainability</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Open Source Commitment</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            ParapetAI is released under the MIT license. We are committed to keeping the project open source and free. The codebase is available on <a href="https://github.com/ParapetAI/ParapetAI" target="_blank" rel="noopener noreferrer" className="underline">GitHub</a>, where you can contribute, report issues, or fork the project.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Security Practices</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Security is fundamental to ParapetAI. We follow best practices including:
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted list-disc list-inside">
            <li>Regular security audits and code reviews</li>
            <li>Responsible disclosure process for vulnerabilities</li>
            <li>Encryption at rest and in transit</li>
            <li>Minimal attack surface with immutable runtime</li>
            <li>Comprehensive security documentation</li>
          </ul>
          <p className="mt-6 text-sm text-muted">
            If you discover a security vulnerability, please report it to <a href="mailto:security@parapetai.com" className="underline">security@parapetai.com</a>. See our <Link to="/docs/security" className="underline">Security documentation</Link> for more details.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Get Involved</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            ParapetAI is an open source project and we welcome contributions. Whether you're fixing bugs, adding features, improving documentation, or providing feedback, your contributions help make ParapetAI better for everyone.
          </p>
          <div className="mt-6">
            <a
              href="https://github.com/ParapetAI/ParapetAI"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-none border-[3px] border-border bg-surface px-6 py-3 text-base font-semibold text-text shadow-md transition-all duration-200 hover:bg-surface/90 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm"
            >
              <Github className="h-5 w-5" />
              View on GitHub
            </a>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-text">Learn More</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Ready to get started? Check out our <Link to="/docs/quickstart" className="underline">Quickstart guide</Link>, explore the <Link to="/features" className="underline">Features</Link>, or review the <Link to="/docs" className="underline">Documentation</Link>.
          </p>
        </section>
      </div>
    </>
  );
};

export default About;

