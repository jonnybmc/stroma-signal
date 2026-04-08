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
  ['./report', ['import', 'default', 'types']]
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

assert.equal(typeof mainModule.init, 'function', 'Expected main package to export init()');
assert.equal(typeof mainModule.createBeaconSink, 'function', 'Expected main package to export createBeaconSink()');
assert.equal(typeof ga4Module.createDataLayerSink, 'function', 'Expected GA4 subpath to export createDataLayerSink()');
assert.equal(typeof reportModule.createPreviewCollector, 'function', 'Expected report subpath to export createPreviewCollector()');
