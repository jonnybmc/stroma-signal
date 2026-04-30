import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const signalRoot = path.join(root, 'packages/signal/src');

async function readAllFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return readAllFiles(fullPath);
      return fullPath;
    })
  );
  return files.flat();
}

function assertNoMatch(content, patterns, filePath, message) {
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      throw new Error(`${message}: ${path.relative(root, filePath)} matched ${pattern}`);
    }
  }
}

const files = await readAllFiles(signalRoot);
const coreFiles = files.filter(
  (file) => file.includes('/core/') || file.endsWith('/src/index.ts') || file.includes('/sinks/')
);
const optionalFiles = files.filter(
  (file) => file.includes('/ga4/') || file.includes('/report/') || file.includes('/summary/')
);

for (const file of coreFiles) {
  const content = await readFile(file, 'utf8');
  assertNoMatch(
    content,
    [/['"]\.\/ga4\//, /['"]\.\/report\//, /['"]\.\.\/ga4\//, /['"]\.\.\/report\//],
    file,
    'Base runtime must not import optional subpath modules'
  );
}

for (const file of optionalFiles) {
  const content = await readFile(file, 'utf8');
  assertNoMatch(
    content,
    [/['"]\.\.\/core\//, /['"]\.\.\/index(\.js)?['"]/],
    file,
    'Optional subpath modules must not import base runtime internals'
  );
}

const packageJson = JSON.parse(await readFile(path.join(root, 'packages/signal/package.json'), 'utf8'));
if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) {
  throw new Error('packages/signal/package.json must not declare runtime dependencies.');
}

// Public/private boundary: free-tier surfaces must not import the paid PI
// package. The paid product moves to a sibling private repo; this guard is
// the defensive backstop so a stray import does not leak schema from the
// public tree at build time.
const FREE_TIER_ROOTS = ['packages/signal/src', 'packages/signal-contracts/src', 'apps/signal-spike-lab/src'];
const PI_IMPORT_PATTERNS = [
  /from\s+['"]@stroma-labs\/signal-pi(?:['"/])/,
  /from\s+['"][^'"]*\/signal-pi\//,
  /import\s+['"]@stroma-labs\/signal-pi(?:['"/])/
];
for (const relRoot of FREE_TIER_ROOTS) {
  const absRoot = path.join(root, relRoot);
  const tierFiles = await readAllFiles(absRoot);
  for (const file of tierFiles) {
    if (!file.endsWith('.ts') && !file.endsWith('.mjs')) continue;
    const content = await readFile(file, 'utf8');
    assertNoMatch(
      content,
      PI_IMPORT_PATTERNS,
      file,
      'Free-tier surfaces must not import @stroma-labs/signal-pi (paid product lives in sibling private repo)'
    );
  }
}

// Same boundary at the package.json level — no free-tier package may
// declare a dependency on @stroma-labs/signal-pi.
const FREE_TIER_PACKAGE_JSONS = [
  'packages/signal/package.json',
  'packages/signal-contracts/package.json',
  'apps/signal-spike-lab/package.json'
];
for (const rel of FREE_TIER_PACKAGE_JSONS) {
  const pkg = JSON.parse(await readFile(path.join(root, rel), 'utf8'));
  for (const block of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[block];
    if (deps && Object.hasOwn(deps, '@stroma-labs/signal-pi')) {
      throw new Error(
        `${rel} must not declare ${block}["@stroma-labs/signal-pi"] (paid product lives in sibling private repo).`
      );
    }
  }
}

console.log('Import boundaries and runtime dependency policy passed.');
