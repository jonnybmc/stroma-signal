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
// SDK runtime budget — gzip and brotli upper bounds on the published
// `@stroma-labs/signal` base bundle. Treat as a regression tripwire: if a
// change blows the budget, either the change is over-weight or the budget
// needs a deliberate, reviewed bump.
//
// Bumped 5632 → 6656 in the navigation-timing-breakdown merge: the new
// vitals.navigation_timing block (per-subpart fidelity, three TTFB
// definitions, 103 Early-Hints provenance) added ~550 bytes gzipped to
// the base bundle. The new ceiling gives ~7% gzip headroom; brotli
// remains comfortably under (~5.5 KB measured at the bump).
assertUnderBudget('@stroma-labs/signal gzip', gzipSync(baseSource).byteLength, 6656);
assertUnderBudget('@stroma-labs/signal brotli', brotliCompressSync(baseSource).byteLength, 6656);

const reportFiles = await walk(reportDist);
let reportWeight = 0;
for (const file of reportFiles) {
  const fileStat = await stat(file);
  reportWeight += fileStat.size;
}

// Hosted /r + /build static-assets budget. Covers the four-act report deck,
// the credibility footer, Lucide icons, the canvas particle system, the
// self-hosted Geist-Variable display font (~24 KB), and the /build companion
// route with its fixture registry. Same regression-tripwire posture as the
// runtime budget above.
assertUnderBudget('signal-report static weight', reportWeight, 296 * 1024);

console.log('Bundle budgets passed.');
