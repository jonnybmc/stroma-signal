// Install-event telemetry contract for the `signal init` CLI wizard.
// Separate from `SignalEventV1` (browser RUM data) and from
// `SignalReportInteractionV1` (hosted /r reader interaction) because
// the install wizard captures a different consumer (developer at install
// time) with a different lifecycle (one CLI invocation, multiple lifecycle
// events that UPSERT to one row keyed by install_capture_id).
//
// Wire format is the contract. The receiving snapshot-engine module owns
// its own zod validator that mirrors this shape independently; drift is
// caught by `install-event-wire-format-fixtures.json` cross-repo tests.
//
// Privacy: every field captured is justified by a concrete product
// decision named in the plan's "Privacy posture > What we capture" table.
// Fields explicitly NOT on this contract: project name, paths, git
// remote, author email, hostname, IP, file contents, free text,
// full user-agent string. The disclosure copy in the CLI matches this
// exclusion list byte-for-byte (parity test enforces).

export const SIGNAL_INSTALL_EVENT_VERSION = 1 as const;

export type SignalInstallEventKind =
  | 'install_started'
  | 'install_framework_picked'
  | 'install_completed'
  | 'install_aborted'
  | 'install_error';

export type SignalInstallFrameworkId =
  | 'next-app-router'
  | 'next-pages-router'
  | 'react-router-v7'
  | 'remix-v2'
  | 'nuxt'
  | 'sveltekit'
  | 'plain-vue'
  | 'plain-svelte'
  | 'plain-react'
  | 'angular-standalone'
  | 'angular-ngmodule'
  | 'vanilla'
  | 'unknown';

export type SignalInstallSink = 'dataLayer' | 'beacon' | 'callback' | 'undecided';

export type SignalInstallPackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export type SignalInstallOsPlatform = 'linux' | 'darwin' | 'win32' | 'other';

export type SignalInstallFrameworkConfidence = 'high' | 'medium' | 'low';

export type SignalInstallFrameworkVersionSource = 'installed' | 'lockfile' | 'spec' | 'unknown';

export type SignalInstallOutcome = 'completed' | 'aborted' | 'error';

export type SignalInstallErrorCategory =
  | 'detection_failed'
  | 'snippet_render_failed'
  | 'clipboard_failed'
  | 'telemetry_flush_failed'
  | 'unknown';

export interface SignalInstallEventV1 {
  v: typeof SIGNAL_INSTALL_EVENT_VERSION;
  event_kind: SignalInstallEventKind;
  /** UPSERT key — one row per CLI invocation. Same id used across all
   *  lifecycle events for that invocation. The snapshot-engine repository
   *  collapses to one row keyed on this. */
  install_capture_id: string;
  /** Per-event UUID for ingest dedupe. Server stores last_event_id and
   *  rejects duplicates with 200 + { status: 'duplicate' } so retries
   *  don't loop. */
  event_id: string;
  ts: number;
  /** SDK + CLI version (the wizard ships with the SDK so they always agree). */
  cli_version: string;
  /** Detected from CWD's node_modules/@stroma-labs/signal/package.json
   *  when present. Null on a fresh project that hasn't installed the SDK
   *  yet — drives Step 0 install detection telemetry. */
  installed_signal_version: string | null;
  framework: SignalInstallFrameworkId;
  framework_version: string | null;
  framework_version_source: SignalInstallFrameworkVersionSource;
  framework_confidence: SignalInstallFrameworkConfidence;
  /** Set true when detected framework_version major exceeds the recipe's
   *  verified.against_version major. Drives the recipe-currency-pressure
   *  stat used to prioritise quarterly recipe sweeps. */
  framework_version_ahead_of_recipe: boolean;
  sink: SignalInstallSink;
  /** 0 < sample_rate ≤ 1 when set. Null until the user has answered. */
  sample_rate: number | null;
  package_manager: SignalInstallPackageManager;
  /** e.g. 'v22.4.0' — capped at 16 chars by validator. */
  node_version: string;
  os_platform: SignalInstallOsPlatform;
  /** Set only on terminal events (completed / aborted / error). */
  outcome?: SignalInstallOutcome;
  /** Coarse error category when outcome === 'error'. NEVER a stack
   *  trace, NEVER a message — one of a small enum so we can prioritise
   *  bug-fixing without leaking project paths or PII. */
  error_category?: SignalInstallErrorCategory;
}

export const SIGNAL_INSTALL_EVENT_VALID_KINDS: ReadonlySet<SignalInstallEventKind> = new Set([
  'install_started',
  'install_framework_picked',
  'install_completed',
  'install_aborted',
  'install_error'
]);

export const SIGNAL_INSTALL_VALID_FRAMEWORKS: ReadonlySet<SignalInstallFrameworkId> = new Set([
  'next-app-router',
  'next-pages-router',
  'react-router-v7',
  'remix-v2',
  'nuxt',
  'sveltekit',
  'plain-vue',
  'plain-svelte',
  'plain-react',
  'angular-standalone',
  'angular-ngmodule',
  'vanilla',
  'unknown'
]);

export const SIGNAL_INSTALL_VALID_SINKS: ReadonlySet<SignalInstallSink> = new Set([
  'dataLayer',
  'beacon',
  'callback',
  'undecided'
]);

export const SIGNAL_INSTALL_VALID_PACKAGE_MANAGERS: ReadonlySet<SignalInstallPackageManager> = new Set([
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'unknown'
]);

export const SIGNAL_INSTALL_VALID_OS_PLATFORMS: ReadonlySet<SignalInstallOsPlatform> = new Set([
  'linux',
  'darwin',
  'win32',
  'other'
]);

export const SIGNAL_INSTALL_VALID_CONFIDENCES: ReadonlySet<SignalInstallFrameworkConfidence> = new Set([
  'high',
  'medium',
  'low'
]);

export const SIGNAL_INSTALL_VALID_VERSION_SOURCES: ReadonlySet<SignalInstallFrameworkVersionSource> = new Set([
  'installed',
  'lockfile',
  'spec',
  'unknown'
]);

export const SIGNAL_INSTALL_VALID_OUTCOMES: ReadonlySet<SignalInstallOutcome> = new Set([
  'completed',
  'aborted',
  'error'
]);

export const SIGNAL_INSTALL_VALID_ERROR_CATEGORIES: ReadonlySet<SignalInstallErrorCategory> = new Set([
  'detection_failed',
  'snippet_render_failed',
  'clipboard_failed',
  'telemetry_flush_failed',
  'unknown'
]);

// Field-length caps — enforced both at the client (here) and at the server
// validator. Prevents accidental PII storage via truncation OR rejection.
export const SIGNAL_INSTALL_MAX_LENGTH_CLI_VERSION = 32;
export const SIGNAL_INSTALL_MAX_LENGTH_FRAMEWORK_VERSION = 32;
export const SIGNAL_INSTALL_MAX_LENGTH_INSTALLED_SIGNAL_VERSION = 32;
export const SIGNAL_INSTALL_MAX_LENGTH_NODE_VERSION = 16;
export const SIGNAL_INSTALL_MAX_LENGTH_INSTALL_CAPTURE_ID = 64;
export const SIGNAL_INSTALL_MAX_LENGTH_EVENT_ID = 64;

// Per-kind required fields (beyond the base set: v, event_kind,
// install_capture_id, event_id, ts, cli_version, installed_signal_version,
// framework, framework_version, framework_version_source,
// framework_confidence, framework_version_ahead_of_recipe, sink,
// sample_rate, package_manager, node_version, os_platform — note
// `installed_signal_version` and `sample_rate` and `framework_version`
// can be null, which is distinct from absent).
//
// Required-when-present means the field must appear on the wire
// (possibly with a null value) for that kind.
const KIND_REQUIRED_OUTCOME: Record<SignalInstallEventKind, SignalInstallOutcome | null> = {
  install_started: null,
  install_framework_picked: null,
  install_completed: 'completed',
  install_aborted: 'aborted',
  install_error: 'error'
};

const KIND_REQUIRES_ERROR_CATEGORY: Record<SignalInstallEventKind, boolean> = {
  install_started: false,
  install_framework_picked: false,
  install_completed: false,
  install_aborted: false,
  install_error: true
};

/**
 * Lightweight validator — the ingest endpoint and the client emitters
 * share a single source of truth for validity. Returns an array of
 * human-readable issue strings (empty array = valid).
 */
export function explainInstallEventIssues(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) {
    return ['Expected a JSON object matching SignalInstallEventV1.'];
  }
  const v = value as Record<string, unknown>;
  const issues: string[] = [];

  if (v.v !== SIGNAL_INSTALL_EVENT_VERSION) {
    issues.push(`Expected "v" to be ${SIGNAL_INSTALL_EVENT_VERSION}.`);
  }

  const kindValid =
    typeof v.event_kind === 'string' && SIGNAL_INSTALL_EVENT_VALID_KINDS.has(v.event_kind as SignalInstallEventKind);
  if (!kindValid) {
    issues.push('Expected "event_kind" to be a known install event kind.');
  }

  if (typeof v.install_capture_id !== 'string' || v.install_capture_id.length === 0) {
    issues.push('Expected "install_capture_id" to be a non-empty string.');
  } else if (v.install_capture_id.length > SIGNAL_INSTALL_MAX_LENGTH_INSTALL_CAPTURE_ID) {
    issues.push(`Expected "install_capture_id" length ≤ ${SIGNAL_INSTALL_MAX_LENGTH_INSTALL_CAPTURE_ID}.`);
  }

  if (typeof v.event_id !== 'string' || v.event_id.length === 0) {
    issues.push('Expected "event_id" to be a non-empty string.');
  } else if (v.event_id.length > SIGNAL_INSTALL_MAX_LENGTH_EVENT_ID) {
    issues.push(`Expected "event_id" length ≤ ${SIGNAL_INSTALL_MAX_LENGTH_EVENT_ID}.`);
  }

  if (typeof v.ts !== 'number' || !Number.isFinite(v.ts)) {
    issues.push('Expected "ts" to be a finite number.');
  }

  if (typeof v.cli_version !== 'string' || v.cli_version.length === 0) {
    issues.push('Expected "cli_version" to be a non-empty string.');
  } else if (v.cli_version.length > SIGNAL_INSTALL_MAX_LENGTH_CLI_VERSION) {
    issues.push(`Expected "cli_version" length ≤ ${SIGNAL_INSTALL_MAX_LENGTH_CLI_VERSION}.`);
  }

  if (v.installed_signal_version !== null) {
    if (typeof v.installed_signal_version !== 'string' || v.installed_signal_version.length === 0) {
      issues.push('Expected "installed_signal_version" to be a non-empty string or null.');
    } else if (v.installed_signal_version.length > SIGNAL_INSTALL_MAX_LENGTH_INSTALLED_SIGNAL_VERSION) {
      issues.push(
        `Expected "installed_signal_version" length ≤ ${SIGNAL_INSTALL_MAX_LENGTH_INSTALLED_SIGNAL_VERSION}.`
      );
    }
  }

  if (
    typeof v.framework !== 'string' ||
    !SIGNAL_INSTALL_VALID_FRAMEWORKS.has(v.framework as SignalInstallFrameworkId)
  ) {
    issues.push('Expected "framework" to be a known install framework id.');
  }

  if (v.framework_version !== null) {
    if (typeof v.framework_version !== 'string' || v.framework_version.length === 0) {
      issues.push('Expected "framework_version" to be a non-empty string or null.');
    } else if (v.framework_version.length > SIGNAL_INSTALL_MAX_LENGTH_FRAMEWORK_VERSION) {
      issues.push(`Expected "framework_version" length ≤ ${SIGNAL_INSTALL_MAX_LENGTH_FRAMEWORK_VERSION}.`);
    }
  }

  if (
    typeof v.framework_version_source !== 'string' ||
    !SIGNAL_INSTALL_VALID_VERSION_SOURCES.has(v.framework_version_source as SignalInstallFrameworkVersionSource)
  ) {
    issues.push('Expected "framework_version_source" to be one of: installed, lockfile, spec, unknown.');
  }

  if (
    typeof v.framework_confidence !== 'string' ||
    !SIGNAL_INSTALL_VALID_CONFIDENCES.has(v.framework_confidence as SignalInstallFrameworkConfidence)
  ) {
    issues.push('Expected "framework_confidence" to be one of: high, medium, low.');
  }

  if (typeof v.framework_version_ahead_of_recipe !== 'boolean') {
    issues.push('Expected "framework_version_ahead_of_recipe" to be a boolean.');
  }

  if (typeof v.sink !== 'string' || !SIGNAL_INSTALL_VALID_SINKS.has(v.sink as SignalInstallSink)) {
    issues.push('Expected "sink" to be one of: dataLayer, beacon, callback, undecided.');
  }

  if (v.sample_rate !== null) {
    if (typeof v.sample_rate !== 'number' || !Number.isFinite(v.sample_rate)) {
      issues.push('Expected "sample_rate" to be a finite number or null.');
    } else if (v.sample_rate <= 0 || v.sample_rate > 1) {
      issues.push('Expected "sample_rate" to satisfy 0 < n ≤ 1 when set.');
    }
  }

  if (
    typeof v.package_manager !== 'string' ||
    !SIGNAL_INSTALL_VALID_PACKAGE_MANAGERS.has(v.package_manager as SignalInstallPackageManager)
  ) {
    issues.push('Expected "package_manager" to be one of: npm, pnpm, yarn, bun, unknown.');
  }

  if (typeof v.node_version !== 'string' || v.node_version.length === 0) {
    issues.push('Expected "node_version" to be a non-empty string.');
  } else if (v.node_version.length > SIGNAL_INSTALL_MAX_LENGTH_NODE_VERSION) {
    issues.push(`Expected "node_version" length ≤ ${SIGNAL_INSTALL_MAX_LENGTH_NODE_VERSION}.`);
  }

  if (
    typeof v.os_platform !== 'string' ||
    !SIGNAL_INSTALL_VALID_OS_PLATFORMS.has(v.os_platform as SignalInstallOsPlatform)
  ) {
    issues.push('Expected "os_platform" to be one of: linux, darwin, win32, other.');
  }

  // Per-kind outcome consistency.
  if (kindValid) {
    const kind = v.event_kind as SignalInstallEventKind;
    const expectedOutcome = KIND_REQUIRED_OUTCOME[kind];
    if (expectedOutcome === null) {
      // Non-terminal kinds: outcome must be absent.
      if (v.outcome !== undefined) {
        issues.push(`Expected "outcome" to be absent for event_kind "${kind}".`);
      }
    } else {
      // Terminal kinds: outcome must equal the expected value.
      if (v.outcome !== expectedOutcome) {
        issues.push(`Expected "outcome" to be "${expectedOutcome}" for event_kind "${kind}".`);
      }
    }

    if (KIND_REQUIRES_ERROR_CATEGORY[kind]) {
      if (
        typeof v.error_category !== 'string' ||
        !SIGNAL_INSTALL_VALID_ERROR_CATEGORIES.has(v.error_category as SignalInstallErrorCategory)
      ) {
        issues.push(`Expected "error_category" to be a known category for event_kind "${kind}".`);
      }
    } else if (v.error_category !== undefined) {
      issues.push(`Expected "error_category" to be absent for event_kind "${kind}".`);
    }
  }

  return issues;
}

export function isSignalInstallEventV1(value: unknown): value is SignalInstallEventV1 {
  return explainInstallEventIssues(value).length === 0;
}

/**
 * Canonical ingest URL for the install-event telemetry endpoint.
 * Hosted by the stroma-snapshot-engine workspace at
 * `https://api.stroma.design/api/v1/install`.
 *
 * Override via env var `STROMA_INSTALL_INGEST_URL` for local dev against
 * `wrangler dev` or for self-hosted ingest endpoints.
 */
export const SIGNAL_INSTALL_INGEST_URL_DEFAULT = 'https://api.stroma.design/api/v1/install';
