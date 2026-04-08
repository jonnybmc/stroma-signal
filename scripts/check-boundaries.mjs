import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const signalRoot = path.join(root, 'packages/signal/src');

async function readAllFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return readAllFiles(fullPath);
    return fullPath;
  }));
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
const coreFiles = files.filter((file) => file.includes('/core/') || file.endsWith('/src/index.ts') || file.includes('/sinks/'));
const optionalFiles = files.filter((file) => file.includes('/ga4/') || file.includes('/report/'));

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

console.log('Import boundaries and runtime dependency policy passed.');
