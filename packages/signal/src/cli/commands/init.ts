// `signal init` — the install wizard command.
//
// Linear flow (each step is a function below; orchestrated by run()):
//   1. parseArgs       — flag matrix per the plan's "Non-interactive
//                         mode" section.
//   2. resolveFramework — detect from CWD package.json OR honour
//                         --framework override OR fallback to vanilla.
//   3. resolveSink      — honour --sink OR prompt; conditional 4th
//                         beacon-endpoint prompt only when sink=beacon.
//   4. resolveSampleRate — honour --sample-rate OR prompt.
//   5. checkInstall     — Step 0 panel when @stroma-labs/signal is NOT
//                         in CWD's deps (P2-1 fix).
//   6. render           — pull snippet from matrix, substitute inputs.
//   7. emit             — pretty-printed wizard chrome (panels + snippet
//                         block + outro) OR --json single-line.
//
// Telemetry (Phase D.3): emit lifecycle events at steps 1 (install_started),
// 2 (install_framework_picked), 7 (install_completed), and on any
// thrown error (install_error). Not wired in this commit — comes in D.3.

import { isAbsolute, resolve as resolvePath } from 'node:path';

import { detectFrameworks, type FrameworkCandidate, type FrameworkId, vanillaCandidate } from '../detect/framework.js';
import { detectMonorepo, mergedDeps, readPackageJson } from '../detect/package-json.js';
import { detectPackageManager, type PackageManager } from '../detect/package-manager.js';
import { findSnippet, SUPPORTED_FRAMEWORKS_IN_MATRIX } from '../snippets/matrix.js';
import { renderSnippet } from '../snippets/render-snippet.js';
import type { SinkChoice } from '../snippets/types.js';
import { c, configureColor } from '../ui/ansi.js';
import { bullet, info, intro, outro } from '../ui/panels.js';
import { input, select } from '../ui/prompts.js';
import { snippetBlock } from '../ui/snippet-block.js';
import { isInteractive, readTtyEnv, shouldUseColor } from '../util/tty.js';

export interface InitArgs {
  framework?: FrameworkId;
  sink?: SinkChoice;
  sampleRate?: number;
  beaconEndpoint?: string;
  cwd: string;
  yes: boolean;
  json: boolean;
  noTelemetry: boolean;
  noClipboard: boolean; // (no-op in v1 — clipboard deferred per plan)
  verbose: boolean;
  skipInstallCheck: boolean;
  help: boolean;
  version: boolean;
}

export interface InitJsonOutput {
  framework: FrameworkId;
  framework_version: string | null;
  framework_confidence: 'high' | 'medium' | 'low' | null;
  sink: SinkChoice;
  sample_rate: number;
  package_manager: PackageManager;
  step_zero_install_command: string | null;
  files: Array<{ path: string; action: 'create' | 'modify'; body: string; position?: string }>;
  notes: string[];
  next_steps: string[];
  verified: { against_version: string; last_verified_at: string; upstream_doc_url: string };
  outcome: 'completed' | 'error';
  error?: string;
}

const VALID_FRAMEWORKS = new Set([...SUPPORTED_FRAMEWORKS_IN_MATRIX, 'unknown']);
const VALID_SINKS: SinkChoice[] = ['dataLayer', 'beacon', 'callback'];

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

export function parseInitArgs(argv: readonly string[]): InitArgs {
  const args: InitArgs = {
    cwd: process.cwd(),
    yes: false,
    json: false,
    noTelemetry: false,
    noClipboard: false,
    verbose: false,
    skipInstallCheck: false,
    help: false,
    version: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === undefined) continue;
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined) throw new CliUsageError(`Missing value for ${a}`);
      i += 1;
      return v;
    };
    switch (a) {
      case '--framework': {
        const v = next();
        if (!VALID_FRAMEWORKS.has(v as FrameworkId)) {
          throw new CliUsageError(`Invalid --framework value: ${v}. Valid: ${Array.from(VALID_FRAMEWORKS).join(', ')}`);
        }
        args.framework = v as FrameworkId;
        break;
      }
      case '--sink': {
        const v = next();
        if (!VALID_SINKS.includes(v as SinkChoice)) {
          throw new CliUsageError(`Invalid --sink value: ${v}. Valid: ${VALID_SINKS.join(', ')}`);
        }
        args.sink = v as SinkChoice;
        break;
      }
      case '--sample-rate': {
        const v = next();
        const n = Number.parseFloat(v);
        if (!Number.isFinite(n) || n <= 0 || n > 1) {
          throw new CliUsageError(`Invalid --sample-rate value: ${v}. Must satisfy 0 < n ≤ 1.`);
        }
        args.sampleRate = n;
        break;
      }
      case '--beacon-endpoint':
        args.beaconEndpoint = next();
        break;
      case '--cwd': {
        const v = next();
        args.cwd = isAbsolute(v) ? v : resolvePath(process.cwd(), v);
        break;
      }
      case '-y':
      case '--yes':
        args.yes = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--no-telemetry':
        args.noTelemetry = true;
        break;
      case '--no-clipboard':
        args.noClipboard = true;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--skip-install-check':
        args.skipInstallCheck = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-V':
      case '--version':
        args.version = true;
        break;
      default:
        throw new CliUsageError(`Unknown argument: ${a}`);
    }
  }

  return args;
}

export function pickPrimaryCandidate(
  candidates: FrameworkCandidate[],
  override: FrameworkId | undefined,
  yes: boolean
): { candidate: FrameworkCandidate; needsPrompt: boolean; ambiguous: boolean } {
  if (override) {
    const found = candidates.find((c) => c.id === override);
    if (found) return { candidate: found, needsPrompt: false, ambiguous: false };
    // Override doesn't match any detected candidate — surface as a
    // synthetic high-confidence candidate (operator knows their stack).
    return {
      candidate: {
        id: override,
        versionSpec: null,
        confidence: 'high',
        detectedFrom: ['user override via --framework']
      },
      needsPrompt: false,
      ambiguous: false
    };
  }
  const high = candidates.filter((c) => c.confidence === 'high');
  const firstHigh = high[0];
  if (high.length === 1 && firstHigh) {
    return { candidate: firstHigh, needsPrompt: false, ambiguous: false };
  }
  if (high.length > 1 && firstHigh) {
    return { candidate: firstHigh, needsPrompt: !yes, ambiguous: true };
  }
  // No high-confidence — first candidate (whatever rank) needs confirm
  // unless --yes.
  return { candidate: candidates[0] ?? vanillaCandidate(), needsPrompt: !yes, ambiguous: false };
}

function buildStepZeroInstallCommand(pm: PackageManager): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm add @stroma-labs/signal';
    case 'yarn':
      return 'yarn add @stroma-labs/signal';
    case 'bun':
      return 'bun add @stroma-labs/signal';
    default:
      // npm + unknown fall through to the standard `npm install` form.
      return 'npm install @stroma-labs/signal';
  }
}

function buildNextSteps(sink: SinkChoice): string[] {
  const steps: string[] = [];
  if (sink === 'dataLayer') {
    steps.push(
      'Wire your GA4 dataLayer → GTM tag (~10 minutes):\n  https://github.com/jonnybmc/stroma-signal/blob/main/docs/gtm-recipe.md'
    );
  }
  steps.push(
    'Read operator-expectations before deploying:\n  https://github.com/jonnybmc/stroma-signal/blob/main/docs/operator-expectations.md'
  );
  steps.push(
    'Verify in your destination (~60 seconds after first page load):\n  https://github.com/jonnybmc/stroma-signal/blob/main/docs/launch-troubleshooting.md'
  );
  steps.push('Questions / problems:\n  https://github.com/jonnybmc/stroma-signal/issues');
  return steps;
}

export function printUsage(write: (s: string) => void = (s) => process.stdout.write(s)): void {
  write(`Stroma Signal CLI · signal init

Usage:
  npx @stroma-labs/signal init [options]

Detect your framework, ask a few questions, then print the right snippet.

Options:
  --framework <id>           Override detection (one of: next-app-router,
                             next-pages-router, react-router-v7, remix-v2,
                             nuxt, sveltekit, plain-vue, plain-svelte,
                             plain-react, angular-standalone,
                             angular-ngmodule, vanilla)
  --sink <choice>            Pre-select sink: dataLayer | beacon | callback
  --sample-rate <n>          Pre-set sample rate (0 < n ≤ 1)
  --beacon-endpoint <url>    Required when --sink beacon
  --cwd <path>               Override working directory (default: cwd)
  --yes, -y                  Accept all defaults — no prompts
  --json                     Single-line JSON output to stdout (chrome to stderr)
  --no-telemetry             Disable install telemetry for this run
  --no-clipboard             Disable clipboard copy (clipboard deferred to v0.2)
  --verbose                  Print detection evidence + telemetry status
  --help, -h                 Print this usage
  --version, -V              Print CLI version

Privacy:
  - We capture: framework, sink, Node + pkg-mgr versions, OS family.
  - We NEVER capture: project name, paths, file contents, free text,
    emails, hostnames, or User-Agent.
  - Disable: --no-telemetry, STROMA_TELEMETRY=0, DO_NOT_TRACK=1, or in CI
    (auto-disabled in non-TTY environments).
`);
}

export interface RunDeps {
  /** Override for tests. */
  isInteractive?: () => boolean;
  /** Override for tests — returns the SDK CLI version. */
  cliVersion?: string;
  /** Override for tests — pretend the SDK is/isn't already installed. */
  installedSignalVersionOverride?: string | null;
  /** Override for tests — sink prompt streams. */
  promptStreams?: { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream };
  /** Override for tests — sink of writes. */
  stdout?: { write: (s: string) => void };
  /** Override for tests — error stream. */
  stderr?: { write: (s: string) => void };
}

export async function run(args: InitArgs, deps: RunDeps = {}): Promise<{ exitCode: number; json?: InitJsonOutput }> {
  // Configure color BEFORE any panel render — respects NO_COLOR /
  // FORCE_COLOR / TTY status.
  const ttyEnv = readTtyEnv();
  configureColor(shouldUseColor(ttyEnv));

  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  // In --json mode, all wizard chrome goes to stderr so stdout is
  // pipeable to a JSON consumer.
  const chromeWrite = (s: string): void => {
    if (args.json) stderr.write(s);
    else stdout.write(s);
  };
  const interactive = deps.isInteractive?.() ?? (isInteractive(ttyEnv) && !args.yes && !args.json);

  // ── 1. Parse / validate args (already done by parseInitArgs) ─────
  if (args.help) {
    printUsage((s) => stdout.write(s));
    return { exitCode: 0 };
  }
  if (args.version) {
    stdout.write(`${deps.cliVersion ?? '0.1.0-rc.4'}\n`);
    return { exitCode: 0 };
  }
  if (args.sink === 'beacon' && !args.beaconEndpoint && !interactive) {
    throw new CliUsageError('--sink beacon requires --beacon-endpoint when running non-interactively');
  }

  // ── 2. Read package.json + detect framework ──────────────────────
  const pkgResult = readPackageJson(args.cwd);
  let candidates: FrameworkCandidate[];
  if (pkgResult.corrupt) {
    chromeWrite(
      `${c.yellow('!')} Found a package.json at ${c.dim(pkgResult.path ?? '?')} but couldn't parse it. Falling back to vanilla.\n`
    );
    candidates = [vanillaCandidate()];
  } else if (!pkgResult.pkg) {
    chromeWrite(
      `${c.dim('Note:')} No package.json found walking up from ${c.dim(args.cwd)}. Falling back to vanilla.\n`
    );
    candidates = [vanillaCandidate()];
  } else {
    candidates = detectFrameworks({ pkg: pkgResult.pkg, dir: pkgResult.dir ?? args.cwd });
  }

  const { candidate: detected, needsPrompt, ambiguous } = pickPrimaryCandidate(candidates, args.framework, args.yes);
  const monorepo = pkgResult.dir
    ? detectMonorepo(pkgResult.dir)
    : { isMonorepo: false, workspaceRoot: null, detectedFrom: null };
  const pmDetect = detectPackageManager({ cwd: pkgResult.dir ?? args.cwd });

  if (!args.json) {
    chromeWrite(
      `${intro(`Stroma Signal · signal init`, [
        `Detect your framework, ask a few questions, then print the right snippet.`
      ])}\n`
    );
    const detectedLines = [
      `${c.brand(detected.id)} ${c.dim(`(${detected.confidence} confidence)`)}` +
        (detected.versionSpec ? ` · ${c.dim(detected.versionSpec)}` : '')
    ];
    if (monorepo.isMonorepo) {
      detectedLines.push(`monorepo: ${c.dim(monorepo.detectedFrom ?? 'workspace')}`);
    }
    detectedLines.push(`package manager: ${c.dim(pmDetect.pm)} ${c.dim(`(via ${pmDetect.detectedFrom})`)}`);
    if (args.verbose) {
      for (const line of detected.detectedFrom) detectedLines.push(c.dim(`· ${line}`));
    }
    chromeWrite(`${info('Detected', detectedLines)}\n`);
  }

  let chosenFramework: FrameworkId = detected.id;
  if (interactive && (needsPrompt || ambiguous) && candidates.length > 1) {
    const choice = await select(
      ambiguous ? 'Multiple matches — which framework?' : 'Confirm framework?',
      candidates.map((cand) => ({ value: cand.id as FrameworkId & string, label: `${cand.id} (${cand.confidence})` })),
      { ...deps.promptStreams }
    );
    chosenFramework = choice;
  }

  // ── 3. Sink ──────────────────────────────────────────────────────
  let sink: SinkChoice;
  if (args.sink) sink = args.sink;
  else if (interactive) {
    sink = await select(
      'Where should events go?',
      [
        { value: 'dataLayer', label: 'GA4 / dataLayer' },
        { value: 'beacon', label: 'Your own warehouse (beacon endpoint)' },
        { value: 'callback', label: 'Custom callback (full control)' }
      ],
      { ...deps.promptStreams }
    );
  } else sink = 'dataLayer'; // sane default for --yes mode

  // ── 4. Sample rate + (conditional) beacon endpoint ───────────────
  let sampleRate = args.sampleRate ?? 1.0;
  if (interactive && args.sampleRate === undefined) {
    const raw = await input('Sample rate? (0 < n ≤ 1)', { defaultValue: '1.0', ...deps.promptStreams });
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1) sampleRate = parsed;
  }
  let beaconEndpoint = args.beaconEndpoint;
  if (sink === 'beacon' && !beaconEndpoint) {
    if (interactive) {
      beaconEndpoint = await input('Beacon endpoint URL?', { defaultValue: '/rum/signal', ...deps.promptStreams });
    } else {
      beaconEndpoint = '/rum/signal';
    }
  }

  // ── 5. Step 0 install check ──────────────────────────────────────
  const stepZeroCommand = buildStepZeroInstallCommand(pmDetect.pm);
  let installedVersion: string | null = deps.installedSignalVersionOverride ?? null;
  let needsInstall = false;
  if (!args.skipInstallCheck) {
    if (pkgResult.pkg) {
      const allDeps = mergedDeps(pkgResult.pkg);
      if ('@stroma-labs/signal' in allDeps) {
        installedVersion = allDeps['@stroma-labs/signal'] ?? installedVersion;
      } else {
        needsInstall = true;
      }
    } else {
      // No package.json — vanilla path uses CDN imports anyway, no install needed.
      needsInstall = false;
    }
  }

  // ── 6. Render ────────────────────────────────────────────────────
  const spec = findSnippet(chosenFramework, sink);
  if (!spec) {
    throw new Error(`No snippet matrix entry for ${chosenFramework} × ${sink}`);
  }
  const rendered = renderSnippet(spec, { sampleRate, beaconEndpoint });
  const nextSteps = buildNextSteps(sink);

  // ── 7. Emit ──────────────────────────────────────────────────────
  if (args.json) {
    const json: InitJsonOutput = {
      framework: chosenFramework,
      framework_version: detected.versionSpec,
      framework_confidence: detected.confidence,
      sink,
      sample_rate: sampleRate,
      package_manager: pmDetect.pm,
      step_zero_install_command: needsInstall ? stepZeroCommand : null,
      files: rendered.files.map((f) => ({
        path: f.path,
        action: f.action,
        body: f.body,
        position: f.position
      })),
      notes: rendered.notes,
      next_steps: nextSteps,
      verified: rendered.verified,
      outcome: 'completed'
    };
    stdout.write(`${JSON.stringify(json)}\n`);
    return { exitCode: 0, json };
  }

  // Pretty mode chrome.
  if (needsInstall) {
    chromeWrite(
      `${info('Step 0 — Install Signal (required first)', [
        `${c.brand('@stroma-labs/signal')} is not yet in your project's deps. The wizard ran via npx,`,
        `which fetches the CLI temporarily — your project still needs the package added. Run:`,
        '',
        `  ${c.bold(stepZeroCommand)}`,
        '',
        `Then re-run ${c.dim('npx @stroma-labs/signal init')} to generate snippets that resolve at build time.`
      ])}\n`
    );
  }

  chromeWrite(`${info(`Generated for: ${chosenFramework} · ${sink}`, [])}\n`);
  for (let i = 0; i < rendered.files.length; i += 1) {
    const file = rendered.files[i];
    if (!file) continue;
    const stepNumber = needsInstall ? i + 2 : i + 1;
    const verb = file.action === 'create' ? 'Create' : 'Modify';
    chromeWrite(`${c.dim(`Step ${stepNumber}.`)} ${c.bold(verb)} ${c.brand(file.path)}\n`);
    chromeWrite(`${snippetBlock(file.body)}\n\n`);
  }

  if (rendered.notes.length > 0) {
    chromeWrite(
      `${info(
        'Notes',
        rendered.notes.map((n) => bullet(n))
      )}\n`
    );
  }

  chromeWrite(
    `${outro(
      `You're set. Welcome to Signal.`,
      nextSteps.map((s) => bullet(s))
    )}\n`
  );

  // No-op clipboard reminder (deferred to v0.2 per plan).
  if (!args.noClipboard && interactive) {
    chromeWrite(`${c.dim(`(Clipboard auto-copy ships in v0.2 — copy the snippets above by hand for now.)`)}\n`);
  }
  // Telemetry-disabled note (when telemetry won't fire — Phase D wires
  // the real telemetry decision).
  if (args.noTelemetry || ttyEnv.isCi || !ttyEnv.isStdoutTty) {
    chromeWrite(
      `${c.dim(`· Telemetry disabled (${args.noTelemetry ? '--no-telemetry' : ttyEnv.isCi ? 'CI' : 'non-TTY'})`)}.\n`
    );
  }

  // Quiet mention of installed-signal-version when available (verbose only).
  if (args.verbose && installedVersion) {
    chromeWrite(`${c.dim(`(detected installed @stroma-labs/signal: ${installedVersion})`)}\n`);
  }

  // Quiet recipe-currency disclosure if the detected framework version
  // is ahead of what the recipe was last verified against.
  // (framework_version_ahead_of_recipe computation lives in Phase D.3
  // when telemetry wires in; here we just print a soft note when
  // verbose is on and a major-version mismatch is detected.)
  if (args.verbose) {
    chromeWrite(
      `${c.dim(`(recipe verified ${rendered.verified.last_verified_at} against ${rendered.verified.against_version}; cross-reference ${rendered.verified.upstream_doc_url})`)}\n`
    );
  }

  return { exitCode: 0 };
}
