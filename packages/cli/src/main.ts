import { Command } from 'commander';
import { buildConfigCommand } from './commands/build-config.js';

export function run(): void {
  const program = new Command();
  program
    .name('parapetai')
    .description('ParapetAI CLI');

  program.addCommand(buildConfigCommand());

  program.parse(process.argv);
}

// Run when executed directly (CommonJS safe)
// prettier-ignore
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  run();
}


