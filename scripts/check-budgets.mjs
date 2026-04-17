import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const root = process.cwd();
const baseBundle = path.join(root, 'packages/signal/dist/index.mjs');
const reportDist = path.join(root, 'apps/signal-report/dist');

function assertUnderBudget(label, size, budget) {
  if (size > budget) {
    throw new Error(`${label} budget exceeded: ${size} bytes > ${budget} bytes`);
  }
}

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

const baseSource = await readFile(baseBundle);
assertUnderBudget('@stroma-labs/signal gzip', gzipSync(baseSource).byteLength, 4096);
assertUnderBudget('@stroma-labs/signal brotli', brotliCompressSync(baseSource).byteLength, 4096);

const reportFiles = await walk(reportDist);
let reportWeight = 0;
for (const file of reportFiles) {
  const fileStat = await stat(file);
  reportWeight += fileStat.size;
}

// 224 KB envelope. Current report includes a 6-slide horizontal deck
// (landing + Act 1 audience + Act 2 race + Act 3 funnel waterfall +
// Act 4 handoff), Lucide icon set, severity gauges, horizontal
// stacked-bar signal visualisations, persistent footer with credibility
// strip, landing evidence rail, canvas particle system, and the /build
// companion route with fixture registry. Iteration 6 added
// device_hardware / network_signals / environment aggregate blocks +
// the Actionable Signals slide. Iteration 7 added evidence rail,
// credibility strip, guard range validation, strict decode, and
// freshness provenance. Bumped from 192 KB → 224 KB → 228 KB → 232 KB
// → 236 KB. The latest +4 KB accommodates the share button, refactored
// footer / credibility-strip extraction, and summary/export subpath in
// the contracts build output.
assertUnderBudget('signal-report static weight', reportWeight, 236 * 1024);

console.log('Bundle budgets passed.');
