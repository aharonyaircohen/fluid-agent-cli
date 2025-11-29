#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { runCommand } from './runCommand.js';
import { CLIOptions } from '../types/cliTypes.js';

const program = new Command();

program
  .name('fluid-agent')
  .description('CLI interface for fluid-agent runtime')
  .version('1.0.0')
  .showHelpAfterError()
  .showSuggestionAfterError();

program
  .command('run')
  .description('Run a task against a codebase')
  .argument('<taskFile>', 'Path to task file (JSON or YAML)')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('-w, --write', 'Apply changes (default: dry-run mode)', false)
  .option('--no-trace', 'Suppress TRACE output')
  .option('-m, --model <name>', 'Override model')
  .action(async (taskFile: string, options: CLIOptions) => {
    await runCommand(taskFile, options);
  });

export async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

// Run if this is the main module (ESM-compatible check)
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
