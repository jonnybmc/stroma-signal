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
// Signal runtime budget. Pre-enrichment baseline was ~3980 bytes gzip.
// Plan §9a.9 caps the full Round 1+ enrichment delta (LCP subparts,
// culprit classifier, INP dominant phase, third-party, LoAF, visibility)
// at 1.5 KB gzipped. 5632 bytes = baseline + 1.5 KB with single-byte
// headroom. Tightening further risks false-positive failures on
// incremental changes; loosening defeats the point of the budget as a
// regression tripwire for capture-code weight.
assertUnderBudget('@stroma-labs/signal gzip', gzipSync(baseSource).byteLength, 5632);
assertUnderBudget('@stroma-labs/signal brotli', brotliCompressSync(baseSource).byteLength, 5632);

const reportFiles = await walk(reportDist);
let reportWeight = 0;
for (const file of reportFiles) {
  const fileStat = await stat(file);
  reportWeight += fileStat.size;
}

// 256 KB envelope. Current report includes a 6-slide horizontal deck
// (landing + Act 1 audience + Act 2 race + Act 3 funnel waterfall +
// Act 4 handoff), Lucide icon set, severity gauges, horizontal
// stacked-bar signal visualisations, persistent footer with credibility
// strip, landing evidence rail, canvas particle system, and the /build
// companion route with fixture registry. Iteration 6 added
// device_hardware / network_signals / environment aggregate blocks +
// the Actionable Signals slide. Iteration 7 added evidence rail,
// credibility strip, guard range validation, strict decode, and
// freshness provenance. Bumped from 192 KB → 224 KB → 228 KB → 232 KB
// → 236 KB → 244 KB → 248 KB → 252 KB → 256 KB. The +8 KB at 244 KB
// accommodated the Round 1 enrichment narrative (aggregate-side
// `lcp_story` / `inp_story` decoders, Act 2 LCP-subpart inline block,
// Act 3 INP-phase caption). The +4 KB at 248 KB covered the Round 1
// third-party story: aggregate-side `third_party_story` codec +
// accumulator, Act 2 pre-race third-party headline view-model + markup,
// and the `sr-third-party-headline` CSS block keyed by dominant tier.
// PR-6 (visibility filter + credibility bundle) fit inside the 248 KB
// envelope. PR-7 (+4 KB → 252 KB) adds the LoAF story: aggregate-side
// `loaf_story` codec + accumulator, Act 3 LoAF inline caption keyed to
// the INP funnel stage, and the `sr-funnel-node-loaf` CSS rule.
// PR-8 (+4 KB → 256 KB) narrates the already-captured context fields:
// `context_story` codec + finaliser (Save-Data share, median RTT,
// cellular share, effective-type dominant), Act 1 context strip
// view-model + markup with contextual tooltips translating each metric
// into a non-technical "what this means for you" read, and the
// `sr-act1-ctx` CSS block.
// Design-alignment (+32 KB → 288 KB) ports static primitives from the
// Stroma Landing `.report` shell: self-hosted Geist-Variable.woff2
// (~24 KB) for display surfaces, italic-serif unit suffix spans
// (Georgia, system), accent lineage tokens (--sr-accent-2 /
// --sr-accent-line / --sr-serif-italic), shell upgrades (--sr-radius-shell
// 22px / --sr-shadow-xl long drop / --sr-bg-proof), and an ambient radial
// accent glow on Act 2 hero evidence. Inter + JetBrainsMono remain system
// fallbacks; see report-tokens.css header for the rationale.
assertUnderBudget('signal-report static weight', reportWeight, 288 * 1024);

console.log('Bundle budgets passed.');
