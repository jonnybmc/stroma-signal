// Snippet syntax validation gate (P2-2).
//
// Snapshot tests prove the rendered string matches expected; they do
// NOT prove the snippet is syntactically valid TypeScript / TSX. This
// gate uses the TypeScript compiler API to PARSE each rendered snippet
// (per file, per framework × sink) and assert zero syntax diagnostics.
//
// Why parse-only and not full type-check:
//   - Type-checking requires every framework's actual dependency
//     graph installed (next, react, @sveltejs/kit, @angular/core,
//     etc.) — heavy lift for 12 frameworks × 3 sinks = 36 fixture
//     projects, each with their own node_modules.
//   - The HIGH-VALUE failure mode the gate guards against is malformed
//     templates: missing brackets, unclosed quotes, broken JSX,
//     unsubstituted placeholders surviving into output. All of those
//     are caught at the syntax layer.
//   - Type errors against framework APIs are caught downstream: every
//     PR that touches matrix.ts triggers the snapshot diff (Phase C.4),
//     and the recipe-currency sweep (RECIPE-CURRENCY-SWEEP.md) does
//     real fixture builds against framework deps quarterly.
//
// .svelte and .html files are skipped (TS parser doesn't understand
// them) — the validate-non-ts path uses a brace/quote balance check
// as a smoke gate for those.

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { findSnippet, SNIPPET_MATRIX, SUPPORTED_FRAMEWORKS_IN_MATRIX } from '../../src/cli/snippets/matrix.js';
import { renderSnippet } from '../../src/cli/snippets/render-snippet.js';
import type { SinkChoice } from '../../src/cli/snippets/types.js';

const SINKS: readonly SinkChoice[] = ['dataLayer', 'beacon', 'callback'];

function isTypeScriptFile(path: string): boolean {
  return /\.(tsx?|jsx?|mjs|cjs)$/i.test(path);
}

function isSvelteFile(path: string): boolean {
  return path.endsWith('.svelte');
}

function isHtmlFile(path: string): boolean {
  return path.endsWith('.html');
}

function parseTypeScript(body: string, path: string): ts.Diagnostic[] {
  const scriptKind = path.endsWith('.tsx') || path.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(path, body, ts.ScriptTarget.ES2022, true, scriptKind);
  // ts.createSourceFile populates parseDiagnostics on the source file
  // when there's a syntax error.
  const diagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
  return diagnostics;
}

/** Smoke validation for non-TS files (.svelte, .html). Checks brace +
 *  paren + brace balance to catch obviously-broken output. NOT a real
 *  parser — just a "are we close to balanced" gate. */
function validateNonTsBalance(body: string): { ok: boolean; reason: string } {
  const counts = {
    '(': 0,
    ')': 0,
    '[': 0,
    ']': 0,
    '{': 0,
    '}': 0
  };
  let inString: '"' | "'" | '`' | null = null;
  let inComment: 'line' | 'block' | null = null;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    const prev = i > 0 ? body[i - 1] : '';
    if (inComment === 'line') {
      if (ch === '\n') inComment = null;
      continue;
    }
    if (inComment === 'block') {
      if (prev === '*' && ch === '/') inComment = null;
      continue;
    }
    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }
    if (ch === '/' && body[i + 1] === '/') {
      inComment = 'line';
      continue;
    }
    if (ch === '/' && body[i + 1] === '*') {
      inComment = 'block';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch as '"' | "'" | '`';
      continue;
    }
    if (ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === '{' || ch === '}') {
      counts[ch] += 1;
    }
  }
  if (counts['('] !== counts[')'])
    return { ok: false, reason: `unbalanced parens: ${counts['(']} ( vs ${counts[')']} )` };
  if (counts['['] !== counts[']'])
    return { ok: false, reason: `unbalanced brackets: ${counts['[']} [ vs ${counts[']']} ]` };
  if (counts['{'] !== counts['}'])
    return { ok: false, reason: `unbalanced braces: ${counts['{']} { vs ${counts['}']} }` };
  return { ok: true, reason: '' };
}

describe('snippet-compile gate — every rendered snippet parses cleanly', () => {
  for (const framework of SUPPORTED_FRAMEWORKS_IN_MATRIX) {
    for (const sink of SINKS) {
      it(`${framework} × ${sink} files have zero syntax errors`, () => {
        const spec = findSnippet(framework, sink)!;
        const inputs = sink === 'beacon' ? { sampleRate: 1.0, beaconEndpoint: '/rum/signal' } : { sampleRate: 1.0 };
        const rendered = renderSnippet(spec, inputs);

        for (const file of rendered.files) {
          // Skip files that are pure modify-instructions (the body is
          // a comment block telling the user where to paste — not a
          // standalone parseable file). We treat any file marked as
          // 'modify' with position 'top' or 'inside-body' as
          // instruction-only and don't parse it.
          if (file.action === 'modify' && (file.position === 'top' || file.position === 'inside-body')) {
            // Still smoke-check that the body is at least non-empty.
            expect(file.body.length, `${framework} × ${sink} : ${file.path}`).toBeGreaterThan(0);
            continue;
          }
          if (isTypeScriptFile(file.path)) {
            const diagnostics = parseTypeScript(file.body, file.path);
            const messages = diagnostics.map((d) =>
              typeof d.messageText === 'string' ? d.messageText : ts.flattenDiagnosticMessageText(d.messageText, '\n')
            );
            expect(diagnostics, `${framework} × ${sink} : ${file.path} → ${messages.join(' | ')}`).toHaveLength(0);
          } else if (isSvelteFile(file.path) || isHtmlFile(file.path)) {
            const balance = validateNonTsBalance(file.body);
            expect(balance.ok, `${framework} × ${sink} : ${file.path} → ${balance.reason}`).toBe(true);
          } else {
            // Unknown extension — fail loudly so we add explicit handling.
            throw new Error(`Unhandled snippet file extension: ${file.path} for ${framework} × ${sink}`);
          }
        }
      });
    }
  }
});

describe('parse a deliberately-broken snippet → expect non-zero diagnostics (negative control)', () => {
  it('catches an unclosed JSX tag', () => {
    const broken = `'use client';\n\nexport function Broken() {\n  return <div>;\n}`;
    const diagnostics = parseTypeScript(broken, 'Broken.tsx');
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('catches an unclosed string literal', () => {
    const broken = `const x = 'hello`;
    const diagnostics = parseTypeScript(broken, 'broken.ts');
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('non-TS balance check catches unbalanced braces', () => {
    expect(validateNonTsBalance('{ a: 1, b: { c: 2 ').ok).toBe(false);
  });

  it('non-TS balance check passes balanced JSX-ish content', () => {
    expect(validateNonTsBalance('<div>{children}</div>').ok).toBe(true);
  });
});

describe('snippet compile gate — coverage assertions', () => {
  it('runs for all 36 (framework × sink) combinations', () => {
    expect(SNIPPET_MATRIX).toHaveLength(36);
  });
});
