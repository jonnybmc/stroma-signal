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
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  }));
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

assertUnderBudget('signal-report static weight', reportWeight, 150 * 1024);

console.log('Bundle budgets passed.');
