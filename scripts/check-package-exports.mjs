import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(rootDir, '../packages/signal');
const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));

const expectedEntries = [
  ['.', ['import', 'default', 'types']],
  ['./ga4', ['import', 'default', 'types']],
  ['./report', ['import', 'default', 'types']],
  ['./summary', ['import', 'default', 'types']]
];

for (const [entry, conditions] of expectedEntries) {
  const exportTarget = packageJson.exports?.[entry];
  assert.ok(exportTarget, `Missing export map entry for ${entry}`);

  for (const condition of conditions) {
    const relativePath = exportTarget[condition];
    assert.ok(relativePath, `Missing ${condition} condition for ${entry}`);
    assert.ok(
      fs.existsSync(path.join(packageDir, relativePath)),
      `Missing built file for ${entry} (${condition}): ${relativePath}`
    );
  }
}

const mainModule = await import(pathToFileURL(path.join(packageDir, packageJson.exports['.'].import)).href);
const ga4Module = await import(pathToFileURL(path.join(packageDir, packageJson.exports['./ga4'].import)).href);
const reportModule = await import(pathToFileURL(path.join(packageDir, packageJson.exports['./report'].import)).href);
const summaryModule = await import(pathToFileURL(path.join(packageDir, packageJson.exports['./summary'].import)).href);

assert.equal(typeof mainModule.init, 'function', 'Expected main package to export init()');
assert.equal(typeof mainModule.createBeaconSink, 'function', 'Expected main package to export createBeaconSink()');
assert.equal(typeof ga4Module.createDataLayerSink, 'function', 'Expected GA4 subpath to export createDataLayerSink()');
assert.equal(
  typeof reportModule.createPreviewCollector,
  'function',
  'Expected report subpath to export createPreviewCollector()'
);
assert.equal(
  typeof summaryModule.formatSignalSummary,
  'function',
  'Expected summary subpath to export formatSignalSummary()'
);

// CLI bin presence + executability + shebang preservation + signal-contracts
// bundling guard. The bin is part of the public surface; if any of these
// invariants regress, npm bin will silently fail on some installers OR the
// published artifact will reference a workspace-private package that the
// consumer never has installed.
assert.equal(packageJson.bin?.signal, './dist/cli.mjs', 'Expected packageJson.bin.signal to point at ./dist/cli.mjs');
const cliPath = path.join(packageDir, packageJson.bin.signal);
assert.ok(fs.existsSync(cliPath), `Missing built CLI bin: ${cliPath}`);
const cliSource = fs.readFileSync(cliPath, 'utf8');
assert.ok(
  cliSource.startsWith('#!/usr/bin/env node'),
  'CLI bin must start with #!/usr/bin/env node — npm bin silently fails on some installers without it'
);
assert.ok(
  !/from\s+['"]@stroma-labs\/signal-contracts/.test(cliSource),
  'CLI bin must NOT import @stroma-labs/signal-contracts at runtime — it must be bundled inline (workspace-private package)'
);
const cliStat = fs.statSync(cliPath);
// 0o100 mask checks the owner-execute bit. On Windows the executable bit
// concept doesn't apply the same way, but the npm shim handles invocation
// via the bin field directly. Skip the chmod assertion on win32.
if (process.platform !== 'win32') {
  assert.ok(
    (cliStat.mode & 0o100) !== 0,
    `CLI bin must have owner-execute bit set (chmod +x). Current mode: ${cliStat.mode.toString(8)}`
  );
}
