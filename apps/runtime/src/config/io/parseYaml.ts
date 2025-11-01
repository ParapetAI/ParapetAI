import fs from "node:fs/promises";
import { parse as parseYamlString } from "yaml";
import type { ParapetSpec } from "../spec/types";

export async function loadParapetSpecFromFile(filePath: string): Promise<ParapetSpec> {
  const raw: string = await fs.readFile(filePath, { encoding: "utf8" });
  const parsed: unknown = parseYamlString(raw);
  return parsed as ParapetSpec;
}
