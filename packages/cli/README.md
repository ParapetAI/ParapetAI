# @parapetai/cli

Command-line interface for building encrypted ParapetAI bootstrap configurations from YAML files.

## Installation

```bash
npm install -g @parapetai/cli
```

Or use with `npx`:

```bash
npx @parapetai/cli build-config
```

## Usage

### Build Config

Build an encrypted bootstrap configuration from a YAML file:

```bash
parapetai build-config [options]
```

**Options:**

- `-f, --file <path>` - Path to YAML config file (default: `parapet.yaml`)
- `-o, --out <path>` - Write environment variables to a file (e.g., `.env`)
- `--non-interactive` - Fail instead of prompting for missing secrets
- `--silent` - Suppress non-error logs

**Examples:**

```bash
# Build from default parapet.yaml and output to console
parapetai build-config

# Build from custom file and write to .env
parapetai build-config --file my-config.yaml --out .env

# Non-interactive mode (fails if secrets are missing)
parapetai build-config --non-interactive
```

## What It Does

The `build-config` command:

1. **Loads and parses** your `parapet.yaml` configuration file
2. **Validates** the configuration structure and rules
3. **Resolves secrets** from environment variables or prompts interactively:
   - Looks for environment variables matching secret references
   - Supports `ENV:VARIABLE_NAME` syntax
   - Falls back to `PARAPET_*` prefixed variables
   - Prompts for missing secrets (unless `--non-interactive` is used)
4. **Generates service tokens** for each service in your configuration
5. **Encrypts** the hydrated configuration into a bootstrap blob
6. **Outputs** environment variables:
   - `PARAPET_MASTER_KEY` - Master encryption key
   - `PARAPET_BOOTSTRAP_STATE` - Encrypted configuration blob
   - `PARAPET_BOOTSTRAP_VERSION` - Configuration version
   - `PARAPET_BOOTSTRAP_TIMESTAMP` - Build timestamp
   - `PARAPET_SERVICE_<LABEL>_TOKEN` - Service authentication tokens

## Configuration File

The CLI reads a YAML file (default: `parapet.yaml`) that defines:

- **Tenants** - Organizations with spending limits
- **Routes** - API endpoints with provider configuration, policies, and retry settings
- **Services** - Applications that can access specific routes via bearer tokens

See the [ParapetAI documentation](https://parapetai.com) for the complete YAML schema.

## Output

By default, the command outputs the master key and bootstrap state to stdout. Use `--out` to write all environment variables to a file:

```bash
parapetai build-config --out .env
```

This creates a `.env` file that can be used with the ParapetAI runtime:

```bash
docker run --env-file .env parapetai/parapetai-runtime:latest
```

## Error Handling

The CLI validates your configuration and will report errors for:

- Invalid YAML syntax
- Missing required fields
- Invalid configuration values
- Ambiguous routing (multiple routes exposing the same model/endpoint)
- Missing secrets (unless `--non-interactive` is used)

## See Also

- [ParapetAI Documentation](https://parapetai.com)
- [@parapetai/config-core](../libs/config-core/README.md) - Core configuration library

