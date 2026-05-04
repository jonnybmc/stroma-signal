// TTY + interactive-environment detection. Used to:
//   - Disable color when NO_COLOR / FORCE_COLOR=0 / non-TTY
//   - Auto-disable telemetry in CI / piped-stdin contexts (the user
//     can't meaningfully consent to a prompt that won't render)
//
// All readers wrap process.* so tests can inject a fake env.

export interface TtyEnv {
  isStdoutTty: boolean;
  isStdinTty: boolean;
  isCi: boolean;
  noColor: boolean;
  forceColor: boolean;
}

export function readTtyEnv(
  env: NodeJS.ProcessEnv = process.env,
  stdout: { isTTY?: boolean } = process.stdout,
  stdin: { isTTY?: boolean } = process.stdin
): TtyEnv {
  return {
    isStdoutTty: Boolean(stdout.isTTY),
    isStdinTty: Boolean(stdin.isTTY),
    isCi: env.CI === 'true' || env.CI === '1',
    noColor: typeof env.NO_COLOR === 'string' && env.NO_COLOR.length > 0,
    forceColor: env.FORCE_COLOR === '1' || env.FORCE_COLOR === '2' || env.FORCE_COLOR === '3'
  };
}

export function isInteractive(env: TtyEnv = readTtyEnv()): boolean {
  // We're interactive only if BOTH stdin and stdout are TTYs and we're
  // not in a CI environment. CI auto-disables prompts even if a TTY is
  // mistakenly attached.
  if (env.isCi) return false;
  return env.isStdoutTty && env.isStdinTty;
}

export function shouldUseColor(env: TtyEnv = readTtyEnv()): boolean {
  // FORCE_COLOR overrides everything (lets tests + screenshot scripts
  // force color in non-TTY contexts).
  if (env.forceColor) return true;
  // NO_COLOR is the standard opt-out (https://no-color.org).
  if (env.noColor) return false;
  // Otherwise color follows stdout TTY.
  return env.isStdoutTty;
}
