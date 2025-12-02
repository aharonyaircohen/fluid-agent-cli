#!/usr/bin/env node

import { Command } from 'commander';
import { runCommand } from './runCommand.js';
import { CLIOptions } from '../types/cliTypes.js';
import { buildLogsCommand } from './logs.js';

function recoverNpmArgs(): string[] {
  const raw = process.env.npm_config_argv;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { original?: string[]; cooked?: string[] };
    const sources = [parsed.original, parsed.cooked].filter((a): a is string[] => Array.isArray(a));

    for (const arr of sources) {
      const idxStart = arr.findIndex((v) => v === 'start');
      const idxRun = arr.findIndex((v) => v === 'run');
      const idxLogs = arr.findIndex((v) => v === 'logs');
      const sliceFrom =
        idxStart >= 0
          ? idxStart + 1
          : idxRun >= 0
          ? idxRun + 1
          : idxLogs >= 0
          ? idxLogs
          : 1;
      const recovered = arr.slice(sliceFrom).filter((arg) => arg !== '--');
      if (recovered.length) return recovered;
      // As a last resort, drop the first two entries (npm, script) if present
      if (arr.length > 2) return arr.slice(2).filter((arg) => arg !== '--');
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

const program = new Command();

program
  .name('fluid-agent')
  .description('CLI interface for fluid-agent runtime')
  .version('1.0.0')
  .showHelpAfterError()
  .showSuggestionAfterError()
  .enablePositionalOptions();

// Run command (also set as default)
const run = new Command('run')
  .description('Run a task against a codebase')
  .argument('[taskOrPrompt]', 'Path to task file (JSON or YAML) or prompt text when using --prompt')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('-w, --write', 'Apply changes (default: dry-run mode)', false)
  .option('-y, --yes', 'Apply changes (alias for --write)', false)
  .option('--yaml', 'Force YAML parser for task file', false)
  .option('--no-trace', 'Suppress TRACE output')
  .option('-m, --model <name>', 'Override model')
  .option('-p, --prompt [text]', 'Run an ad-hoc prompt instead of a task file')
  .option('--chat', 'Run prompt in chat mode (no edits, conversational)', false)
  .action(async (taskOrPrompt: string | undefined, options: CLIOptions) => {
    await runCommand(taskOrPrompt, options);
  });

program.addCommand(run, { isDefault: true });
program.addCommand(buildLogsCommand());

program.addHelpText(
  'after',
  `
Examples:
  fluid-agent run task.yaml --write
  fluid-agent -p "Summarize the codebase" --chat
  fluid-agent run --yaml task.without.yaml.ext --write
  fluid-agent logs list --task my-task --status completed --json

Run options:
  -r, --root <path>     Project root directory (default: cwd)
  -w, --write           Apply changes (default: dry-run)
  -y, --yes             Apply changes (alias for --write)
  --yaml                Force YAML parser for task file
  --no-trace            Suppress TRACE output
  -m, --model <name>    Override model
  -p, --prompt [text]   Run an ad-hoc prompt instead of a task file
  --chat                Chat-only mode for --prompt (no edits)

Logs quick reference:
  list    --task <id> [--type ... --status ... --origin ... --stage ... --after ... --before ... --limit ... --json]
  latest  same filters as list (default limit 1)
  show    --run <id> [--events] [--events-limit <n>] [--json]
  events  --run <id> [--level warn,error --source runtime,cli --since <iso> --limit <n> --json]
  get     --run <id> [--artifacts] [--log-events --log-level ... --trace-summary]

Use: fluid-agent run --help   or   fluid-agent logs --help   for full details.
`
);

export async function main(): Promise<void> {
  // If npm swallowed args (e.g., "npm start logs latest"), recover them from npm_config_argv
  const recovered = recoverNpmArgs();
  const argv = recovered.length ? [process.argv[0], process.argv[1], ...recovered] : process.argv;
  await program.parseAsync(argv);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
