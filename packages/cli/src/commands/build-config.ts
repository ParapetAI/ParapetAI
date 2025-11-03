import { Command } from 'commander';
import {
  loadParapetSpecFromFile,
  validateSpec,
  resolveRefs,
  encryptHydratedConfigToBlob,
  generateMasterKey,
  type ParapetSpec,
  type RouteSpec,
  type ValidationIssue,
} from '@parapetai/config-core';
import { promptSecret } from '../secretsources/promptSource.js';
import fs from 'node:fs/promises';

export function buildConfigCommand(): Command {
    const cmd = new Command('build-config')
        .description('Build encrypted ParapetAI bootstrap from YAML')
        .option('-f, --file <path>', 'Path to YAML config', 'parapet.yaml')
        .option('--non-interactive', 'Fail instead of prompting for missing secrets', false)
        .option('--silent', 'Suppress non-error logs', false)
        .option('-o, --out <path>', 'Write env vars to file (e.g., .env)')
        .action(async (opts: { file: string; nonInteractive?: boolean; silent?: boolean; out?: string }) => {
            try {
                const nonInteractive: boolean = opts.nonInteractive === true;
                const silent: boolean = opts.silent === true;

                const spec: ParapetSpec = await loadParapetSpecFromFile(opts.file);

                // Basic structural validation
                const validation = validateSpec(spec);
                if (!validation.ok) {
                    const messages = validation.issues.map((i: ValidationIssue) => `${i.path}: ${i.message}`).join('\n');
                    throw new Error(`Invalid parapet.yaml:\n${messages}`);
                }

                if (!Array.isArray(spec.tenants) || spec.tenants.length === 0) {
                    throw new Error('At least one tenant is required');
                }
                if (!Array.isArray(spec.services) || spec.services.length === 0) {
                    throw new Error('At least one service is required');
                }

                // Ambiguity check: for each service, same model+endpoint_type exposed by multiple allowed routes
                const routeByName = new Map<string, RouteSpec>();
                for (const route of spec.routes) routeByName.set(route.name, route);
                for (const service of spec.services) {
                    const seen = new Set<string>();
                    for (const routeName of service.allowed_routes) {
                        const route = routeByName.get(routeName);
                        if (!route) continue; // validateSpec already ensures existence
                        const endpointType = route.provider.endpoint_type ?? 'chat_completions';
                        const key = `${endpointType}::${route.provider.model}`;
                        if (seen.has(key)) {
                            throw new Error(`Ambiguous routing for service ${service.label}: multiple routes expose model ${route.provider.model} (${endpointType})`);
                        }
                        seen.add(key);
                    }
                }

                const interactive = !nonInteractive;
                const hydrated = await resolveRefs(spec, {
                    prompt: interactive,
                    envGetter: (name: string) => process.env[name],
                    promptFn: interactive ? (label: string) => promptSecret(label) : undefined,
                });

                const masterKey = generateMasterKey();
                const blob = encryptHydratedConfigToBlob(hydrated, masterKey);

                let lines = [`PARAPET_MASTER_KEY=${masterKey}`, `PARAPET_BOOTSTRAP_STATE=${blob}`, `PARAPET_BOOTSTRAP_VERSION=${spec.version}`, `PARAPET_BOOTSTRAP_TIMESTAMP=${new Date().toISOString()}`];

                for (const service of hydrated.services) {
                    lines.push(`PARAPET_SERVICE_${service.label.replace(/-/g, '_').toUpperCase()}_TOKEN=${service.parapet_token}`);
                }
                
                if (opts.out && opts.out.length > 0) {
                    if (!silent) console.log(`Writing env vars to ${opts.out}`);
                    await fs.writeFile(opts.out, lines.join('\n') + '\n', { encoding: 'utf8' });
                } else {
                    // prettier-ignore
                    console.log(lines[0]);
                    // prettier-ignore
                    console.log(lines[1]);
                }
            } catch (error) {
                console.error(`Something went wrong while building the config: ${error instanceof Error ? error.message : 'Unknown error'}`);
                process.exit(1);
            }
        });
    return cmd;
}


