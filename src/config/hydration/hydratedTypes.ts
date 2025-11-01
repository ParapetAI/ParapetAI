import type { ParapetSpec } from "../spec/types";

export interface HydratedConfig extends ParapetSpec {
  readonly secrets?: Readonly<Record<string, string>>;
  readonly checksums?: Readonly<Record<string, string>>;
}
