import { runBuildConfig } from "./commands/build-config";

function printUsage(): void {
  // prettier-ignore
  console.log("Usage: parapet <command>\n\nCommands:\n  build-config   Build hydrated config blob\n");
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case "build-config": {
      await runBuildConfig(rest);
      return 0;
    }
    case "-h":
    case "--help":
    case undefined: {
      printUsage();
      return 0;
    }
    default: {
      // prettier-ignore
      console.error(`Unknown command: ${command}`);
      printUsage();
      return 1;
    }
  }
}

main(process.argv.slice(2)).then((code) => {
  if (code !== 0) {
    process.exitCode = code;
  }
}).catch((err) => {
  // prettier-ignore
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});

