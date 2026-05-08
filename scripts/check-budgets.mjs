// Bundle budgets — gzip ceilings on what consumers actually download.
//
// The previous version of this script measured `dist/index.mjs` in
// isolation, missing the chunks the entry transitively imports. That
// understated the real cost for unbundled ESM consumers (esm.sh, native
// import maps) and gave bundler users a misleading floor.
//
// This version walks the static `from "..."` import graph for each
// entry and sums the gzip cost of the entry + every reachable chunk.
// Static imports only — the runtime SDK has no dynamic `import()` and
// the CLI rolls up with `inlineDynamicImports: true`, so the static
// graph is the full payload.
//
// Four ceilings — set deliberately above current measured weights so
// they catch regressions without forcing a fight every release. Bumping
// a ceiling requires the same review discipline as bumping the runtime
// budget always has: identify what added the weight, confirm it's
// justified, raise the ceiling explicitly with a why-line.

import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const root = process.cwd();
const distRoot = path.join(root, 'packages/signal/dist');
const reportDist = path.join(root, 'apps/signal-report/dist');

function assertUnderBudget(label, size, budget) {
  if (size > budget) {
    throw new Error(`${label} budget exceeded: ${size} bytes > ${budget} bytes`);
  }
}

/**
 * Walk the static import graph from `entryPath`. Returns the set of
 * absolute file paths the entry transitively pulls in via relative
 * imports (`./` or `../`). Bare specifiers and `node:` builtins are
 * not part of the runtime payload — the consumer's bundler resolves
 * them — and are skipped.
 *
 * The CLI bundle embeds rendered framework snippets as string
 * literals (`import { SignalClient } from './SignalClient'`); these
 * match the regex but resolve to non-existent paths inside dist.
 * Skip resolved paths that don't exist on disk — rollup would have
 * failed at build time if they were real imports.
 */
async function resolveClosure(entryPath) {
  const visited = new Set();
  const queue = [entryPath];
  while (queue.length > 0) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/from\s*["']([./][^"']+)["']/g)) {
      const resolved = path.resolve(path.dirname(file), match[1]);
      if (visited.has(resolved)) continue;
      if (!existsSync(resolved)) continue; // string-literal false positive
      queue.push(resolved);
    }
  }
  return [...visited];
}

async function compressClosure(files) {
  let raw = 0;
  let gzip = 0;
  let brotli = 0;
  for (const file of files) {
    const buf = await readFile(file);
    raw += buf.byteLength;
    gzip += gzipSync(buf).byteLength;
    brotli += brotliCompressSync(buf).byteLength;
  }
  return { raw, gzip, brotli };
}

const budgets = [
  {
    label: 'runtime root (every browser user pays for this)',
    entry: 'index.mjs',
    extras: [],
    ceilingGzip: 7 * 1024
  },
  {
    label: 'runtime + GA4 (sum of both closures, deduped)',
    entry: 'index.mjs',
    extras: ['ga4/index.mjs'],
    ceilingGzip: 9 * 1024
  },
  {
    label: 'report subpath (self-hosted preview renderer)',
    entry: 'report/index.mjs',
    extras: [],
    ceilingGzip: 15 * 1024
  },
  {
    label: 'CLI (install-time only, runs in node — not browser)',
    entry: 'cli.mjs',
    extras: [],
    ceilingGzip: 20 * 1024
  }
];

console.log('Bundle budgets — closure-based gzip ceilings\n');

for (const budget of budgets) {
  const entryAbs = path.join(distRoot, budget.entry);
  const extraAbs = budget.extras.map((extra) => path.join(distRoot, extra));
  const allEntries = [entryAbs, ...extraAbs];
  const closures = await Promise.all(allEntries.map(resolveClosure));
  const closure = [...new Set(closures.flat())];
  const { raw, gzip, brotli } = await compressClosure(closure);
  const ceilingDisplay = `${(budget.ceilingGzip / 1024).toFixed(0)} KB`;
  const status = gzip <= budget.ceilingGzip ? '✓' : '✗';
  console.log(
    `  ${status} ${budget.label.padEnd(56)}` +
      `  raw=${raw.toString().padStart(6)}` +
      `  gzip=${gzip.toString().padStart(5)}` +
      `  brotli=${brotli.toString().padStart(5)}` +
      `  files=${closure.length}` +
      `  ceiling=${ceilingDisplay}`
  );
  assertUnderBudget(budget.label, gzip, budget.ceilingGzip);
}

// Hosted /r + /build static-assets budget. Covers the vertical-scroll
// report deck, credibility footer, Lucide icons, particle canvas, the
// self-hosted Geist-Variable display font (~24 KB), and the /build
// companion route with its fixture registry. Same regression-tripwire
// posture as the runtime budgets above.
//
// CRAWLER_ONLY_ASSETS sit in dist/ but are never downloaded by the
// page — they are referenced exclusively by `<meta property="og:*">`
// tags and fetched out-of-band by LinkedIn / Twitter / Slack crawlers
// when a /r URL gets shared. Excluding them keeps the budget tracking
// what actual users pay on first paint, which is the metric this
// guard exists to defend.
const CRAWLER_ONLY_ASSETS = new Set(['signal-stroma-og-linkedin.jpg']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(fullPath);
      return [fullPath];
    })
  );
  return files.flat();
}

const reportFiles = await walk(reportDist);
let reportWeight = 0;
for (const file of reportFiles) {
  if (CRAWLER_ONLY_ASSETS.has(path.basename(file))) continue;
  const fileStat = await stat(file);
  reportWeight += fileStat.size;
}
assertUnderBudget('signal-report static weight', reportWeight, 296 * 1024);
console.log(
  `\n  ✓ signal-report static assets                                raw=${reportWeight}  ceiling=${296 * 1024}\n`
);

console.log('Bundle budgets passed.');
