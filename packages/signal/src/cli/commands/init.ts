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
// Telemetry: lifecycle events at install_started (after detection,
// before any prompt), install_framework_picked (after sink + sample
// rate resolved), install_completed (after output). On thrown error,
// install_error with stage-derived error_category. On user abort
// (AbortError from prompts), install_aborted. Pre-disclosure aborts
// emit ZERO telemetry — see disclosure flow + opt-out.ts.

import { randomUUID } from 'node:crypto';
import { platform as osPlatform } from 'node:os';
import { isAbsolute, resolve as resolvePath } from 'node:path';
import type {
  SignalInstallErrorCategory,
  SignalInstallEventKind,
  SignalInstallEventV1,
  SignalInstallFrameworkConfidence,
  SignalInstallFrameworkVersionSource,
  SignalInstallOsPlatform
} from '@stroma-labs/signal-contracts/install-event';
import { detectFrameworks, type FrameworkCandidate, type FrameworkId, vanillaCandidate } from '../detect/framework.js';
import { readInstalledSignalVersion } from '../detect/installed-version.js';
import { detectMonorepo, mergedDeps, readPackageJson } from '../detect/package-json.js';
import { detectPackageManager, type PackageManager } from '../detect/package-manager.js';
import {
  buildInstallCommandString,
  type RunInstallOptions,
  type RunInstallResult,
  runInstallSignal as runInstallSignalDefault
} from '../install/run-install.js';
import { findSnippet, SUPPORTED_FRAMEWORKS_IN_MATRIX } from '../snippets/matrix.js';
import { RECIPE_CURRENCY as recipeCurrency } from '../snippets/recipe-currency-data.js';
import { renderSnippet } from '../snippets/render-snippet.js';
import type { SinkChoice } from '../snippets/types.js';
import {
  DISCLOSURE_VERSION,
  resolveConfigPath,
  resolveOptOut,
  type TelemetryDecision,
  writeDisclosureConfig
} from '../telemetry/opt-out.js';
import { TelemetryQueue } from '../telemetry/queue.js';
import { c, configureColor } from '../ui/ansi.js';
import { bullet, info, intro, outro } from '../ui/panels.js';
import { AbortError, confirm, input, select } from '../ui/prompts.js';
import { snippetBlock } from '../ui/snippet-block.js';
import { isInteractive, readTtyEnv, shouldUseColor } from '../util/tty.js';
import { CLI_VERSION } from '../util/version.js';

export interface InitArgs {
  framework?: FrameworkId;
  sink?: SinkChoice;
  sampleRate?: number;
  beaconEndpoint?: string;
  cwd: string;
  yes: boolean;
  json: boolean;
  noTelemetry: boolean;
  verbose: boolean;
  /** Pattern 2 default: when @stroma-labs/signal isn't a project dep,
   *  the wizard auto-installs it via the project package manager.
   *  --no-install opts out — wizard prints the install command at the
   *  top of the snippet output and proceeds without touching deps. */
  noInstall: boolean;
  /** Deprecated alias of noInstall, kept for one rc cycle. Setting
   *  either flag is sufficient; both being set is a no-op (same effect
   *  as just one). */
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
  /** Reflects project_pm (lockfile-based) — the axis that drove the
   *  install decision. Not runner_pm, which can be poisoned by npx. */
  package_manager: PackageManager;
  /** Set when the wizard skipped auto-install (--no-install) OR when
   *  auto-install failed; carries the manual command the user can run.
   *  Null when auto-install succeeded (the dep is already there). */
  install_command: string | null;
  /** Deprecated — same value as install_command. Will be removed after
   *  one rc cycle. New consumers should read install_command. */
  step_zero_install_command: string | null;
  /** True when the wizard auto-ran `<pm> add @stroma-labs/signal@<v>`
   *  for the user. False when --no-install opted out OR the dep was
   *  already present. */
  auto_installed: boolean;
  /** Re-read after install completes so the JSON reflects the version
   *  actually on disk. Falls back to cli_version on read failure when
   *  install ran (we know the spec was pinned to that version). */
  installed_signal_version: string | null;
  /** Captured PM stderr (capped 4 KB) when auto_install failed; absent
   *  on success or when --no-install was set. */
  install_error_output?: string;
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
    verbose: false,
    noInstall: false,
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
      case '--verbose':
        args.verbose = true;
        break;
      case '--no-install':
        args.noInstall = true;
        break;
      case '--skip-install-check':
        // Deprecated alias of --no-install. Kept for one rc cycle so
        // anyone scripting against rc.4 doesn't break. Sets BOTH so
        // downstream code only needs to read noInstall.
        args.noInstall = true;
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

function buildPinnedSpec(cliVersion: string): string {
  return `@stroma-labs/signal@${cliVersion}`;
}

/** Pretty install command for prelude / fallback messaging. Shape:
 *  `<pm> add @stroma-labs/signal@<v>`. Always pinned to the running
 *  CLI version so the wizard's snippets cannot drift from the runtime
 *  SDK that gets installed. Delegates to the run-install module so the
 *  spawn path and the printed prelude share one source of truth. */
function buildInstallCommand(pm: PackageManager, cliVersion: string): string {
  return buildInstallCommandString(pm, buildPinnedSpec(cliVersion));
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
  // Premature-pull guard: stop a fresh installer from running the
  // BigQuery URL-builder at N=12 events, generating a thin report,
  // and sharing the URL — first impression of a misleading report
  // burns more trust than waiting a week. The /r cover surfaces a
  // "preliminary" banner when sample_size < 100, but the cheaper
  // gate is to set the expectation here, at the moment of install.
  steps.push(
    'Wait ~5–7 days of real traffic before running the BigQuery URL-builder for a representative report:\n  https://github.com/jonnybmc/stroma-signal/blob/main/docs/first-successful-report.md#8-first-week-reality-check'
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
  --no-install               Skip auto-install of @stroma-labs/signal;
                             print the install command at the top of the
                             snippet output instead (for CI / inspection)
  --no-telemetry             Disable install telemetry for this run
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
  /** Override for tests — fetch impl for telemetry queue. */
  fetch?: typeof globalThis.fetch;
  /** Override for tests — pre-resolved telemetry decision. */
  telemetryDecisionOverride?: TelemetryDecision;
  /** Override for tests — telemetry endpoint URL. */
  telemetryEndpoint?: string;
  /** Override for tests — disclosure prompt result. When set, skips
   *  the interactive `confirm()` call and uses the value directly. */
  disclosurePromptOverride?: () => Promise<boolean>;
  /** Override for tests — disclosure persistence (avoid touching the
   *  user's real config dir). */
  writeDisclosureConfigOverride?: (decision: { telemetry: boolean; disclosure_version: string }) => void;
  /** Override for tests — fakes the spawn that runs `<pm> add
   *  @stroma-labs/signal@<v>`. Default impl uses node:child_process. */
  runInstallSignal?: (opts: RunInstallOptions) => Promise<RunInstallResult>;
}

function osPlatformToEnum(platform: NodeJS.Platform): SignalInstallOsPlatform {
  if (platform === 'linux') return 'linux';
  if (platform === 'darwin') return 'darwin';
  if (platform === 'win32') return 'win32';
  return 'other';
}

function buildEvent(opts: {
  kind: SignalInstallEventKind;
  installCaptureId: string;
  cliVersion: string;
  installedSignalVersion: string | null;
  framework: FrameworkId;
  frameworkVersion: string | null;
  frameworkVersionSource: SignalInstallFrameworkVersionSource;
  frameworkConfidence: SignalInstallFrameworkConfidence;
  frameworkVersionAheadOfRecipe: boolean;
  /** SignalInstallSink — wider than SinkChoice (includes 'undecided'). */
  sink: SinkChoice | 'undecided';
  sampleRate: number | null;
  packageManager: PackageManager;
  outcome?: 'completed' | 'aborted' | 'error';
  errorCategory?: SignalInstallErrorCategory;
  /** Pattern 2 telemetry — true when the wizard auto-ran the install,
   *  false when --no-install opted out OR the dep was already there. */
  autoInstalled?: boolean;
}): SignalInstallEventV1 {
  return {
    v: 1,
    event_kind: opts.kind,
    install_capture_id: opts.installCaptureId,
    event_id: randomUUID(),
    ts: Date.now(),
    cli_version: opts.cliVersion,
    installed_signal_version: opts.installedSignalVersion,
    framework: opts.framework,
    framework_version: opts.frameworkVersion,
    framework_version_source: opts.frameworkVersionSource,
    framework_confidence: opts.frameworkConfidence,
    framework_version_ahead_of_recipe: opts.frameworkVersionAheadOfRecipe,
    sink: opts.sink,
    sample_rate: opts.sampleRate,
    package_manager: opts.packageManager,
    node_version: process.version,
    os_platform: osPlatformToEnum(osPlatform()),
    ...(opts.outcome ? { outcome: opts.outcome } : {}),
    ...(opts.errorCategory ? { error_category: opts.errorCategory } : {}),
    ...(opts.autoInstalled !== undefined ? { auto_installed: opts.autoInstalled } : {})
  };
}

function compareMajor(detectedVersion: string | null, verifiedAgainst: string): boolean {
  if (!detectedVersion) return false;
  // verifiedAgainst examples: 'next@16.2', 'sveltekit@2 + svelte@5', 'angular@21'
  // detectedVersion: '16.2.4' / '7.14.2' / null
  const detectedMajor = Number.parseInt((detectedVersion.match(/^(\d+)/) ?? ['', '0'])[1] ?? '0', 10);
  const verifiedMajor = Number.parseInt((verifiedAgainst.match(/@\s*(\d+)/) ?? ['', '0'])[1] ?? '0', 10);
  if (!Number.isFinite(detectedMajor) || !Number.isFinite(verifiedMajor) || verifiedMajor === 0) {
    return false;
  }
  return detectedMajor > verifiedMajor;
}

/**
 * Wizard stage — updated at every phase boundary so the catch block
 * can attribute a thrown error to a specific user-facing step. Maps to
 * the coarse `error_category` enum on `SignalInstallEventV1` for ingest.
 *
 * `disclosure` is special: errors at this stage emit ZERO telemetry
 * because consent has not yet happened.
 */
export type WizardStage =
  | 'disclosure'
  | 'detection'
  | 'framework_prompt'
  | 'sink_prompt'
  | 'sample_rate_prompt'
  | 'package_install'
  | 'snippet_render'
  | 'output'
  | 'telemetry_flush'
  | 'unknown';

const STAGE_TO_ERROR_CATEGORY: Record<WizardStage, SignalInstallErrorCategory> = {
  disclosure: 'unknown', // unused — disclosure-stage errors never reach the catch block (see invariant in run())
  detection: 'detection_failed',
  framework_prompt: 'prompt_failed',
  sink_prompt: 'prompt_failed',
  sample_rate_prompt: 'prompt_failed',
  package_install: 'package_install_failed',
  snippet_render: 'snippet_render_failed',
  output: 'output_failed',
  telemetry_flush: 'telemetry_flush_failed',
  unknown: 'unknown'
};

function renderDisclosurePanel(
  write: (s: string) => void,
  configPath: string,
  reason: 'first_run' | 'stale_disclosure'
): void {
  const headline =
    reason === 'stale_disclosure'
      ? 'Telemetry disclosure updated — please confirm again'
      : 'Anonymous install telemetry — first-run consent';
  write(
    `${info(headline, [
      `Captured: framework, sink, Node + pkg-mgr versions, OS family.`,
      `Never captured: project name, paths, file contents, free text,`,
      `emails, hostnames, User-Agent.`,
      ``,
      `Disable anytime: --no-telemetry, STROMA_TELEMETRY=0, DO_NOT_TRACK=1.`,
      `Decision saved at: ${c.dim(configPath)}`
    ])}\n`
  );
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
  const cliVersion = deps.cliVersion ?? CLI_VERSION;

  // ── Help / Version short-circuits ─────────────────────────────────
  // No telemetry needed for these read-only paths.
  if (args.help) {
    printUsage((s) => stdout.write(s));
    return { exitCode: 0 };
  }
  if (args.version) {
    stdout.write(`${cliVersion}\n`);
    return { exitCode: 0 };
  }
  if (args.sink === 'beacon' && !args.beaconEndpoint && !interactive) {
    throw new CliUsageError('--sink beacon requires --beacon-endpoint when running non-interactively');
  }

  // ── Telemetry decision + (conditional) disclosure flow ────────────
  // Resolves to one of: { kind: 'enabled' | 'disabled' | 'needs_disclosure' }.
  // On `needs_disclosure`, the wizard renders the panel + prompts the
  // user BEFORE any queue is constructed. If the user aborts the
  // disclosure prompt, ZERO telemetry events are emitted — consent
  // never happened.
  let decision: TelemetryDecision =
    deps.telemetryDecisionOverride ?? resolveOptOut({ noTelemetryFlag: args.noTelemetry, ttyEnv });

  if (decision.kind === 'needs_disclosure') {
    if (interactive) {
      const configPath = resolveConfigPath();
      renderDisclosurePanel(chromeWrite, configPath, decision.reason);
      const promptFn =
        deps.disclosurePromptOverride ??
        ((): Promise<boolean> =>
          confirm('Send anonymous install telemetry?', { defaultYes: true, ...deps.promptStreams }));
      let consented: boolean;
      try {
        consented = await promptFn();
      } catch (err) {
        if (err instanceof AbortError) {
          chromeWrite(`${c.dim('(aborted before consent — no telemetry sent)')}\n`);
          return { exitCode: 130 };
        }
        throw err;
      }
      const writeFn = deps.writeDisclosureConfigOverride ?? writeDisclosureConfig;
      try {
        writeFn({ telemetry: consented, disclosure_version: DISCLOSURE_VERSION });
      } catch (err) {
        // Persistence failure is non-fatal: the wizard continues with
        // the in-memory consent decision for this run, and the next
        // run will re-prompt because the config wasn't persisted.
        if (args.verbose) {
          stderr.write(
            `${c.dim(`(failed to persist disclosure decision: ${err instanceof Error ? err.message : String(err)})`)}\n`
          );
        }
      }
      decision = consented
        ? { kind: 'enabled', reason: 'persisted_config' }
        : { kind: 'disabled', reason: 'persisted_config' };
    } else {
      // Non-interactive surfaced as `needs_disclosure` shouldn't normally
      // occur — `resolveOptOut` already auto-disables on non-TTY/CI. But
      // belt-and-suspenders: never enqueue without explicit consent.
      decision = { kind: 'disabled', reason: 'non_tty_or_ci' };
    }
  }

  // ── Queue construction (post-disclosure) ─────────────────────────
  const isTelemetryEnabled = decision.kind === 'enabled';
  const installCaptureId = randomUUID();
  const telemetry = new TelemetryQueue({
    enabled: isTelemetryEnabled,
    endpoint: deps.telemetryEndpoint ?? process.env.STROMA_INSTALL_INGEST_URL,
    fetch: deps.fetch,
    logger: args.verbose
      ? (msg) => {
          stderr.write(`${c.dim(msg)}\n`);
        }
      : undefined
  });

  // ── Stage tracking + best-known-state snapshot for abort/error ────
  // Updated at every phase boundary so the catch block can emit a
  // meaningful install_aborted / install_error event with the partial
  // state the user reached.
  let stage: WizardStage = 'detection';
  let chosenFramework: FrameworkId = 'unknown';
  let chosenFrameworkVersion: string | null = null;
  let chosenFrameworkVersionSource: SignalInstallFrameworkVersionSource = 'unknown';
  let chosenFrameworkConfidence: SignalInstallFrameworkConfidence = 'low';
  let chosenFrameworkAhead = false;
  let chosenSink: SinkChoice | 'undecided' = 'undecided';
  let chosenSampleRate: number | null = null;
  let chosenPackageManager: PackageManager = 'unknown';
  let installedVersion: string | null = null;
  // Pattern 2 telemetry — true when wizard ran the install, false when
  // --no-install opted out (with dep missing). Stays undefined (omitted
  // from event) when the dep was already declared, so we don't claim
  // credit for an install we didn't run.
  let autoInstalled: boolean | undefined;

  const buildSnapshotEvent = (
    kind: SignalInstallEventKind,
    overrides: { outcome?: 'completed' | 'aborted' | 'error'; errorCategory?: SignalInstallErrorCategory } = {}
  ): SignalInstallEventV1 =>
    buildEvent({
      kind,
      installCaptureId,
      cliVersion,
      installedSignalVersion: installedVersion,
      framework: chosenFramework,
      frameworkVersion: chosenFrameworkVersion,
      frameworkVersionSource: chosenFrameworkVersionSource,
      frameworkConfidence: chosenFrameworkConfidence,
      frameworkVersionAheadOfRecipe: chosenFrameworkAhead,
      sink: chosenSink,
      sampleRate: chosenSampleRate,
      packageManager: chosenPackageManager,
      autoInstalled,
      ...overrides
    });

  try {
    // ── Detection ──────────────────────────────────────────────────
    stage = 'detection';
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

    chosenPackageManager = pmDetect.pm;
    chosenFramework = detected.id;
    chosenFrameworkVersion = detected.versionSpec;
    chosenFrameworkVersionSource = 'spec';
    chosenFrameworkConfidence = detected.confidence;

    // Resolve installed_signal_version from node_modules — distinct
    // from the dep-spec range used for Step-0 detection. M3 fix.
    installedVersion =
      deps.installedSignalVersionOverride !== undefined
        ? deps.installedSignalVersionOverride
        : readInstalledSignalVersion(pkgResult.dir ?? args.cwd);

    // Telemetry: install_started — first event after detection,
    // before any user prompts. Captures node/os/pm so we still see
    // the invocation even if the user aborts before picking anything.
    telemetry.enqueue(
      buildEvent({
        kind: 'install_started',
        installCaptureId,
        cliVersion,
        installedSignalVersion: installedVersion,
        framework: 'unknown',
        frameworkVersion: null,
        frameworkVersionSource: 'unknown',
        frameworkConfidence: 'low',
        frameworkVersionAheadOfRecipe: false,
        sink: 'undecided',
        sampleRate: null,
        packageManager: chosenPackageManager
      })
    );

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

    // M1: ambiguous detection under --yes — emit a stderr warning so
    // CI/screenshot pipelines see when an ambiguous detection was
    // silently auto-resolved. Doesn't change the exit code.
    if (ambiguous && args.yes) {
      const candidateIds = candidates
        .filter((cand) => cand.confidence === 'high')
        .map((cand) => cand.id)
        .join(', ');
      stderr.write(
        `Warning: ambiguous framework detection — picked '${detected.id}' from candidates [${candidateIds}]. ` +
          `Use --framework <id> for deterministic CI/automation.\n`
      );
    }

    if (interactive && (needsPrompt || ambiguous) && candidates.length > 1) {
      stage = 'framework_prompt';
      const choice = await select(
        ambiguous ? 'Multiple matches — which framework?' : 'Confirm framework?',
        candidates.map((cand) => ({
          value: cand.id as FrameworkId & string,
          label: `${cand.id} (${cand.confidence})`
        })),
        { ...deps.promptStreams }
      );
      chosenFramework = choice;
    }

    // ── Sink ───────────────────────────────────────────────────────
    let sink: SinkChoice;
    if (args.sink) sink = args.sink;
    else if (interactive) {
      stage = 'sink_prompt';
      sink = await select(
        'Where should the captured Web Vitals + network/device tier events go?',
        [
          {
            value: 'dataLayer',
            label: 'GA4 / dataLayer',
            hint: 'pushes a perf_tier_report event onto window.dataLayer for GTM → GA4'
          },
          {
            value: 'beacon',
            label: 'Your own warehouse (beacon endpoint)',
            hint: 'POSTs each event to a URL you provide; full SignalEventV1 schema'
          },
          {
            value: 'callback',
            label: 'Custom callback (full control)',
            hint: 'invokes a function you supply with each event — log, sample, branch, anything'
          }
        ],
        { ...deps.promptStreams }
      );
    } else sink = 'dataLayer'; // sane default for --yes mode
    chosenSink = sink;

    // ── Sample rate + (conditional) beacon endpoint ────────────────
    let sampleRate = args.sampleRate ?? 1.0;
    if (interactive && args.sampleRate === undefined) {
      stage = 'sample_rate_prompt';
      const raw = await input('Sample rate? (fraction of page loads to capture)', {
        defaultValue: '1.0',
        hint: '1.0 = every page load · 0.5 = half · 0.1 = 10% · keep at 1.0 unless you exceed ~10M events/month',
        ...deps.promptStreams
      });
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1) {
        sampleRate = parsed;
      } else if (raw !== '' && raw !== '1.0') {
        // M2: surface invalid input rather than silently dropping it.
        stderr.write(`(invalid sample rate "${raw}" — using ${sampleRate})\n`);
      }
    }
    chosenSampleRate = sampleRate;

    let beaconEndpoint = args.beaconEndpoint;
    if (sink === 'beacon' && !beaconEndpoint) {
      if (interactive) {
        stage = 'sample_rate_prompt'; // beacon endpoint shares the prompt stage
        beaconEndpoint = await input('Beacon endpoint URL?', {
          defaultValue: '/rum/signal',
          hint: 'absolute URL or same-origin path that will receive POSTed events (see docs/collector-contract.md for the schema)',
          ...deps.promptStreams
        });
      } else {
        beaconEndpoint = '/rum/signal';
      }
    }

    // ── Install check ──────────────────────────────────────────────
    // Uses the dep SPEC (mergedDeps) — separate concern from
    // `installedVersion` (which reads node_modules for telemetry).
    const installCommand = buildInstallCommand(chosenPackageManager, cliVersion);
    const installSpec = buildPinnedSpec(cliVersion);
    let needsInstall = false;
    if (pkgResult.pkg) {
      const allDeps = mergedDeps(pkgResult.pkg);
      needsInstall = !('@stroma-labs/signal' in allDeps);
    }

    // ── Auto-install (Pattern 2) ───────────────────────────────────
    // Default behaviour: when @stroma-labs/signal isn't a project dep,
    // the wizard auto-runs `<project_pm> add @stroma-labs/signal@<v>`
    // for the user. --no-install opts out and falls through to printing
    // the install command at the top of the snippet output. The spawn
    // cwd MUST be pkgResult.dir (the resolved package root) — args.cwd
    // can differ in monorepos and nested src/ layouts.
    let installError: string | undefined;
    let installFatal = false;
    const runInstall = deps.runInstallSignal ?? runInstallSignalDefault;
    const spawnCwd = pkgResult.dir ?? args.cwd;
    // Treat the deprecated --skip-install-check as a synonym of
    // --no-install at the decision site too, so test inputs that set
    // skipInstallCheck directly (without going through parseInitArgs)
    // behave the same as the canonical flag.
    const installOptOut = args.noInstall || args.skipInstallCheck;
    if (needsInstall && !installOptOut) {
      stage = 'package_install';
      if (!args.json) {
        chromeWrite(
          `${c.dim('· Installing')} ${c.bold(installSpec)} ${c.dim(`via ${chosenPackageManager} in ${spawnCwd}…`)}\n\n`
        );
      }
      const installResult = await runInstall({
        pm: chosenPackageManager,
        spec: installSpec,
        cwd: spawnCwd,
        jsonMode: args.json
      });
      if (installResult.ok) {
        autoInstalled = true;
        // Re-read installed_signal_version so the telemetry +
        // JSON output reflect what's actually on disk now. Falls
        // back to the pinned cliVersion on read failure (we know
        // the install ran for that exact spec).
        const reread = readInstalledSignalVersion(spawnCwd);
        installedVersion = reread ?? cliVersion;
      } else {
        autoInstalled = true; // we DID attempt; the error category captures the failure
        installError = installResult.stderr;
        installFatal = true;
      }
    } else if (needsInstall && installOptOut) {
      autoInstalled = false;
    }

    if (installFatal) {
      // Surface the install failure as a top-level error: emit the
      // install_error telemetry with package_install_failed, print a
      // clear message + manual fallback command, and exit non-zero.
      // Skips snippet rendering — the snippets reference an import
      // that won't resolve, no point printing them.
      stage = 'package_install';
      if (!args.json) {
        chromeWrite(
          `${c.red('✕')} ${c.bold(`${chosenPackageManager} add ${installSpec}`)} ${c.red('failed.')}\n` +
            `${c.dim('Try running it manually:')}\n  ${c.bold(installCommand)}\n\n`
        );
      }
      // Throw so the outer catch builds + emits the install_error
      // event with errorCategory='package_install_failed' (set via
      // the stage→category map).
      throw new Error(installError ? `Install failed: ${installError.trim().slice(0, 500)}` : 'Install failed');
    }

    // ── Render ─────────────────────────────────────────────────────
    stage = 'snippet_render';
    const spec = findSnippet(chosenFramework, sink);
    if (!spec) {
      throw new Error(`No snippet matrix entry for ${chosenFramework} × ${sink}`);
    }
    const rendered = renderSnippet(spec, { sampleRate, beaconEndpoint });
    const nextSteps = buildNextSteps(sink);

    // Telemetry: framework_picked event with the resolved sink + sample
    // rate. Carries the recipe-currency-pressure flag (true when detected
    // framework version major > recipe's verified.against_version major).
    const recipeKey = chosenFramework === 'unknown' ? null : (chosenFramework as keyof typeof recipeCurrency.recipes);
    const recipeMeta = recipeKey ? recipeCurrency.recipes[recipeKey] : null;
    chosenFrameworkAhead = recipeMeta ? compareMajor(detected.versionSpec, recipeMeta.verified_against_version) : false;
    telemetry.enqueue(buildSnapshotEvent('install_framework_picked'));

    // The install_command surfaced in JSON / prelude. Null when:
    //   - the dep was already declared (no install ever needed), or
    //   - auto-install ran successfully (dep is now there)
    // Carries the manual command when --no-install opted out so the
    // user can copy-paste it. (Install-failure path doesn't reach
    // here — it throws above.)
    const surfacedInstallCommand = needsInstall && installOptOut ? installCommand : null;

    // ── Output ─────────────────────────────────────────────────────
    stage = 'output';
    if (args.json) {
      const json: InitJsonOutput = {
        framework: chosenFramework,
        framework_version: detected.versionSpec,
        framework_confidence: detected.confidence,
        sink,
        sample_rate: sampleRate,
        package_manager: chosenPackageManager,
        install_command: surfacedInstallCommand,
        step_zero_install_command: surfacedInstallCommand,
        auto_installed: autoInstalled === true,
        installed_signal_version: installedVersion,
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
      telemetry.enqueue(buildSnapshotEvent('install_completed', { outcome: 'completed' }));
      stage = 'telemetry_flush';
      await telemetry.flush({ timeoutMs: 1500 });
      return { exitCode: 0, json };
    }

    // Pretty mode — when --no-install (or the deprecated alias) is
    // set AND the dep is missing, print a single-line install hint at
    // the top so the user can copy-paste it after reviewing the
    // snippets.
    if (needsInstall && installOptOut) {
      chromeWrite(
        `${info('Install Signal as a project dep first', [
          `${c.brand('@stroma-labs/signal')} is not yet in your project's deps. Run:`,
          '',
          `  ${c.bold(installCommand)}`,
          '',
          `Then paste the snippets below.`
        ])}\n`
      );
    }
    if (args.skipInstallCheck && !args.noInstall) {
      // Only nag when the user explicitly used the deprecated flag
      // (parseInitArgs sets BOTH; flag-direct callers may set just
      // skipInstallCheck — that's the case worth deprecating loudly).
      chromeWrite(
        `${c.yellow('!')} ${c.dim(
          '--skip-install-check is deprecated. Use --no-install (same effect; alias removed in next rc).'
        )}\n\n`
      );
    }

    chromeWrite(`${info(`Generated for: ${chosenFramework} · ${sink}`, [])}\n`);
    for (let i = 0; i < rendered.files.length; i += 1) {
      const file = rendered.files[i];
      if (!file) continue;
      const stepNumber = i + 1;
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

    if (args.noTelemetry || ttyEnv.isCi || !ttyEnv.isStdoutTty) {
      chromeWrite(
        `${c.dim(`· Telemetry disabled (${args.noTelemetry ? '--no-telemetry' : ttyEnv.isCi ? 'CI' : 'non-TTY'})`)}.\n`
      );
    }

    if (args.verbose && installedVersion) {
      chromeWrite(`${c.dim(`(detected installed @stroma-labs/signal: ${installedVersion})`)}\n`);
    }

    if (args.verbose) {
      chromeWrite(
        `${c.dim(`(recipe verified ${rendered.verified.last_verified_at} against ${rendered.verified.against_version}; cross-reference ${rendered.verified.upstream_doc_url})`)}\n`
      );
    }

    telemetry.enqueue(buildSnapshotEvent('install_completed', { outcome: 'completed' }));
    stage = 'telemetry_flush';
    await telemetry.flush({ timeoutMs: 1500 });
    return { exitCode: 0 };
  } catch (err) {
    // CliUsageError bubbles up untouched — it's a user-input issue,
    // not a wizard failure, and the top-level catch in index.ts maps
    // it to exit 2 with a usage hint.
    if (err instanceof CliUsageError) throw err;

    // AbortError from any prompt (post-disclosure) → install_aborted.
    if (err instanceof AbortError) {
      telemetry.enqueue(buildSnapshotEvent('install_aborted', { outcome: 'aborted' }));
      try {
        await telemetry.flush({ timeoutMs: 1500 });
      } catch {
        // Don't let a flush failure escalate the abort to an error.
      }
      return { exitCode: 130 };
    }

    // Any other thrown error → install_error with stage→category mapping.
    const errorCategory = STAGE_TO_ERROR_CATEGORY[stage];
    telemetry.enqueue(buildSnapshotEvent('install_error', { outcome: 'error', errorCategory }));
    try {
      await telemetry.flush({ timeoutMs: 1500 });
    } catch {
      // Drop flush errors — the original error is what matters.
    }
    throw err;
  }
}
