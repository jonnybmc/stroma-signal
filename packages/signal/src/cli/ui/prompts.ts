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
//   - select() default mode: arrow-key navigation via raw-mode
//     keypress events (↑/↓ to move, Enter to confirm, Esc / Ctrl-C to
//     cancel). Falls back to a numbered-list input prompt when raw
//     mode isn't supported (piped stdin, some SSH/tmux contexts).

import { createInterface as createReadline, emitKeypressEvents } from 'node:readline';
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

export async function input(
  question: string,
  opts: { defaultValue?: string; hint?: string } & PromptDeps = {}
): Promise<string> {
  const defaultValue = opts.defaultValue ?? '';
  if (!isInteractiveOrDefault(opts)) return defaultValue;
  const { input: stream, output } = resolveStreams(opts);
  const rl = createInterface({ input: stream, output });
  try {
    output.write(`${activePromptHeader(question)}\n`);
    if (opts.hint) {
      output.write(`  ${c.dim(opts.hint)}\n`);
    }
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
  // Prefer arrow-key navigation when stdin supports raw mode (real TTY,
  // most desktop terminals + iTerm + VS Code terminal). Fall back to
  // numbered-list input when raw mode is unavailable (piped stdin,
  // some CI/SSH/tmux contexts) so the wizard never blocks waiting for
  // a keypress event that won't arrive.
  const stdinAsTty = stream as unknown as { isTTY?: boolean; setRawMode?: (mode: boolean) => unknown };
  if (stdinAsTty.isTTY === true && typeof stdinAsTty.setRawMode === 'function') {
    return arrowKeySelect(question, choices, defaultIndex, defaultChoice, stream, output);
  }
  return numberedListSelect(question, choices, defaultIndex, defaultChoice, stream, output);
}

async function numberedListSelect<T extends string>(
  question: string,
  choices: readonly SelectChoice<T>[],
  defaultIndex: number,
  defaultChoice: SelectChoice<T>,
  stream: NodeJS.ReadableStream,
  output: NodeJS.WritableStream
): Promise<T> {
  const rl = createInterface({ input: stream, output });
  try {
    output.write(`${activePromptHeader(question)}\n`);
    for (let i = 0; i < choices.length; i += 1) {
      const ch = choices[i]!;
      const marker = i === defaultIndex ? c.brand('●') : c.dim('○');
      const hint = ch.hint ? ` ${c.dim(`— ${ch.hint}`)}` : '';
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

// ANSI cursor controls used by arrow-key select to redraw the option
// list in place on each keystroke.
const ANSI_CURSOR_UP_N = (n: number): string => `\x1b[${n}A`;
const ANSI_CLEAR_LINE = '\x1b[2K';
const ANSI_CURSOR_TO_COL_1 = '\r';

function arrowKeySelect<T extends string>(
  question: string,
  choices: readonly SelectChoice<T>[],
  defaultIndex: number,
  _defaultChoice: SelectChoice<T>,
  stream: NodeJS.ReadableStream,
  output: NodeJS.WritableStream
): Promise<T> {
  return new Promise((resolve, reject) => {
    let highlighted = defaultIndex;
    let isCleanedUp = false;

    // We construct a readline interface only to feed `emitKeypressEvents`
    // — we don't await rl.question(). The `keypress` events come off
    // the input stream itself.
    const rl = createReadline({ input: stream, output, terminal: true });
    emitKeypressEvents(stream, rl);
    const stdinAsTty = stream as unknown as { isTTY?: boolean; setRawMode?: (mode: boolean) => unknown };
    if (stdinAsTty.setRawMode) stdinAsTty.setRawMode(true);

    const renderOptions = (initial: boolean): void => {
      if (!initial) {
        // Move cursor up by (choices.length + 1 hint line) to overwrite
        // the previously-rendered option block in place.
        output.write(ANSI_CURSOR_UP_N(choices.length + 1));
      }
      for (let i = 0; i < choices.length; i += 1) {
        const ch = choices[i]!;
        const isHi = i === highlighted;
        const marker = isHi ? c.brand('●') : c.dim('○');
        const label = isHi ? c.bold(ch.label) : ch.label;
        const hint = ch.hint ? ` ${c.dim(`— ${ch.hint}`)}` : '';
        output.write(`${ANSI_CLEAR_LINE}${ANSI_CURSOR_TO_COL_1}  ${marker} ${label}${hint}\n`);
      }
      output.write(
        `${ANSI_CLEAR_LINE}${ANSI_CURSOR_TO_COL_1}  ${c.dim('↑/↓ to navigate · Enter to confirm · Esc to cancel')}\n`
      );
    };

    const cleanup = (): void => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      stream.removeListener('keypress', onKeypress);
      if (stdinAsTty.setRawMode) stdinAsTty.setRawMode(false);
      rl.close();
    };

    const onKeypress = (
      _str: string | undefined,
      key: { name?: string; ctrl?: boolean; sequence?: string } | undefined
    ): void => {
      if (!key) return;
      // Ctrl-C and Esc both cancel.
      if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
        cleanup();
        // Replace the option block with a one-line "cancelled" note
        // so the user sees feedback. The terminal's own ^C echo does
        // not reach us in raw mode.
        output.write('  (cancelled)\n');
        reject(new Error('Aborted by user'));
        return;
      }
      if (key.name === 'up' || key.name === 'k') {
        highlighted = (highlighted - 1 + choices.length) % choices.length;
        renderOptions(false);
        return;
      }
      if (key.name === 'down' || key.name === 'j') {
        highlighted = (highlighted + 1) % choices.length;
        renderOptions(false);
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(choices[highlighted]!.value);
        return;
      }
      // Number keys 1-9 jump directly to the matching option.
      const numeric = Number.parseInt(key.name ?? '', 10);
      if (Number.isFinite(numeric) && numeric >= 1 && numeric <= choices.length) {
        highlighted = numeric - 1;
        renderOptions(false);
      }
    };

    output.write(`${activePromptHeader(question)}\n`);
    renderOptions(true);
    stream.on('keypress', onKeypress);
  });
}
