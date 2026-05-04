// Raw ANSI escape helpers. Hand-rolled to avoid pulling `kleur` /
// `picocolors` etc. into the published package's dep graph (the project
// invariant is zero runtime deps; check-release-readiness.mjs enforces
// it). ~40 LOC total; aesthetic parity with `kleur` for the styles we
// actually use.
//
// All wrappers respect a runtime "color enabled?" flag. When color is
// off (NO_COLOR set, FORCE_COLOR=0, or non-TTY stdout), every wrapper
// returns the raw text unchanged.

export const ANSI_RESET = '[0m';

const CODES = {
  reset: '0',
  bold: '1',
  dim: '2',
  italic: '3',
  underline: '4',
  inverse: '7',
  strikethrough: '9',
  // Foreground colors (8-color basic palette + bright).
  black: '30',
  red: '31',
  green: '32',
  yellow: '33',
  blue: '34',
  magenta: '35',
  cyan: '36',
  white: '37',
  gray: '90',
  brightRed: '91',
  brightGreen: '92',
  brightYellow: '93',
  // Brand: Stroma olive (#556700) — closest 8-color is dark green; for
  // truecolor terminals we use the 24-bit escape sequence.
  brandOlive: '38;2;85;103;0'
} as const;

export type AnsiStyle = keyof typeof CODES;

export interface ColorState {
  enabled: boolean;
}

const _state: ColorState = { enabled: true };

export function configureColor(enabled: boolean): void {
  _state.enabled = enabled;
}

export function isColorEnabled(): boolean {
  return _state.enabled;
}

function wrap(style: AnsiStyle, text: string): string {
  if (!_state.enabled) return text;
  return `[${CODES[style]}m${text}${ANSI_RESET}`;
}

export const c = {
  reset: (text: string): string => wrap('reset', text),
  bold: (text: string): string => wrap('bold', text),
  dim: (text: string): string => wrap('dim', text),
  italic: (text: string): string => wrap('italic', text),
  underline: (text: string): string => wrap('underline', text),
  inverse: (text: string): string => wrap('inverse', text),
  strikethrough: (text: string): string => wrap('strikethrough', text),
  red: (text: string): string => wrap('red', text),
  green: (text: string): string => wrap('green', text),
  yellow: (text: string): string => wrap('yellow', text),
  blue: (text: string): string => wrap('blue', text),
  magenta: (text: string): string => wrap('magenta', text),
  cyan: (text: string): string => wrap('cyan', text),
  white: (text: string): string => wrap('white', text),
  gray: (text: string): string => wrap('gray', text),
  brightRed: (text: string): string => wrap('brightRed', text),
  brightGreen: (text: string): string => wrap('brightGreen', text),
  brightYellow: (text: string): string => wrap('brightYellow', text),
  brand: (text: string): string => wrap('brandOlive', text)
};

/** Strip ANSI escape sequences from a string. Useful for tests + for
 *  computing visible width of a styled string. */
export function stripAnsi(text: string): string {
  // Matches CSI sequences ([ ... a-zA-Z) — covers all the SGR
  // sequences we emit + reset.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escapes are control sequences by design.
  return text.replace(/\[[0-9;]*[A-Za-z]/g, '');
}
