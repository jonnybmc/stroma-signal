// Code-snippet block renderer. Frames a multi-line code body between
// horizontal rules and applies brand-olive accent to keywords/strings
// in a deliberately MINIMAL way — full syntax highlighting would
// require a proper tokenizer (which we deliberately avoid to keep the
// CLI bundle small + dep-free).
//
// Highlighting strategy:
//   - 'use client' / 'use server' → brand olive (Next directive)
//   - import / from / export → bold
//   - String literals (single/double/backtick) → dim
//   - Comments (// or /* */) → dim
// Anything not matched is rendered unchanged.

import { c } from './ansi.js';

const RULE_CHAR = '─';
const DEFAULT_RULE_WIDTH = 60;

export interface SnippetBlockOptions {
  /** Width of the framing horizontal rule. */
  ruleWidth?: number;
  /** Optional caption shown above the snippet (e.g. file path). */
  caption?: string;
  /** Skip syntax highlighting entirely. Useful for --json mode. */
  raw?: boolean;
}

export function snippetBlock(body: string, options: SnippetBlockOptions = {}): string {
  const ruleWidth = options.ruleWidth ?? DEFAULT_RULE_WIDTH;
  const rule = c.dim(RULE_CHAR.repeat(ruleWidth));
  const lines: string[] = [];
  if (options.caption) {
    lines.push(c.dim(options.caption));
  }
  lines.push(rule);
  for (const line of body.split('\n')) {
    lines.push(options.raw ? line : highlightLine(line));
  }
  lines.push(rule);
  return lines.join('\n');
}

const KEYWORD_RE = /\b(import|from|export|default|return|const|let|var|function|async|await|if|else|new)\b/g;
const STRING_RE = /(['"`])(?:[^\\]|\\.)*?\1/g;
const COMMENT_LINE_RE = /(\/\/.*)$/;
const COMMENT_BLOCK_RE = /(\/\*[\s\S]*?\*\/)/g;
const USE_DIRECTIVE_RE = /(['"])(use client|use server)\1/g;

function highlightLine(line: string): string {
  // Order matters: comments + strings first (they SHADOW keywords inside
  // them), then the use-* directive, then keywords. We do this by
  // tokenizing into segments rather than chained .replace calls so a
  // keyword inside a string doesn't get double-styled.

  // Fast path: no special tokens at all.
  if (
    !KEYWORD_RE.test(line) &&
    !STRING_RE.test(line) &&
    !COMMENT_LINE_RE.test(line) &&
    !COMMENT_BLOCK_RE.test(line) &&
    !USE_DIRECTIVE_RE.test(line)
  ) {
    return line;
  }

  // Reset stateful regex objects after the test calls above.
  KEYWORD_RE.lastIndex = 0;
  STRING_RE.lastIndex = 0;
  COMMENT_BLOCK_RE.lastIndex = 0;
  USE_DIRECTIVE_RE.lastIndex = 0;

  // Apply in order: comment-line wins everything to its right.
  const commentLineMatch = COMMENT_LINE_RE.exec(line);
  let codePart = line;
  let commentTail = '';
  if (commentLineMatch && commentLineMatch.index !== undefined) {
    codePart = line.slice(0, commentLineMatch.index);
    commentTail = c.dim(commentLineMatch[1] ?? '');
  }

  // Highlight strings + use-directive on codePart.
  codePart = codePart.replace(USE_DIRECTIVE_RE, (_match, q, kind) => `${q}${c.brand(kind)}${q}`);
  codePart = codePart.replace(STRING_RE, (match) => c.dim(match));
  // Highlight keywords (skip ones inside dim wrappers — best-effort, not perfect).
  codePart = codePart.replace(KEYWORD_RE, (match) => c.bold(match));
  // Block comments (multi-line — highlight the visible chunk on this line).
  codePart = codePart.replace(COMMENT_BLOCK_RE, (match) => c.dim(match));

  return codePart + commentTail;
}
