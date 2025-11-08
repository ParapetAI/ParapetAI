# @parapetai/config-core

Core library for parsing, validating, and processing ParapetAI configuration files.

## Installation

```bash
npm install @parapetai/config-core
```

## Overview

This package provides the core functionality for working with ParapetAI configuration files:

- **YAML parsing** - Load and parse ParapetAI YAML configuration files
- **Schema validation** - Validate configuration structure and rules
- **Reference resolution** - Resolve secrets and generate tokens
- **Encryption/decryption** - Encrypt and decrypt configuration blobs
- **Type definitions** - TypeScript types for the ParapetAI specification

## Usage

This package is primarily used by the [@parapetai/cli](../packages/cli/README.md) tool. While it can be installed and used directly, it has limited standalone value outside of building ParapetAI tooling.

### Example

```typescript
import {
  loadParapetSpecFromFile,
  validateSpec,
  resolveRefs,
  encryptHydratedConfigToBlob,
  generateMasterKey,
} from '@parapetai/config-core';

// Load and validate a configuration file
const spec = await loadParapetSpecFromFile('parapet.yaml');
const validation = validateSpec(spec);

if (!validation.ok) {
  console.error('Validation errors:', validation.issues);
  return;
}

// Resolve secrets and generate tokens
const hydrated = await resolveRefs(spec, {
  prompt: true,
  envGetter: (name) => process.env[name],
  promptFn: async (label) => {
    // Your custom prompt implementation
    return await promptForSecret(label);
  },
});

// Encrypt the configuration
const masterKey = generateMasterKey();
const blob = encryptHydratedConfigToBlob(hydrated, masterKey);
```

## API

### Configuration Loading

- `loadParapetSpecFromFile(filePath: string): Promise<ParapetSpec>` - Load and parse a YAML file

### Validation

- `validateSpec(spec: ParapetSpec): ValidationResult` - Validate configuration structure

### Reference Resolution

- `resolveRefs(spec: ParapetSpec, options?: ResolveRefsOptions): Promise<HydratedConfig>` - Resolve secrets and generate tokens

### Encryption

- `generateMasterKey(): string` - Generate a master encryption key
- `encryptHydratedConfigToBlob(config: HydratedConfig, masterKey: string): string` - Encrypt configuration to blob
- `decryptBlobToHydratedConfig(blob: string, masterKey: string): HydratedConfig` - Decrypt blob to configuration

### Types

- `ParapetSpec` - Top-level configuration specification
- `TenantSpec` - Tenant configuration
- `RouteSpec` - Route configuration
- `ServiceSpec` - Service configuration
- `HydratedConfig` - Configuration with resolved secrets and tokens

## When to Use This Package

This package is useful if you need to:

- Build custom tooling around ParapetAI configurations
- Programmatically validate or process ParapetAI YAML files
- Integrate ParapetAI configuration into your own build processes

For most users, the [@parapetai/cli](../packages/cli/README.md) tool provides a complete solution for building encrypted configurations.

## See Also

- [@parapetai/cli](../packages/cli/README.md) - Command-line interface (recommended for most users)
- [ParapetAI Documentation](https://parapetai.com)

