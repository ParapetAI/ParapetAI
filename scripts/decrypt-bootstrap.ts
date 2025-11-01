import { decryptBlobToHydratedConfig } from "@parapetai/parapet/config/crypto/blobDecrypt";
import path from "path";
import fs from "fs";

function main() {
    const envPath = path.resolve(".env");
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter(line => line.trim() && !line.trim().startsWith("#"))
      .forEach(line => {
        const [key, ...rest] = line.split("=");
        if (key && !(key in process.env)) {
          process.env[key.trim()] = rest.join("=").trim();
        }
      });

    const masterKey = process.env.PARAPET_MASTER_KEY;
    const blob = process.env.PARAPET_BOOTSTRAP_STATE;
  
    if (!masterKey || !blob) {
      console.error("Missing PARAPET_MASTER_KEY or PARAPET_BOOTSTRAP_STATE in env");
      process.exit(1);
    }
  
    const hydratedConfig = decryptBlobToHydratedConfig(blob, masterKey);
  
    // CAUTION: this prints every secret in plaintext
    console.log(JSON.stringify(hydratedConfig, null, 2));
  }
  
  main();


