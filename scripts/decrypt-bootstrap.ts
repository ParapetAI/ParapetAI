import { decryptBlobToHydratedConfig } from "@parapetai/parapet/config/crypto/blobDecrypt";

function main() {
    const masterKey = '{masterKeyHere}';
    const blob = '{blobHere}';
  
    if (!masterKey || !blob) {
      console.error("Missing PARAPET_MASTER_KEY or PARAPET_BOOTSTRAP_STATE in env");
      process.exit(1);
    }
  
    const hydratedConfig = decryptBlobToHydratedConfig(blob, masterKey);
  
    // CAUTION: this prints every secret in plaintext
    console.log(JSON.stringify(hydratedConfig, null, 2));
  }
  
  main();


