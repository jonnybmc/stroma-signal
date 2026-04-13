import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJsonPath = path.join(root, 'packages/signal/package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

function assertFile(relativePath) {
  const fullPath = path.join(root, relativePath);
  assert.ok(fs.existsSync(fullPath), `Missing required release artifact: ${relativePath}`);
}

function assertIncludes(value, expected, label) {
  assert.ok(typeof value === 'string' && value.includes(expected), `${label} must include ${expected}`);
}

assert.equal(packageJson.name, '@stroma-labs/signal', 'Package name must be @stroma-labs/signal');
assert.equal(packageJson.license, 'MIT', 'Package license must be MIT');
assert.equal(packageJson.type, 'module', 'Package should remain ESM-only');
assert.equal(packageJson.sideEffects, false, 'Package must stay sideEffect-free');
assert.ok(Array.isArray(packageJson.files) && packageJson.files.includes('dist'), 'Package files must include dist');
assertIncludes(packageJson.repository?.url, 'github.com/jonathanbooysen/stroma-signal', 'Repository URL');
assertIncludes(packageJson.homepage, 'github.com/jonathanbooysen/stroma-signal', 'Homepage');
assertIncludes(packageJson.bugs?.url, 'github.com/jonathanbooysen/stroma-signal/issues', 'Bugs URL');

for (const [entry, target] of Object.entries(packageJson.exports ?? {})) {
  assert.ok(target.types, `Missing types export for ${entry}`);
  assert.ok(target.import, `Missing import export for ${entry}`);
  assert.ok(target.default, `Missing default export for ${entry}`);
}

[
  'LICENSE',
  'README.md',
  'docs/why-signal.md',
  'docs/tier-report-design-spec.md',
  'docs/public-api-v0.1.md',
  'docs/signal-technical-reference.md',
  'docs/aggregation-spec.md',
  'docs/marketer-quickstart.md',
  'docs/production-report-automation.md',
  'docs/client-integrations.md',
  'docs/collector-contract.md',
  'docs/warehouse-schema.md',
  'docs/gtm-recipe.md',
  'docs/gtm-workspace-template.json',
  'docs/ga4-bigquery-validation.sql',
  'docs/ga4-bigquery-url-builder.sql',
  'docs/normalized-bigquery-validation.sql',
  'docs/normalized-bigquery-url-builder.sql',
  'docs/launch-troubleshooting.md',
  'docs/framework-recipes.md',
  'docs/spa-ssr-caveats.md'
].forEach(assertFile);

console.log('Release-readiness metadata and artifact checks passed.');
