// Box-drawing panel formatters. Aesthetic parity with @clack/prompts
// (the "modern Astro / Vite / Stripe CLI bar") without pulling Clack
// as a runtime dep.
//
// Conventions:
//   ┌  Title         ← intro panel header (corner + title)
//   │  body line     ← body row (vertical bar + 2-space gutter)
//   ◇  inline panel  ← detached info panel (diamond + gutter)
//   ◆  active prompt ← solid diamond marks the active question
//   └  outro line    ← outro panel footer (corner + tail line)

import { c } from './ansi.js';

const GLYPH = {
  startCorner: '┌',
  endCorner: '└',
  bar: '│',
  diamondHollow: '◇',
  diamondSolid: '◆',
  bullet: '·',
  checkmark: '✓',
  cross: '✗'
} as const;

export interface PanelLines {
  /** Lines that compose the panel. Each is rendered with the bar gutter. */
  body: string[];
}

export function intro(title: string, panel: PanelLines | string[]): string {
  const lines = Array.isArray(panel) ? panel : panel.body;
  const out = [`${c.brand(GLYPH.startCorner)}  ${c.bold(title)}`];
  for (const line of bodyRows(lines)) out.push(line);
  return out.join('\n');
}

export function outro(tail: string, panel: PanelLines | string[]): string {
  const lines = Array.isArray(panel) ? panel : panel.body;
  const out: string[] = [];
  for (const line of bodyRows(lines)) out.push(line);
  out.push(`${c.brand(GLYPH.endCorner)}  ${c.bold(tail)}`);
  return out.join('\n');
}

/** A detached info panel (no intro/outro corners). Used between intro
 *  and outro to surface mid-flow info without breaking the bar gutter. */
export function info(title: string, panel: PanelLines | string[]): string {
  const lines = Array.isArray(panel) ? panel : panel.body;
  const out = [`${c.brand(GLYPH.diamondHollow)}  ${c.bold(title)}`];
  for (const line of bodyRows(lines)) out.push(line);
  return out.join('\n');
}

/** Active-prompt header — used on the question line when a prompt is
 *  awaiting input. Solid diamond differentiates from passive info. */
export function activePromptHeader(title: string): string {
  return `${c.brand(GLYPH.diamondSolid)}  ${c.bold(title)}`;
}

/** Render rows of body content with the bar gutter, plus a final spacer
 *  bar so the next panel's header doesn't touch the body. */
function bodyRows(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (line === '') {
      // Blank visual row — still emit the gutter for vertical continuity.
      out.push(c.dim(GLYPH.bar));
    } else {
      out.push(`${c.dim(GLYPH.bar)}  ${line}`);
    }
  }
  // Spacer bar so the next panel's header has visual breathing room.
  out.push(c.dim(GLYPH.bar));
  return out;
}

export function checkmark(text: string): string {
  return `${c.green(GLYPH.checkmark)} ${text}`;
}

export function cross(text: string): string {
  return `${c.red(GLYPH.cross)} ${text}`;
}

export function bullet(text: string): string {
  return `${c.dim(GLYPH.bullet)} ${text}`;
}

export { GLYPH };
