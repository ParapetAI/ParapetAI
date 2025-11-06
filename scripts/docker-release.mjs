#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

const isMultiArch = process.argv.includes('--multiarch');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const pkg = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf8'));
const version = pkg?.version;
if (!version) {
  console.error('Failed to read version from package.json');
  process.exit(1);
}

const image = 'parapetai/parapetai-runtime';
const dockerfile = resolve(rootDir, 'Dockerfile.runtime');

if (isMultiArch) {
  try {
    run('docker', ['buildx', 'create', '--use', '--name', 'parapetai-multi']);
  } catch (_) {
    // builder may already exist; ignore
  }
  run('docker', [
    'buildx', 'build',
    '--platform', 'linux/amd64,linux/arm64',
    '-f', dockerfile,
    '-t', `${image}:${version}`,
    '-t', `${image}:latest`,
    '--push',
    rootDir,
  ]);
} else {
  run('docker', [
    'build',
    '-f', dockerfile,
    '-t', `${image}:${version}`,
    '-t', `${image}:latest`,
    rootDir,
  ]);
  run('docker', ['push', `${image}:${version}`]);
  run('docker', ['push', `${image}:latest`]);
}


