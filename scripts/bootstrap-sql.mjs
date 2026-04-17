#!/usr/bin/env node

// Fill the four placeholders in the canonical SQL templates and write ready-to-run
// copies. Project / dataset / table / host are the only values that change per
// consumer; the aggregation logic is canonical and must not be edited.
//
// Usage:
//   node scripts/bootstrap-sql.mjs
//   node scripts/bootstrap-sql.mjs --path ga4 --project my-proj --dataset analytics_12345 --host example.com --out ./out
//   node scripts/bootstrap-sql.mjs --path normalized --project my-proj --dataset signal --table signal_events --host example.com
//
// Flags:
//   --path        "ga4" | "normalized"  (prompted if omitted)
//   --project     GCP project id         (prompted)
//   --dataset     BigQuery dataset       (prompted)
//   --table       BigQuery table         (normalized only; defaults to signal_events)
//   --host        Host filter value      (prompted)
//   --out         Output directory       (defaults to ./bootstrapped-sql)
//   --yes         Skip prompts for any value supplied as a flag

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const docsDir = path.join(repoRoot, 'docs');

const TEMPLATES = {
  ga4: ['ga4-bigquery-validation.sql', 'ga4-bigquery-url-builder.sql'],
  normalized: ['normalized-bigquery-validation.sql', 'normalized-bigquery-url-builder.sql']
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function createPrompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question) => new Promise((resolve) => rl.question(question, resolve));
  return { ask, close: () => rl.close() };
}

async function resolveValue(args, key, promptLabel, { required = true, validate, fallback } = {}) {
  let value = args[key];
  if (value === true || value === undefined) {
    if (args.yes === true) {
      value = fallback;
    } else {
      const prompt = createPrompt();
      const suffix = fallback ? ` [${fallback}]` : '';
      const answer = (await prompt.ask(`${promptLabel}${suffix}: `)).trim();
      prompt.close();
      value = answer.length > 0 ? answer : fallback;
    }
  }
  if (required && (value === undefined || value === '' || value === true)) {
    throw new Error(`Missing required value: --${key} (${promptLabel})`);
  }
  if (validate && value !== undefined) {
    const issue = validate(value);
    if (issue) throw new Error(`Invalid --${key} value: ${issue}`);
  }
  return value;
}

const identifierPattern = /^[A-Za-z0-9_-]+$/;
const hostPattern = /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function validateIdentifier(label) {
  return (value) => (identifierPattern.test(value) ? null : `${label} must match [A-Za-z0-9_-]+ (got "${value}")`);
}

function validateHost(value) {
  return hostPattern.test(value) ? null : `host must look like a domain (got "${value}")`;
}

function applyReplacements(source, replacements) {
  let output = source;
  for (const [literal, replacement] of replacements) {
    output = output.split(literal).join(replacement);
  }
  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const pathChoice = await resolveValue(args, 'path', 'Which path? (ga4 | normalized)', {
    validate: (value) => (['ga4', 'normalized'].includes(value) ? null : 'must be "ga4" or "normalized"')
  });

  const project = await resolveValue(args, 'project', 'GCP project id', {
    validate: validateIdentifier('project')
  });

  const datasetFallback = pathChoice === 'ga4' ? 'analytics_XXXXXXXX' : 'signal';
  const dataset = await resolveValue(args, 'dataset', 'BigQuery dataset', {
    fallback: datasetFallback,
    validate: validateIdentifier('dataset')
  });

  const table =
    pathChoice === 'normalized'
      ? await resolveValue(args, 'table', 'BigQuery table', {
          fallback: 'signal_events',
          validate: validateIdentifier('table')
        })
      : null;

  const host = await resolveValue(args, 'host', 'Host filter (e.g. example.com)', {
    validate: validateHost
  });

  const outDir =
    args.out && args.out !== true ? path.resolve(String(args.out)) : path.join(repoRoot, 'bootstrapped-sql');
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const files = TEMPLATES[pathChoice];
  const replacements =
    pathChoice === 'ga4'
      ? [
          [`your-project.analytics_XXXXXXXX.events_*`, `${project}.${dataset}.events_*`],
          [`'your-domain.com'`, `'${host}'`]
        ]
      : [
          [`your-project.signal.signal_events`, `${project}.${dataset}.${table}`],
          [`'your-domain.com'`, `'${host}'`]
        ];

  for (const fileName of files) {
    const sourcePath = path.join(docsDir, fileName);
    const source = await readFile(sourcePath, 'utf8');
    const filled = applyReplacements(source, replacements);
    const outPath = path.join(outDir, fileName);
    await writeFile(outPath, filled, 'utf8');
    console.log(`wrote ${path.relative(repoRoot, outPath)}`);
  }

  console.log(`\nDone. Paste the files from ${path.relative(repoRoot, outDir)} into BigQuery in order:`);
  console.log(`  1. ${files[0]}   (validation — run first to prove rows land)`);
  console.log(`  2. ${files[1]}   (URL-builder — returns the hosted signal_report_url)`);
}

main().catch((error) => {
  console.error(`\nbootstrap-sql: ${error.message}`);
  process.exit(1);
});
