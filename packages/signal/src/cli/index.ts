// Stroma Signal `signal init` CLI — entry point.
//
// At Phase C.1 this is a minimal stub that proves the build pipeline
// works end-to-end (Rollup CLI target → dist/cli.mjs with shebang →
// chmod +x → invokable as `node dist/cli.mjs`). The real wizard flow
// lands in Phase C.2 onward (UI primitives, framework detection,
// snippet matrix, telemetry queue).

import { argv, exit } from 'node:process';

const VERSION = '0.1.0-rc.4';

function printUsage(): void {
  // eslint-disable-next-line no-console
  console.log(`Stroma Signal CLI · v${VERSION}

Usage:
  npx @stroma-labs/signal init       Add Signal to your project (interactive wizard)
  npx @stroma-labs/signal --help     Print this usage
  npx @stroma-labs/signal --version  Print the CLI version

The interactive wizard flow ships in Phase C.2+ of the install-wizard plan.
This is the Phase C.1 build-pipeline scaffold.
`);
}

function main(args: readonly string[]): number {
  if (args.includes('--version') || args.includes('-V')) {
    // eslint-disable-next-line no-console
    console.log(VERSION);
    return 0;
  }
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printUsage();
    return 0;
  }
  const command = args[0];
  if (command === 'init') {
    // eslint-disable-next-line no-console
    console.log('signal init: wizard flow lands in Phase C.2+ of the install-wizard plan.');
    return 0;
  }
  // eslint-disable-next-line no-console
  console.error(`Unknown command: ${command}\n`);
  printUsage();
  return 1;
}

const exitCode = main(argv.slice(2));
exit(exitCode);
