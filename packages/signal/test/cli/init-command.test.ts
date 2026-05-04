// Init command end-to-end tests. Exercises argv parsing, framework
// resolution, sink/sample-rate resolution, Step 0 install detection,
// snippet rendering, and JSON output. Pretty-mode chrome is exercised
// via the smoke (cli.mjs invocation in CI), not here — tests focus on
// the deterministic behaviour.

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CliUsageError, parseInitArgs, pickPrimaryCandidate, run } from '../../src/cli/commands/init.js';
import { vanillaCandidate } from '../../src/cli/detect/framework.js';
import { configureColor } from '../../src/cli/ui/ansi.js';

const tmpDirs: string[] = [];

afterEach(() => {
  // Don't clean tmpDirs aggressively — we want the test runner to
  // leave them in case of failure for triage. macOS tmpdir is
  // periodically swept by the OS.
});

function makeTmpProject(pkgJson: Record<string, unknown>, extraFiles: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'signal-init-test-'));
  tmpDirs.push(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  for (const [path, content] of Object.entries(extraFiles)) {
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

function captureWrites(): { stream: { write: (s: string) => void }; captured: () => string } {
  let buf = '';
  const write = (s: string): void => {
    buf += s;
  };
  return {
    stream: { write },
    captured: () => buf
  };
}

describe('parseInitArgs', () => {
  it('parses an empty arg list to safe defaults', () => {
    const args = parseInitArgs([]);
    expect(args.framework).toBeUndefined();
    expect(args.sink).toBeUndefined();
    expect(args.sampleRate).toBeUndefined();
    expect(args.yes).toBe(false);
    expect(args.json).toBe(false);
    expect(args.noTelemetry).toBe(false);
    expect(args.cwd).toBe(process.cwd());
  });

  it('parses --framework with valid value', () => {
    const args = parseInitArgs(['--framework', 'next-app-router']);
    expect(args.framework).toBe('next-app-router');
  });

  it('rejects --framework with invalid value', () => {
    expect(() => parseInitArgs(['--framework', 'qwik'])).toThrow(CliUsageError);
  });

  it('parses --sink with valid value', () => {
    const args = parseInitArgs(['--sink', 'beacon']);
    expect(args.sink).toBe('beacon');
  });

  it('rejects --sink with invalid value', () => {
    expect(() => parseInitArgs(['--sink', 'webhook'])).toThrow(CliUsageError);
  });

  it('parses --sample-rate within range', () => {
    expect(parseInitArgs(['--sample-rate', '0.5']).sampleRate).toBe(0.5);
    expect(parseInitArgs(['--sample-rate', '1']).sampleRate).toBe(1);
  });

  it('rejects --sample-rate at boundary 0', () => {
    expect(() => parseInitArgs(['--sample-rate', '0'])).toThrow(/0 < n ≤ 1/);
  });

  it('rejects --sample-rate above 1', () => {
    expect(() => parseInitArgs(['--sample-rate', '1.5'])).toThrow(/0 < n ≤ 1/);
  });

  it('parses --beacon-endpoint', () => {
    expect(parseInitArgs(['--beacon-endpoint', '/rum']).beaconEndpoint).toBe('/rum');
  });

  it('parses boolean flags', () => {
    const args = parseInitArgs(['--yes', '--json', '--no-telemetry', '--verbose', '--skip-install-check']);
    expect(args.yes).toBe(true);
    expect(args.json).toBe(true);
    expect(args.noTelemetry).toBe(true);
    expect(args.verbose).toBe(true);
    expect(args.skipInstallCheck).toBe(true);
  });

  it('rejects --no-clipboard (M7: removed for v1; reserved for v0.2 when clipboard ships)', () => {
    expect(() => parseInitArgs(['--no-clipboard'])).toThrow(CliUsageError);
  });

  it('parses short flags (-y, -V, -h)', () => {
    expect(parseInitArgs(['-y']).yes).toBe(true);
    expect(parseInitArgs(['-V']).version).toBe(true);
    expect(parseInitArgs(['-h']).help).toBe(true);
  });

  it('rejects unknown arguments', () => {
    expect(() => parseInitArgs(['--bogus-flag'])).toThrow(CliUsageError);
  });

  it('rejects --framework without a value', () => {
    expect(() => parseInitArgs(['--framework'])).toThrow(/Missing value/);
  });

  it('--cwd resolves relative paths to absolute', () => {
    const args = parseInitArgs(['--cwd', './subdir']);
    expect(args.cwd).toMatch(/^\//);
  });

  it('--cwd preserves absolute paths', () => {
    const args = parseInitArgs(['--cwd', '/tmp/foo']);
    expect(args.cwd).toBe('/tmp/foo');
  });
});

describe('pickPrimaryCandidate', () => {
  const candA = {
    id: 'next-app-router' as const,
    versionSpec: '16.2.4',
    confidence: 'high' as const,
    detectedFrom: ['a']
  };
  const candB = {
    id: 'next-pages-router' as const,
    versionSpec: '16.2.4',
    confidence: 'high' as const,
    detectedFrom: ['b']
  };
  const candMedium = {
    id: 'plain-react' as const,
    versionSpec: '19.0.0',
    confidence: 'medium' as const,
    detectedFrom: ['c']
  };

  it('returns the override when provided + matches a candidate', () => {
    const result = pickPrimaryCandidate([candA, candB], 'next-pages-router', false);
    expect(result.candidate.id).toBe('next-pages-router');
    expect(result.needsPrompt).toBe(false);
  });

  it('returns synthetic candidate when override does not match any detected', () => {
    const result = pickPrimaryCandidate([candA], 'sveltekit', false);
    expect(result.candidate.id).toBe('sveltekit');
    expect(result.candidate.detectedFrom).toEqual(['user override via --framework']);
  });

  it('returns the single high-confidence candidate without prompting', () => {
    const result = pickPrimaryCandidate([candA], undefined, false);
    expect(result.candidate.id).toBe('next-app-router');
    expect(result.needsPrompt).toBe(false);
    expect(result.ambiguous).toBe(false);
  });

  it('returns the first when multiple high-confidence + sets ambiguous', () => {
    const result = pickPrimaryCandidate([candA, candB], undefined, false);
    expect(result.ambiguous).toBe(true);
    expect(result.needsPrompt).toBe(true);
  });

  it('--yes mode skips prompt even when ambiguous', () => {
    const result = pickPrimaryCandidate([candA, candB], undefined, true);
    expect(result.needsPrompt).toBe(false);
  });

  it('falls back to first medium-confidence candidate with prompt', () => {
    const result = pickPrimaryCandidate([candMedium], undefined, false);
    expect(result.candidate.id).toBe('plain-react');
    expect(result.needsPrompt).toBe(true);
  });

  it('returns vanilla candidate when no candidates given', () => {
    const result = pickPrimaryCandidate([], undefined, false);
    expect(result.candidate.id).toBe('vanilla');
  });
});

describe('run() — JSON mode (deterministic)', () => {
  beforeEach(() => {
    configureColor(false);
  });
  afterEach(() => {
    configureColor(true);
  });

  it('emits JSON for vanilla project (no package.json)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'signal-init-vanilla-'));
    tmpDirs.push(dir);
    const stdout = captureWrites();
    const stderr = captureWrites();
    const result = await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      { stdout: stdout.stream, stderr: stderr.stream, isInteractive: () => false }
    );
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(stdout.captured());
    expect(json.framework).toBe('vanilla');
    expect(json.sink).toBe('dataLayer');
    expect(json.outcome).toBe('completed');
  });

  it('emits JSON for next-app-router fixture', async () => {
    const dir = makeTmpProject(
      { name: 'smoke', dependencies: { next: '^16.2.4' } }
      // Marker for app router detection.
    );
    // Create app/ directory marker.
    writeFileSync(join(dir, 'app-marker'), '');
    // Use mkdir to create app dir.
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dir, 'app'));

    const stdout = captureWrites();
    const stderr = captureWrites();
    const result = await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      { stdout: stdout.stream, stderr: stderr.stream, isInteractive: () => false }
    );
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(stdout.captured());
    expect(json.framework).toBe('next-app-router');
    expect(json.framework_confidence).toBe('high');
    expect(json.files.find((f: { path: string }) => f.path === 'app/SignalClient.tsx')).toBeDefined();
  });

  it('--no-install + SDK not in deps → install_command surfaced as the manual command', async () => {
    const dir = makeTmpProject({ name: 'smoke', dependencies: { vue: '^3.4.0' } });
    const stdout = captureWrites();
    const stderr = captureWrites();
    const result = await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        noInstall: true,
        skipInstallCheck: false,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      { stdout: stdout.stream, stderr: stderr.stream, isInteractive: () => false }
    );
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(stdout.captured());
    // Command varies by detected package manager (npm install / pnpm add / yarn add / bun add).
    // Pinned to the running CLI version so wizard/runtime versions can't drift.
    expect(json.install_command).toMatch(/(install|add)\s+@stroma-labs\/signal@/);
    // Deprecated alias still populated for one rc cycle.
    expect(json.step_zero_install_command).toBe(json.install_command);
    expect(json.auto_installed).toBe(false);
  });

  it('auto-install (default Pattern 2) → spawns install via DI, install_command null on success', async () => {
    const dir = makeTmpProject({ name: 'smoke', dependencies: { vue: '^3.4.0' } });
    const stdout = captureWrites();
    const stderr = captureWrites();
    let spawnedSpec: string | null = null;
    let spawnedCwd: string | null = null;
    const result = await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        noInstall: false,
        skipInstallCheck: false,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      {
        stdout: stdout.stream,
        stderr: stderr.stream,
        isInteractive: () => false,
        runInstallSignal: async (opts) => {
          spawnedSpec = opts.spec;
          spawnedCwd = opts.cwd;
          return { ok: true };
        }
      }
    );
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(stdout.captured());
    expect(spawnedSpec).toMatch(/^@stroma-labs\/signal@/);
    expect(spawnedCwd).toBe(dir);
    expect(json.auto_installed).toBe(true);
    // After successful install, install_command should be null (the
    // user doesn't need to run anything by hand).
    expect(json.install_command).toBeNull();
    expect(json.step_zero_install_command).toBeNull();
  });

  it('auto-install failure → exits non-zero, install_error telemetry with package_install_failed', async () => {
    const dir = makeTmpProject({ name: 'smoke', dependencies: { vue: '^3.4.0' } });
    const stdout = captureWrites();
    const stderr = captureWrites();
    await expect(
      run(
        {
          cwd: dir,
          yes: true,
          json: true,
          noTelemetry: true,
          verbose: false,
          noInstall: false,
          skipInstallCheck: false,
          help: false,
          version: false,
          sink: 'dataLayer'
        },
        {
          stdout: stdout.stream,
          stderr: stderr.stream,
          isInteractive: () => false,
          runInstallSignal: async () => ({ ok: false, exitCode: 1, stderr: 'simulated PM failure' })
        }
      )
    ).rejects.toThrow(/Install failed/);
  });

  it('returns null install_command when SDK already in deps (no install ran)', async () => {
    const dir = makeTmpProject({
      name: 'smoke',
      dependencies: { vue: '^3.4.0', '@stroma-labs/signal': '^0.1.0' }
    });
    const stdout = captureWrites();
    const stderr = captureWrites();
    const result = await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        skipInstallCheck: false,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      { stdout: stdout.stream, stderr: stderr.stream, isInteractive: () => false }
    );
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(stdout.captured());
    expect(json.install_command).toBeNull();
    expect(json.step_zero_install_command).toBeNull();
    // Dep was already there, no install action taken — auto_installed
    // should be false (we did not auto-install).
    expect(json.auto_installed).toBe(false);
  });

  it('honours --sample-rate override in JSON output', async () => {
    const dir = makeTmpProject({ name: 'smoke', dependencies: { vue: '^3.4.0' } });
    const stdout = captureWrites();
    const stderr = captureWrites();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer',
        sampleRate: 0.25
      },
      { stdout: stdout.stream, stderr: stderr.stream, isInteractive: () => false }
    );
    const json = JSON.parse(stdout.captured());
    expect(json.sample_rate).toBe(0.25);
    // Verify substitution into the rendered file body.
    expect(json.files[0].body).toContain('0.25');
  });

  it('renders beacon sink with provided endpoint', async () => {
    const dir = makeTmpProject({ name: 'smoke', dependencies: { vue: '^3.4.0' } });
    const stdout = captureWrites();
    const stderr = captureWrites();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'beacon',
        beaconEndpoint: '/perf-collector'
      },
      { stdout: stdout.stream, stderr: stderr.stream, isInteractive: () => false }
    );
    const json = JSON.parse(stdout.captured());
    expect(json.sink).toBe('beacon');
    expect(json.files[0].body).toContain('/perf-collector');
  });

  it('throws CliUsageError when beacon sink in non-interactive mode without endpoint', async () => {
    const dir = makeTmpProject({ name: 'smoke', dependencies: { vue: '^3.4.0' } });
    await expect(
      run(
        {
          cwd: dir,
          yes: true,
          json: true,
          noTelemetry: true,
          verbose: false,
          skipInstallCheck: true,
          help: false,
          version: false,
          sink: 'beacon'
        },
        { isInteractive: () => false }
      )
    ).rejects.toThrow(CliUsageError);
  });

  it('--framework override forces non-detected framework', async () => {
    const dir = makeTmpProject({ name: 'smoke', dependencies: { vue: '^3.4.0' } });
    const stdout = captureWrites();
    const stderr = captureWrites();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        framework: 'sveltekit',
        sink: 'dataLayer'
      },
      { stdout: stdout.stream, stderr: stderr.stream, isInteractive: () => false }
    );
    const json = JSON.parse(stdout.captured());
    expect(json.framework).toBe('sveltekit');
  });
});

describe('vanillaCandidate fallback wiring', () => {
  it('used when no package.json found', () => {
    const candidate = vanillaCandidate();
    expect(candidate.id).toBe('vanilla');
  });

  it('--cwd into a directory without package.json triggers vanilla flow', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'signal-init-empty-'));
    tmpDirs.push(dir);
    const stdout = captureWrites();
    const stderr = captureWrites();
    const result = await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      { stdout: stdout.stream, stderr: stderr.stream, isInteractive: () => false }
    );
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(stdout.captured());
    // Walking up from /tmp/signal-init-empty-XXXX may or may not find
    // a package.json (depends on host). Expect either vanilla OR a
    // valid framework — but NEVER throw.
    expect(json.outcome).toBe('completed');
  });
});

// Prevent unused import lint warning when PassThrough isn't used in
// test paths above (it's reserved for future interactive prompt tests).
void PassThrough;

describe('M1 — ambiguous detection under --yes emits stderr warning', () => {
  it('two high-confidence candidates + --yes → stderr warning surfaced', async () => {
    // Build a fixture with both Next AND React Router v7 deps so the
    // detector returns multiple high-confidence candidates. App-router
    // marker so Next is detected as a high-confidence candidate.
    const dir = makeTmpProject({
      name: 'ambiguous',
      dependencies: { next: '^16.2.4', 'react-router': '^7.0.0' }
    });
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dir, 'app'));
    writeFileSync(join(dir, 'react-router.config.ts'), 'export default {};');

    const stdout = captureWrites();
    const stderr = captureWrites();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      { stdout: stdout.stream, stderr: stderr.stream, isInteractive: () => false }
    );
    const stderrOut = stderr.captured();
    expect(stderrOut).toContain('Warning: ambiguous framework detection');
    expect(stderrOut).toContain('Use --framework <id>');
  });

  it('single high-confidence candidate + --yes → NO warning', async () => {
    const dir = makeTmpProject({ name: 'one-fw', dependencies: { next: '^16.2.4' } });
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dir, 'app'));

    const stdout = captureWrites();
    const stderr = captureWrites();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      { stdout: stdout.stream, stderr: stderr.stream, isInteractive: () => false }
    );
    expect(stderr.captured()).not.toContain('ambiguous framework detection');
  });
});

describe('H1 — abort + error telemetry with stage tracking', () => {
  // We exercise the abort path by injecting a render-stage failure via
  // a synthetic --framework that has no matrix entry. That throws at
  // stage='snippet_render' → install_error w/ snippet_render_failed.
  // For a real abort, the integration test in network-isolation
  // covers the disclosure-pre-consent path; here we focus on the
  // post-consent stage→category mapping.

  it('snippet_render error → install_error with snippet_render_failed category', async () => {
    const dir = makeTmpProject({ name: 'render-fail', dependencies: { next: '^16.2.4' } });
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dir, 'app'));

    const events: Array<{ event_kind: string; outcome?: string; error_category?: string }> = [];
    const fetch = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const body = init?.body ? JSON.parse(init.body as string) : null;
      if (body) events.push(body);
      return new Response(null, { status: 201 });
    };

    const stdout = captureWrites();
    const stderr = captureWrites();
    await expect(
      run(
        {
          cwd: dir,
          yes: true,
          json: true,
          noTelemetry: false,
          verbose: false,
          skipInstallCheck: true,
          help: false,
          version: false,
          // Force a framework × sink combination not in the matrix to
          // throw at the snippet_render stage. 'unknown' is in
          // VALID_FRAMEWORKS but findSnippet returns null for it.
          framework: 'unknown',
          sink: 'dataLayer'
        },
        {
          stdout: stdout.stream,
          stderr: stderr.stream,
          isInteractive: () => false,
          telemetryDecisionOverride: { kind: 'enabled', reason: 'persisted_config' },
          fetch,
          telemetryEndpoint: 'http://127.0.0.1:1/install'
        }
      )
    ).rejects.toThrow(/No snippet matrix entry/);

    const errorEvent = events.find((e) => e.event_kind === 'install_error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.outcome).toBe('error');
    expect(errorEvent?.error_category).toBe('snippet_render_failed');
  });

  it('install_framework_picked fires BEFORE auto-install spawn (so install failures still record framework)', async () => {
    // Regression lock — earlier the framework_picked enqueue lived
    // AFTER the install branch, which meant a failed install (throw
    // from the install path) skipped the framework_picked event
    // entirely. Stats around "which framework had the most install
    // failures?" couldn't correlate. Now framework_picked fires
    // immediately after the prompts resolve, before the install spawn.
    const dir = makeTmpProject({ name: 'fw-before-install', dependencies: { next: '^16.2.4' } });
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dir, 'app'));

    const events: Array<{ event_kind: string; framework?: string }> = [];
    const fetch = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const body = init?.body ? JSON.parse(init.body as string) : null;
      if (body) events.push(body);
      return new Response(null, { status: 201 });
    };

    const stdout = captureWrites();
    const stderr = captureWrites();
    await expect(
      run(
        {
          cwd: dir,
          yes: true,
          json: true,
          noTelemetry: false,
          verbose: false,
          noInstall: false,
          skipInstallCheck: false,
          help: false,
          version: false,
          sink: 'dataLayer'
        },
        {
          stdout: stdout.stream,
          stderr: stderr.stream,
          isInteractive: () => false,
          telemetryDecisionOverride: { kind: 'enabled', reason: 'persisted_config' },
          fetch,
          telemetryEndpoint: 'http://127.0.0.1:1/install',
          runInstallSignal: async () => ({ ok: false, exitCode: 1, stderr: 'simulated PM failure' })
        }
      )
    ).rejects.toThrow(/Install failed/);

    const fwIndex = events.findIndex((e) => e.event_kind === 'install_framework_picked');
    const errIndex = events.findIndex((e) => e.event_kind === 'install_error');
    expect(fwIndex).toBeGreaterThanOrEqual(0);
    expect(errIndex).toBeGreaterThanOrEqual(0);
    expect(fwIndex).toBeLessThan(errIndex);
    // The framework_picked event must carry the resolved framework so
    // downstream stats can group install failures by framework.
    expect(events[fwIndex]?.framework).toBe('next-app-router');
  });

  it('telemetry disabled → NO install_error fires (no emit when queue is no-op)', async () => {
    const dir = makeTmpProject({ name: 'render-fail-no-tel', dependencies: { next: '^16.2.4' } });
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dir, 'app'));

    let fetchCalls = 0;
    const stdout = captureWrites();
    const stderr = captureWrites();
    await expect(
      run(
        {
          cwd: dir,
          yes: true,
          json: true,
          noTelemetry: true,
          verbose: false,
          skipInstallCheck: true,
          help: false,
          version: false,
          framework: 'unknown',
          sink: 'dataLayer'
        },
        {
          stdout: stdout.stream,
          stderr: stderr.stream,
          isInteractive: () => false,
          fetch: async () => {
            fetchCalls += 1;
            return new Response(null, { status: 201 });
          }
        }
      )
    ).rejects.toThrow(/No snippet matrix entry/);
    expect(fetchCalls).toBe(0);
  });
});
