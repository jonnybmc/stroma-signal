// Stroma Signal `signal init` CLI — entry point.
//
// Routes argv to the init command. Single subcommand for v1; future
// commands (e.g. `signal upgrade`, `signal doctor`) plug in here.

import { argv, exit, stderr, stdout } from 'node:process';

import { CliUsageError, parseInitArgs, printUsage, run } from './commands/init.js';

const VERSION = '0.1.0-rc.4';

async function main(rawArgs: readonly string[]): Promise<number> {
  // Top-level arg routing: every flag goes to the init command. We
  // accept `signal init <flags>`, `signal <flags>`, `signal --help`,
  // and `signal --version` as equivalent — a single-command CLI
  // doesn't need a strict subcommand grammar.
  const hadInitSubcommand = rawArgs[0] === 'init';
  const args = hadInitSubcommand ? rawArgs.slice(1) : rawArgs;

  // Top-level fast paths.
  if (args.includes('--version') || args.includes('-V')) {
    stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (args.includes('--help') || args.includes('-h')) {
    printUsage((s) => stdout.write(s));
    return 0;
  }
  // Bare `signal` (no subcommand AND no flags) → show help.
  // `signal init` (with or without flags) → run the wizard interactively;
  // missing inputs are filled by interactive prompts in TTY contexts and
  // by sensible defaults in non-TTY contexts.
  if (!hadInitSubcommand && args.length === 0) {
    printUsage((s) => stdout.write(s));
    return 0;
  }

  let parsed: ReturnType<typeof parseInitArgs>;
  try {
    parsed = parseInitArgs(args);
  } catch (err) {
    if (err instanceof CliUsageError) {
      stderr.write(`Error: ${err.message}\n\n`);
      printUsage((s) => stderr.write(s));
      return 2;
    }
    throw err;
  }

  try {
    const result = await run(parsed, { cliVersion: VERSION });
    return result.exitCode;
  } catch (err) {
    if (err instanceof CliUsageError) {
      stderr.write(`Error: ${err.message}\n`);
      return 2;
    }
    const message = err instanceof Error ? err.message : String(err);
    stderr.write(`Error: ${message}\n`);
    return 1;
  }
}

main(argv.slice(2))
  .then((code) => exit(code))
  .catch((err) => {
    stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    exit(1);
  });
