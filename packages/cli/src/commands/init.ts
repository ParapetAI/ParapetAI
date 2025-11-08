import { Command } from 'commander';
import inquirer from 'inquirer';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ParapetSpec, TenantSpec, RouteSpec, ServiceSpec } from '@parapetai/config-core';
import { SUPPORTED_PROVIDERS, REDACTION_RULES } from '@parapetai/config-core';

interface WizardAnswers {
  tenantName: string;
  tenantDailyCap: number;
  routes: RouteWizardData[];
  services: ServiceWizardData[];
}

interface RouteWizardData {
  name: string;
  providerType: 'openai' | 'local';
  model: string;
  endpointType: 'chat_completions' | 'embeddings';
  providerKey?: string;
  endpoint?: string;
  hasPolicy: boolean;
  policy?: {
    maxTokensIn: number;
    maxTokensOut: number;
    budgetDailyUsd: number;
    driftStrict: boolean;
    driftSensitivity?: 'low' | 'medium' | 'high';
    redactionMode: 'warn' | 'block' | 'off';
    redactionPatterns: string[];
  };
  hasRetries: boolean;
  retries?: {
    maxAttempts: number;
    baseMs: number;
    jitter: boolean;
    retryOn: number[];
    maxElapsedMs: number;
  };
  hasCache: boolean;
  cache?: {
    enabled: boolean;
    ttlMs: number;
    maxEntries: number;
    includeParams: boolean;
  };
  hasWebhook: boolean;
  webhook?: {
    url: string;
    secretRef: string;
  };
}

interface ServiceWizardData {
  label: string;
  allowedRoutes: string[];
  tokenRef: string;
}

export function initCommand(): Command {
  const cmd = new Command('init')
    .description('Interactive wizard to create a parapet.yaml configuration file')
    .option('-f, --file <path>', 'Path to output YAML file', 'parapet.yaml')
    .option('--overwrite', 'Overwrite existing file if it exists', false)
    .action(async (opts: { file: string; overwrite?: boolean }) => {
      try {
        const outputPath = path.resolve(opts.file);
        const fileExists = await fs
          .access(outputPath)
          .then(() => true)
          .catch(() => false);

        if (fileExists && !opts.overwrite) {
          const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
            {
              type: 'confirm',
              name: 'overwrite',
              message: `File ${opts.file} already exists. Overwrite?`,
              default: false,
            },
          ]);
          if (!overwrite) {
            console.log('Cancelled. No file was created.');
            return;
          }
        }

        console.log('\nWelcome to the ParapetAI configuration wizard!');
        console.log('This wizard will guide you through creating a parapet.yaml file.\n');
        console.log('All API keys will be entered locally and never sent over the internet.\n');

        const answers = await collectWizardAnswers();
        const spec = buildSpecFromAnswers(answers);
        const yaml = generateYaml(spec);

        await fs.writeFile(outputPath, yaml, { encoding: 'utf8' });
        console.log(`\n✓ Configuration file created at ${outputPath}`);
        console.log('\nNext steps:');
        console.log('  1. Review the generated parapet.yaml file');
        console.log('  2. Run: parapetai build-config -f parapet.yaml -o .env');
        console.log('  3. Load the .env file in your runtime environment\n');
      } catch (error) {
        if (error && typeof error === 'object' && 'isTtyError' in error) {
          console.log('\nCancelled. No file was created.');
          return;
        }
        console.error(`Error creating configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  return cmd;
}

async function collectWizardAnswers(): Promise<WizardAnswers> {
  const { tenantName } = await inquirer.prompt<{ tenantName: string }>([
    {
      type: 'input',
      name: 'tenantName',
      message: 'Enter tenant name:',
      default: 'default',
      validate: (input: string) => {
        if (!input.trim()) return 'Tenant name cannot be empty';
        if (!/^[a-z0-9_-]+$/i.test(input)) return 'Tenant name must contain only letters, numbers, hyphens, and underscores';
        return true;
      },
    },
  ]);

  const { tenantDailyCap } = await inquirer.prompt<{ tenantDailyCap: number }>([
    {
      type: 'number',
      name: 'tenantDailyCap',
      message: 'Enter daily spend cap (USD):',
      default: 50,
      validate: (input: number) => {
        if (isNaN(input) || input <= 0) return 'Daily spend cap must be a positive number';
        return true;
      },
    },
  ]);

  const routes: RouteWizardData[] = [];
  let addMoreRoutes = true;

  while (addMoreRoutes) {
    console.log(`\n--- Configuring Route ${routes.length + 1} ---`);
    const route = await collectRouteData(tenantName);
    routes.push(route);

    const { addMore } = await inquirer.prompt<{ addMore: boolean }>([
      {
        type: 'confirm',
        name: 'addMore',
        message: 'Add another route?',
        default: false,
      },
    ]);
    addMoreRoutes = addMore;
  }

  const services: ServiceWizardData[] = [];
  let addMoreServices = true;
  const routeNames = routes.map((r) => r.name);

  while (addMoreServices) {
    console.log(`\n--- Configuring Service ${services.length + 1} ---`);
    const service = await collectServiceData(tenantName, routeNames);
    services.push(service);

    const { addMore } = await inquirer.prompt<{ addMore: boolean }>([
      {
        type: 'confirm',
        name: 'addMore',
        message: 'Add another service?',
        default: false,
      },
    ]);
    addMoreServices = addMore;
  }

  return {
    tenantName,
    tenantDailyCap,
    routes,
    services,
  };
}

async function collectRouteData(tenantName: string): Promise<RouteWizardData> {
  const { name } = await inquirer.prompt<{ name: string }>([
    {
      type: 'input',
      name: 'name',
      message: 'Route name:',
      validate: (input: string) => {
        if (!input.trim()) return 'Route name cannot be empty';
        if (!/^[a-z0-9_-]+$/i.test(input)) return 'Route name must contain only letters, numbers, hyphens, and underscores';
        return true;
      },
    },
  ]);

  const { providerType } = await inquirer.prompt<{ providerType: 'openai' | 'local' }>([
    {
      type: 'list',
      name: 'providerType',
      message: 'Provider type:',
      choices: SUPPORTED_PROVIDERS.map((p) => ({ name: p, value: p })),
    },
  ]);

  const { model } = await inquirer.prompt<{ model: string }>([
    {
      type: 'input',
      name: 'model',
      message: 'Model name:',
      default: providerType === 'openai' ? 'gpt-4o-mini' : 'deepseek-r1:8b',
      validate: (input: string) => {
        if (!input.trim()) return 'Model name cannot be empty';
        return true;
      },
    },
  ]);

  const { endpointType } = await inquirer.prompt<{ endpointType: 'chat_completions' | 'embeddings' }>([
    {
      type: 'list',
      name: 'endpointType',
      message: 'Endpoint type:',
      choices: [
        { name: 'Chat Completions', value: 'chat_completions' },
        { name: 'Embeddings', value: 'embeddings' },
      ],
      default: 'chat_completions',
    },
  ]);

  let providerKey: string | undefined;
  let endpoint: string | undefined;

  if (providerType === 'openai') {
    const { useEnv } = await inquirer.prompt<{ useEnv: boolean }>([
      {
        type: 'confirm',
        name: 'useEnv',
        message: 'Use environment variable for API key? (recommended)',
        default: true,
      },
    ]);

    if (useEnv) {
      const { envVar } = await inquirer.prompt<{ envVar: string }>([
        {
          type: 'input',
          name: 'envVar',
          message: 'Environment variable name:',
          default: 'OPENAI_API_KEY',
          validate: (input: string) => {
            if (!input.trim()) return 'Environment variable name cannot be empty';
            return true;
          },
        },
      ]);
      providerKey = `ENV:${envVar}`;
    } else {
      const { key } = await inquirer.prompt<{ key: string }>([
        {
          type: 'password',
          name: 'key',
          message: 'Enter API key (will be stored as ENV reference):',
          mask: '*',
          validate: (input: string) => {
            if (!input.trim()) return 'API key cannot be empty';
            return true;
          },
        },
      ]);
      const { envVar } = await inquirer.prompt<{ envVar: string }>([
        {
          type: 'input',
          name: 'envVar',
          message: 'Environment variable name to reference:',
          default: 'OPENAI_API_KEY',
          validate: (input: string) => {
            if (!input.trim()) return 'Environment variable name cannot be empty';
            return true;
          },
        },
      ]);
      providerKey = `ENV:${envVar}`;
      console.log(`\nNote: Set ${envVar} in your environment before running build-config`);
    }

    const { endpointUrl } = await inquirer.prompt<{ endpointUrl: string }>([
      {
        type: 'input',
        name: 'endpointUrl',
        message: 'Enter endpoint URL:',
        default: 'https://api.openai.com/v1',
        validate: (input: string) => {
          if (!input.trim()) return 'Endpoint URL cannot be empty';
          try {
            new URL(input);
            return true;
          } catch {
            return 'Invalid URL format';
          }
        },
      },
    ]);
    endpoint = endpointUrl;
  } else {
    const { endpointUrl } = await inquirer.prompt<{ endpointUrl: string }>([
      {
        type: 'input',
        name: 'endpointUrl',
        message: 'Enter endpoint URL:',
        validate: (input: string) => {
          if (!input.trim()) return 'Endpoint URL cannot be empty';
          try {
            new URL(input);
            return true;
          } catch {
            return 'Invalid URL format';
          }
        },
      },
    ]);
    endpoint = endpointUrl;
  }

  const { hasPolicy } = await inquirer.prompt<{ hasPolicy: boolean }>([
    {
      type: 'confirm',
      name: 'hasPolicy',
      message: 'Configure policy settings?',
      default: true,
    },
  ]);

  let policy: RouteWizardData['policy'] | undefined;
  if (hasPolicy) {
    const { maxTokensIn } = await inquirer.prompt<{ maxTokensIn: number }>([
      {
        type: 'number',
        name: 'maxTokensIn',
        message: 'Max input tokens:',
        default: 4000,
        validate: (input: number) => {
          if (isNaN(input) || input < 0) return 'Max tokens must be a non-negative number';
          return true;
        },
      },
    ]);

    const { maxTokensOut } = await inquirer.prompt<{ maxTokensOut: number }>([
      {
        type: 'number',
        name: 'maxTokensOut',
        message: 'Max output tokens:',
        default: 4000,
        validate: (input: number) => {
          if (isNaN(input) || input < 0) return 'Max tokens must be a non-negative number';
          return true;
        },
      },
    ]);

    const { budgetDailyUsd } = await inquirer.prompt<{ budgetDailyUsd: number }>([
      {
        type: 'number',
        name: 'budgetDailyUsd',
        message: 'Daily budget (USD):',
        default: 2.0,
        validate: (input: number) => {
          if (isNaN(input) || input <= 0) return 'Daily budget must be a positive number';
          return true;
        },
      },
    ]);

    const { driftStrict } = await inquirer.prompt<{ driftStrict: boolean }>([
      {
        type: 'confirm',
        name: 'driftStrict',
        message: 'Enable strict drift detection?',
        default: true,
      },
    ]);

    const { driftSensitivity } = await inquirer.prompt<{ driftSensitivity: 'low' | 'medium' | 'high' }>([
      {
        type: 'list',
        name: 'driftSensitivity',
        message: 'Drift detection sensitivity:',
        choices: [
          { name: 'Low (25% threshold)', value: 'low' },
          { name: 'Medium (15% threshold)', value: 'medium' },
          { name: 'High (10% threshold)', value: 'high' },
        ],
        default: 'medium',
      },
    ]);

    const { redactionMode } = await inquirer.prompt<{ redactionMode: 'warn' | 'block' | 'off' }>([
      {
        type: 'list',
        name: 'redactionMode',
        message: 'Redaction mode:',
        choices: [
          { name: 'Warn (log but allow)', value: 'warn' },
          { name: 'Block (reject request)', value: 'block' },
          { name: 'Off (no redaction)', value: 'off' },
        ],
        default: 'warn',
      },
    ]);

    const { redactionPatterns } = await inquirer.prompt<{ redactionPatterns: string[] }>([
      {
        type: 'checkbox',
        name: 'redactionPatterns',
        message: 'Select redaction patterns:',
        choices: REDACTION_RULES.map((rule) => ({ name: rule, value: rule })),
        default: ['email', 'api_key', 'ip', 'phone'],
      },
    ]);

    policy = {
      maxTokensIn,
      maxTokensOut,
      budgetDailyUsd,
      driftStrict,
      driftSensitivity,
      redactionMode,
      redactionPatterns,
    };
  }

  const { hasRetries } = await inquirer.prompt<{ hasRetries: boolean }>([
    {
      type: 'confirm',
      name: 'hasRetries',
      message: 'Configure retry settings?',
      default: true,
    },
  ]);

  let retries: RouteWizardData['retries'] | undefined;
  if (hasRetries) {
    const { maxAttempts } = await inquirer.prompt<{ maxAttempts: number }>([
      {
        type: 'number',
        name: 'maxAttempts',
        message: 'Max retry attempts:',
        default: 3,
        validate: (input: number) => {
          if (isNaN(input) || input < 2 || input > 5) return 'Max attempts must be between 2 and 5';
          return true;
        },
      },
    ]);

    const { baseMs } = await inquirer.prompt<{ baseMs: number }>([
      {
        type: 'number',
        name: 'baseMs',
        message: 'Base delay (ms):',
        default: 200,
        validate: (input: number) => {
          if (isNaN(input) || input < 100 || input > 1000) return 'Base delay must be between 100 and 1000 ms';
          return true;
        },
      },
    ]);

    const { jitter } = await inquirer.prompt<{ jitter: boolean }>([
      {
        type: 'confirm',
        name: 'jitter',
        message: 'Enable jitter?',
        default: true,
      },
    ]);

    const { retryOn } = await inquirer.prompt<{ retryOn: number[] }>([
      {
        type: 'checkbox',
        name: 'retryOn',
        message: 'Retry on status codes:',
        choices: [
          { name: '429 (Too Many Requests)', value: 429 },
          { name: '500 (Internal Server Error)', value: 500 },
          { name: '502 (Bad Gateway)', value: 502 },
          { name: '503 (Service Unavailable)', value: 503 },
          { name: '504 (Gateway Timeout)', value: 504 },
        ],
        default: [429, 500, 502, 503, 504],
      },
    ]);

    const { maxElapsedMs } = await inquirer.prompt<{ maxElapsedMs: number }>([
      {
        type: 'number',
        name: 'maxElapsedMs',
        message: 'Max elapsed time (ms):',
        default: 10000,
        validate: (input: number) => {
          if (isNaN(input) || input < baseMs) return `Max elapsed time must be at least ${baseMs} ms`;
          return true;
        },
      },
    ]);

    retries = {
      maxAttempts,
      baseMs,
      jitter,
      retryOn,
      maxElapsedMs,
    };
  }

  const { hasCache } = await inquirer.prompt<{ hasCache: boolean }>([
    {
      type: 'confirm',
      name: 'hasCache',
      message: 'Configure cache settings?',
      default: true,
    },
  ]);

  let cache: RouteWizardData['cache'] | undefined;
  if (hasCache) {
    const { enabled } = await inquirer.prompt<{ enabled: boolean }>([
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Enable caching?',
        default: true,
      },
    ]);

    const { ttlMs } = await inquirer.prompt<{ ttlMs: number }>([
      {
        type: 'number',
        name: 'ttlMs',
        message: 'Cache TTL (ms):',
        default: 30000,
        validate: (input: number) => {
          if (isNaN(input) || input <= 0) return 'TTL must be a positive number';
          return true;
        },
      },
    ]);

    const { maxEntries } = await inquirer.prompt<{ maxEntries: number }>([
      {
        type: 'number',
        name: 'maxEntries',
        message: 'Max cache entries:',
        default: 5000,
        validate: (input: number) => {
          if (isNaN(input) || input <= 0) return 'Max entries must be a positive number';
          return true;
        },
      },
    ]);

    const { includeParams } = await inquirer.prompt<{ includeParams: boolean }>([
      {
        type: 'confirm',
        name: 'includeParams',
        message: 'Include parameters in cache key?',
        default: true,
      },
    ]);

    cache = {
      enabled,
      ttlMs,
      maxEntries,
      includeParams,
    };
  }

  const { hasWebhook } = await inquirer.prompt<{ hasWebhook: boolean }>([
    {
      type: 'confirm',
      name: 'hasWebhook',
      message: 'Configure webhook?',
      default: false,
    },
  ]);

  let webhook: RouteWizardData['webhook'] | undefined;
  if (hasWebhook) {
    const { url } = await inquirer.prompt<{ url: string }>([
      {
        type: 'input',
        name: 'url',
        message: 'Webhook URL:',
        validate: (input: string) => {
          if (!input.trim()) return 'Webhook URL cannot be empty';
          try {
            new URL(input);
            return true;
          } catch {
            return 'Invalid URL format';
          }
        },
      },
    ]);

    const { secretRef } = await inquirer.prompt<{ secretRef: string }>([
      {
        type: 'input',
        name: 'secretRef',
        message: 'Webhook secret reference (e.g., ENV:WEBHOOK_SECRET):',
        default: 'ENV:WEBHOOK_SECRET',
        validate: (input: string) => {
          if (!input.trim()) return 'Secret reference cannot be empty';
          return true;
        },
      },
    ]);

    webhook = {
      url,
      secretRef,
    };
  }

  return {
    name,
    providerType,
    model,
    endpointType,
    providerKey,
    endpoint,
    hasPolicy,
    policy,
    hasRetries,
    retries,
    hasCache,
    cache,
    hasWebhook,
    webhook,
  };
}

async function collectServiceData(tenantName: string, routeNames: string[]): Promise<ServiceWizardData> {
  const { label } = await inquirer.prompt<{ label: string }>([
    {
      type: 'input',
      name: 'label',
      message: 'Service label:',
      validate: (input: string) => {
        if (!input.trim()) return 'Service label cannot be empty';
        if (!/^[a-z0-9_-]+$/i.test(input)) return 'Service label must contain only letters, numbers, hyphens, and underscores';
        return true;
      },
    },
  ]);

  const { allowedRoutes } = await inquirer.prompt<{ allowedRoutes: string[] }>([
    {
      type: 'checkbox',
      name: 'allowedRoutes',
      message: 'Select allowed routes:',
      choices: routeNames.map((name) => ({ name, value: name })),
      validate: (input: string[]) => {
        if (input.length === 0) return 'At least one route must be selected';
        return true;
      },
    },
  ]);

  const { useEnv } = await inquirer.prompt<{ useEnv: boolean }>([
    {
      type: 'confirm',
      name: 'useEnv',
      message: 'Use environment variable for Parapet token? (recommended)',
      default: true,
    },
  ]);

  let tokenRef: string;
  if (useEnv) {
    const { envVar } = await inquirer.prompt<{ envVar: string }>([
      {
        type: 'input',
        name: 'envVar',
        message: 'Environment variable name:',
        default: `PARAPET_SERVICE_${label.toUpperCase()}_TOKEN`,
        validate: (input: string) => {
          if (!input.trim()) return 'Environment variable name cannot be empty';
          return true;
        },
      },
    ]);
    tokenRef = `ENV:${envVar}`;
  } else {
    const { token } = await inquirer.prompt<{ token: string }>([
      {
        type: 'password',
        name: 'token',
        message: 'Enter Parapet token (will be stored as ENV reference):',
        mask: '*',
        validate: (input: string) => {
          if (!input.trim()) return 'Token cannot be empty';
          return true;
        },
      },
    ]);
    const { envVar } = await inquirer.prompt<{ envVar: string }>([
      {
        type: 'input',
        name: 'envVar',
        message: 'Environment variable name to reference:',
        default: `PARAPET_SERVICE_${label.toUpperCase()}_TOKEN`,
        validate: (input: string) => {
          if (!input.trim()) return 'Environment variable name cannot be empty';
          return true;
        },
      },
    ]);
    tokenRef = `ENV:${envVar}`;
    console.log(`\nNote: Set ${envVar} in your environment before running build-config`);
  }

  return {
    label,
    allowedRoutes,
    tokenRef,
  };
}

function buildSpecFromAnswers(answers: WizardAnswers): ParapetSpec {
  const tenants: TenantSpec[] = [
    {
      name: answers.tenantName,
      spend: {
        daily_usd_cap: answers.tenantDailyCap,
      },
    },
  ];

  const routes: RouteSpec[] = answers.routes.map((route) => {
    const provider: RouteSpec['provider'] = {
      type: route.providerType,
      model: route.model,
      endpoint_type: route.endpointType,
      ...(route.providerType === 'openai' && route.providerKey ? { provider_key_ref: route.providerKey } : {}),
      ...(route.providerType === 'openai' && route.endpoint ? { endpoint: route.endpoint } : {}),
      ...(route.providerType === 'local' && route.endpoint ? { endpoint: route.endpoint } : {}),
    };

    const routeSpec: RouteSpec = {
      name: route.name,
      tenant: answers.tenantName,
      provider,
      ...(route.policy
        ? {
            policy: {
              max_tokens_in: route.policy.maxTokensIn,
              max_tokens_out: route.policy.maxTokensOut,
              budget_daily_usd: route.policy.budgetDailyUsd,
              drift_strict: route.policy.driftStrict,
              drift_detection: {
                sensitivity: route.policy.driftSensitivity || 'medium',
              },
              redaction: {
                mode: route.policy.redactionMode,
                patterns: route.policy.redactionPatterns,
              },
            },
          }
        : {}),
      ...(route.retries
        ? {
            retries: {
              max_attempts: route.retries.maxAttempts,
              base_ms: route.retries.baseMs,
              jitter: route.retries.jitter,
              retry_on: route.retries.retryOn,
              max_elapsed_ms: route.retries.maxElapsedMs,
            },
          }
        : {}),
      ...(route.cache
        ? {
            cache: {
              enabled: route.cache.enabled,
              mode: 'exact' as const,
              ttl_ms: route.cache.ttlMs,
              max_entries: route.cache.maxEntries,
              include_params: route.cache.includeParams,
            },
          }
        : {}),
      ...(route.webhook
        ? {
            webhook: {
              url: route.webhook.url,
              secret_ref: route.webhook.secretRef,
            },
          }
        : {}),
    };

    return routeSpec;
  });

  const services: ServiceSpec[] = answers.services.map((service) => ({
    label: service.label,
    tenant: answers.tenantName,
    allowed_routes: service.allowedRoutes,
    parapet_token_ref: service.tokenRef,
  }));

  return {
    version: 1,
    tenants,
    routes,
    services,
  };
}

function generateYaml(spec: ParapetSpec): string {
  const lines: string[] = ['version: 1', ''];

  lines.push('tenants:');
  for (const tenant of spec.tenants) {
    lines.push(`  - name: ${tenant.name}`);
    lines.push(`    spend:`);
    lines.push(`      daily_usd_cap: ${tenant.spend.daily_usd_cap}`);
    if (tenant.notes) {
      lines.push(`    notes: ${tenant.notes}`);
    }
  }
  lines.push('');

  lines.push('routes:');
  for (const route of spec.routes) {
    lines.push(`  - name: ${route.name}`);
    lines.push(`    tenant: ${route.tenant}`);
    lines.push(`    provider:`);
    lines.push(`      type: ${route.provider.type}`);
    lines.push(`      model: ${route.provider.model}`);
    if (route.provider.endpoint_type) {
      lines.push(`      endpoint_type: ${route.provider.endpoint_type}`);
    }
    if (route.provider.provider_key_ref) {
      lines.push(`      provider_key_ref: ${route.provider.provider_key_ref}`);
    }
    if (route.provider.endpoint) {
      lines.push(`      endpoint: ${route.provider.endpoint}`);
    }
    if (route.provider.default_params) {
      lines.push(`      default_params:`);
      for (const [key, value] of Object.entries(route.provider.default_params)) {
        if (typeof value === 'string') {
          lines.push(`        ${key}: "${value}"`);
        } else {
          lines.push(`        ${key}: ${value}`);
        }
      }
    }

    if (route.policy) {
      lines.push(`    policy:`);
      lines.push(`      max_tokens_in: ${route.policy.max_tokens_in}`);
      lines.push(`      max_tokens_out: ${route.policy.max_tokens_out}`);
      lines.push(`      budget_daily_usd: ${route.policy.budget_daily_usd}`);
      lines.push(`      drift_strict: ${route.policy.drift_strict}`);
      if (route.policy.drift_detection) {
        lines.push(`      drift_detection:`);
        if (route.policy.drift_detection.sensitivity) {
          lines.push(`        sensitivity: ${route.policy.drift_detection.sensitivity}`);
        }
        if (route.policy.drift_detection.cost_anomaly_threshold !== undefined) {
          lines.push(`        cost_anomaly_threshold: ${route.policy.drift_detection.cost_anomaly_threshold}`);
        }
      }
      lines.push(`      redaction:`);
      lines.push(`        mode: ${route.policy.redaction.mode}`);
      lines.push(`        patterns: [${route.policy.redaction.patterns.map((p) => `"${p}"`).join(', ')}]`);
    }

    if (route.retries) {
      lines.push(`    retries:`);
      lines.push(`      max_attempts: ${route.retries.max_attempts}`);
      lines.push(`      base_ms: ${route.retries.base_ms}`);
      lines.push(`      jitter: ${route.retries.jitter}`);
      lines.push(`      retry_on: [${route.retries.retry_on.join(', ')}]`);
      lines.push(`      max_elapsed_ms: ${route.retries.max_elapsed_ms}`);
    }

    if (route.cache) {
      lines.push(`    cache:`);
      if (route.cache.enabled !== undefined) {
        lines.push(`      enabled: ${route.cache.enabled}`);
      }
      if (route.cache.mode) {
        lines.push(`      mode: ${route.cache.mode}`);
      }
      if (route.cache.ttl_ms !== undefined) {
        lines.push(`      ttl_ms: ${route.cache.ttl_ms}`);
      }
      if (route.cache.max_entries !== undefined) {
        lines.push(`      max_entries: ${route.cache.max_entries}`);
      }
      if (route.cache.include_params !== undefined) {
        lines.push(`      include_params: ${route.cache.include_params}`);
      }
    }

    if (route.webhook) {
      lines.push(`    webhook:`);
      lines.push(`      url: "${route.webhook.url}"`);
      lines.push(`      secret_ref: ${route.webhook.secret_ref}`);
      if (route.webhook.include_prompt_snippet !== undefined) {
        lines.push(`      include_prompt_snippet: ${route.webhook.include_prompt_snippet}`);
      }
      if (route.webhook.events) {
        lines.push(`      events:`);
        if (route.webhook.events.policy_decisions !== undefined) {
          lines.push(`        policy_decisions: ${route.webhook.events.policy_decisions}`);
        }
        if (route.webhook.events.request_errors !== undefined) {
          lines.push(`        request_errors: ${route.webhook.events.request_errors}`);
        }
        if (route.webhook.events.provider_errors !== undefined) {
          lines.push(`        provider_errors: ${route.webhook.events.provider_errors}`);
        }
      }
    }
  }
  lines.push('');

  lines.push('services:');
  for (const service of spec.services) {
    lines.push(`  - label: ${service.label}`);
    lines.push(`    tenant: ${service.tenant}`);
    lines.push(`    allowed_routes: [${service.allowed_routes.map((r) => r).join(', ')}]`);
    lines.push(`    parapet_token_ref: ${service.parapet_token_ref}`);
  }

  return lines.join('\n');
}

