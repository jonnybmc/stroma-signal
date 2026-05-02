// Hand-rolled interactive prompts using node:readline/promises.
// Replaces @clack/prompts to preserve the zero-runtime-deps invariant.
//
// Three primitives — enough for the wizard's flow:
//   - confirm(question, defaultYes)  → boolean
//   - select(question, choices)      → chosen value
//   - input(question, defaultValue?) → trimmed string (may be empty)
//
// Implementation notes:
//   - Uses `readline.createInterface({ input, output })` from
//     `node:readline/promises` so we await `rl.question(...)` directly.
//   - Caller can inject input/output streams for tests; defaults to
//     process.stdin/stdout.
//   - When the runtime is non-interactive (CI / non-TTY), prompts
//     immediately resolve to their default value — never block forever
//     on a CI runner waiting for keypresses that will never arrive.
//   - select() renders choices as a numbered list and accepts either
//     the index (1-based) or the choice's `value` substring match. No
//     arrow-key navigation — that requires raw-mode terminal handling
//     which is fragile across SSH / Windows terminals. The numbered-
//     list pattern is what create-next-app + create-vite use as their
//     non-arrow fallback; we adopt it as the only mode.

import { createInterface } from 'node:readline/promises';
import { isInteractive } from '../util/tty.js';
import { c } from './ansi.js';
import { activePromptHeader } from './panels.js';

export interface PromptStreams {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export interface SelectChoice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface PromptDeps extends PromptStreams {
  /** Override for tests — defaults to the real isInteractive(). */
  isInteractive?: () => boolean;
}

function resolveStreams(deps: PromptDeps): { input: NodeJS.ReadableStream; output: NodeJS.WritableStream } {
  return {
    input: deps.input ?? process.stdin,
    output: deps.output ?? process.stdout
  };
}

function isInteractiveOrDefault(deps: PromptDeps): boolean {
  return deps.isInteractive ? deps.isInteractive() : isInteractive();
}

export async function confirm(question: string, opts: { defaultYes?: boolean } & PromptDeps = {}): Promise<boolean> {
  const defaultYes = opts.defaultYes ?? true;
  if (!isInteractiveOrDefault(opts)) return defaultYes;
  const { input, output } = resolveStreams(opts);
  const rl = createInterface({ input, output });
  try {
    output.write(`${activePromptHeader(question)}\n`);
    const suffix = defaultYes ? c.dim('(Y/n)') : c.dim('(y/N)');
    const answer = (await rl.question(`  ${suffix} `)).trim().toLowerCase();
    if (answer === '') return defaultYes;
    if (answer === 'y' || answer === 'yes') return true;
    if (answer === 'n' || answer === 'no') return false;
    // Unknown response — fall back to default rather than re-prompting
    // (CI-friendly + matches the principle of least frustration).
    return defaultYes;
  } finally {
    rl.close();
  }
}

export async function input(question: string, opts: { defaultValue?: string } & PromptDeps = {}): Promise<string> {
  const defaultValue = opts.defaultValue ?? '';
  if (!isInteractiveOrDefault(opts)) return defaultValue;
  const { input: stream, output } = resolveStreams(opts);
  const rl = createInterface({ input: stream, output });
  try {
    output.write(`${activePromptHeader(question)}\n`);
    const suffix = defaultValue ? c.dim(`[${defaultValue}]`) : '';
    const answer = (await rl.question(`  ${suffix} `)).trim();
    return answer === '' ? defaultValue : answer;
  } finally {
    rl.close();
  }
}

export async function select<T extends string>(
  question: string,
  choices: readonly SelectChoice<T>[],
  opts: { defaultIndex?: number } & PromptDeps = {}
): Promise<T> {
  if (choices.length === 0) {
    throw new Error('select() requires at least one choice');
  }
  const defaultIndex = opts.defaultIndex ?? 0;
  const defaultChoice = choices[defaultIndex] ?? choices[0]!;
  if (!isInteractiveOrDefault(opts)) return defaultChoice.value;
  const { input: stream, output } = resolveStreams(opts);
  const rl = createInterface({ input: stream, output });
  try {
    output.write(`${activePromptHeader(question)}\n`);
    for (let i = 0; i < choices.length; i += 1) {
      const ch = choices[i]!;
      const marker = i === defaultIndex ? c.brand('●') : c.dim('○');
      const hint = ch.hint ? ` ${c.dim('— ' + ch.hint)}` : '';
      output.write(`  ${marker} ${i + 1}. ${ch.label}${hint}\n`);
    }
    const answer = (await rl.question(`  ${c.dim(`[1-${choices.length}, default ${defaultIndex + 1}]`)} `)).trim();
    if (answer === '') return defaultChoice.value;
    const asNumber = Number.parseInt(answer, 10);
    if (Number.isFinite(asNumber) && asNumber >= 1 && asNumber <= choices.length) {
      return choices[asNumber - 1]!.value;
    }
    // Substring match against value or label.
    const lowerAnswer = answer.toLowerCase();
    const match = choices.find(
      (ch) => ch.value.toLowerCase().includes(lowerAnswer) || ch.label.toLowerCase().includes(lowerAnswer)
    );
    if (match) return match.value;
    // Fall back to default — matches the confirm() principle of least
    // frustration (no infinite re-prompt loop).
    return defaultChoice.value;
  } finally {
    rl.close();
  }
}
