import fs from "node:fs/promises";
import type { ParapetSpec } from "@parapetai/parapet/config/spec/types";
import { loadParapetSpecFromFile } from "@parapetai/parapet/config/io/parseYaml";
import { validateSpec } from "@parapetai/parapet/config/spec/validate";
import { resolveRefs } from "@parapetai/parapet/config/hydration/resolveRefs";
import { encryptHydratedConfigToBlob, generateMasterKey, validateAndNormalizeMasterKey } from "@parapetai/parapet/config/crypto/blobEncrypt";
import { computeConfigChecksum } from "@parapetai/parapet/config/crypto/checksum";

interface BuildArgs {
  readonly configPath: string;
  readonly outPath?: string;
  readonly prompt: boolean;
}

function parseArgs(args: readonly string[]): BuildArgs {
  let configPath: string | undefined;
  let outPath: string | undefined;
  let prompt = true;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--config") {
      configPath = args[++i];
    } else if (a.startsWith("--config=")) {
      configPath = a.slice("--config=".length);
    } else if (a === "--out") {
      outPath = args[++i];
    } else if (a.startsWith("--out=")) {
      outPath = a.slice("--out=".length);
    } else if (a === "--no-prompt") {
      prompt = false;
    }
  }
  if (!configPath) throw new Error("--config <path> is required");
  return { configPath, outPath, prompt };
}

export async function runBuildConfig(args: readonly string[]): Promise<void> {
  const { configPath, outPath, prompt } = parseArgs(args);
  const spec: ParapetSpec = await loadParapetSpecFromFile(configPath);
  const result = validateSpec(spec);
  if (!result.ok) {
    // prettier-ignore
    console.error("Validation failed:\n" + result.issues.map((i) => ` - ${i.path}: ${i.message}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  const hydrated = await resolveRefs(spec, { prompt });
  let masterKey = validateAndNormalizeMasterKey(process.env.PARAPET_MASTER_KEY);
  if (!masterKey) masterKey = generateMasterKey();
  const blob = encryptHydratedConfigToBlob(hydrated, masterKey);
  const checksum = computeConfigChecksum(hydrated);

  let lines = [`PARAPET_MASTER_KEY=${masterKey}`, `PARAPET_BOOTSTRAP_STATE=${blob}`];
  for (const service of hydrated.services) {
    lines.push(`PARAPET_SERVICE_TOKEN_${service.label.replace(/-/g, "_").toUpperCase()}=${service.parapet_token}`);
  }

  // prettier-ignore
  console.error(`Hydrated config checksum: ${checksum}`);

  if (outPath) {
    await fs.writeFile(outPath, lines.join("\n"), { encoding: "utf8" });
  } else {
    console.log(lines.join("\n=================================\n"));
  }
}

export async function buildConfig(spec: ParapetSpec): Promise<string> {
  const hydrated = await resolveRefs(spec, { prompt: false });
  const masterKey = generateMasterKey();
  const blob = encryptHydratedConfigToBlob(hydrated, masterKey);
  return blob;
}

