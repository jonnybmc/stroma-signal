import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const packageDir = path.join(root, 'packages/signal');
const packageJsonPath = path.join(packageDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const rootTsconfig = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.base.json'), 'utf8'));
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

function assertFile(relativePath) {
  const fullPath = path.join(root, relativePath);
  assert.ok(fs.existsSync(fullPath), `Missing required release artifact: ${relativePath}`);
}

function assertIncludes(value, expected, label) {
  assert.ok(typeof value === 'string' && value.includes(expected), `${label} must include ${expected}`);
}

function assertChangelogState(version) {
  const escapedVersion = version.replaceAll('.', '\\.');
  const unreleasedHeading = `## [${version}] - Unreleased`;
  const releasedHeadingPattern = new RegExp(`## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}`);
  const releaseTag = process.env.RELEASE_TAG;
  const publishedAt = process.env.RELEASE_PUBLISHED_AT;

  if (releaseTag) {
    assert.equal(releaseTag, `v${version}`, `Release tag must match package version v${version}`);
  }

  if (publishedAt) {
    const releaseDate = new Date(publishedAt).toISOString().slice(0, 10);
    assert.ok(
      changelog.includes(`## [${version}] - ${releaseDate}`),
      `CHANGELOG.md must stamp version ${version} with release date ${releaseDate} when publishing`
    );
    return;
  }

  assert.ok(
    changelog.includes(unreleasedHeading) || releasedHeadingPattern.test(changelog),
    `CHANGELOG.md must contain version ${version} as either Unreleased or a stamped YYYY-MM-DD entry`
  );
}

function readPackInfo() {
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: packageDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_cache: path.join(os.tmpdir(), 'stroma-signal-npm-cache')
    }
  });
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed) && parsed.length === 1, 'npm pack --dry-run --json must return one package result');
  return parsed[0];
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

assert.equal(packageJson.name, '@stroma-labs/signal', 'Package name must be @stroma-labs/signal');
assert.equal(packageJson.license, 'MIT', 'Package license must be MIT');
assert.equal(packageJson.type, 'module', 'Package should remain ESM-only');
assert.equal(packageJson.sideEffects, false, 'Package must stay sideEffect-free');
assert.equal(rootPackageJson.engines?.node, '>=22.0.0', 'Contributor root must require Node >= 22.0.0');
assert.equal(packageJson.engines?.node, '>=18.0.0', 'Published package must keep consumer support at Node >= 18.0.0');
assert.equal(rootTsconfig.compilerOptions?.strict, true, 'Root TypeScript config must keep strict mode enabled');
assert.ok(
  Array.isArray(packageJson.files) &&
    packageJson.files.includes('dist/**/*.d.ts') &&
    packageJson.files.includes('dist/**/*.mjs'),
  'Package files must include the explicit dist .d.ts and .mjs publish globs'
);
assert.ok(
  !('dependencies' in packageJson) || Object.keys(packageJson.dependencies).length === 0,
  'Published package must not declare runtime dependencies'
);
assertIncludes(packageJson.repository?.url, 'github.com/jonnybmc/stroma-signal', 'Repository URL');
assertIncludes(packageJson.homepage, 'github.com/jonnybmc/stroma-signal', 'Homepage');
assertIncludes(packageJson.bugs?.url, 'github.com/jonnybmc/stroma-signal/issues', 'Bugs URL');

for (const [entry, target] of Object.entries(packageJson.exports ?? {})) {
  assert.ok(target.types, `Missing types export for ${entry}`);
  assert.ok(target.import, `Missing import export for ${entry}`);
  assert.ok(target.default, `Missing default export for ${entry}`);
}

[
  'LICENSE',
  'SECURITY.md',
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
  'docs/spa-ssr-caveats.md',
  'docs/first-successful-report.md',
  'docs/release-deployment-checklist.md'
].forEach(assertFile);

assertChangelogState(packageJson.version);

const packInfo = readPackInfo();
const packedPaths = packInfo.files.map((file) => file.path);

assert.ok(packedPaths.includes('README.md'), 'Packed npm artifact must include package README.md');
assert.ok(packedPaths.includes('package.json'), 'Packed npm artifact must include package.json');
assert.ok(packedPaths.includes('dist/index.mjs'), 'Packed npm artifact must include the main dist entry');
assert.ok(packedPaths.includes('dist/summary/index.mjs'), 'Packed npm artifact must include the summary subpath');
assert.ok(
  !packedPaths.some((filePath) => filePath.endsWith('.map')),
  'Packed npm artifact must not include sourcemaps'
);
assert.ok(
  packedPaths.every(
    (filePath) => filePath === 'README.md' || filePath === 'package.json' || filePath.startsWith('dist/')
  ),
  'Packed npm artifact must stay limited to dist/, package.json, and README.md'
);
assert.ok(
  Array.isArray(packInfo.bundled) && packInfo.bundled.length === 0,
  'Packed npm artifact must not bundle dependencies'
);

for (const filePath of walk(path.join(packageDir, 'dist')).filter((candidate) => candidate.endsWith('.mjs'))) {
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(
    !content.includes('@stroma-labs/signal-contracts'),
    `Built artifact must not retain @stroma-labs/signal-contracts imports: ${path.relative(root, filePath)}`
  );
}

console.log('Release-readiness metadata, pack audit, and artifact checks passed.');
