import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@stroma-labs/signal/ga4', replacement: path.resolve(__dirname, 'packages/signal/src/ga4/index.ts') },
      {
        find: '@stroma-labs/signal/report',
        replacement: path.resolve(__dirname, 'packages/signal/src/report/index.ts')
      },
      {
        find: '@stroma-labs/signal-contracts',
        replacement: path.resolve(__dirname, 'packages/signal-contracts/src/index.ts')
      },
      // Resolves only when the private PI submodule is mounted at internal/.
      // Public deploys without the submodule never hit this alias because
      // free-tier code does not import @stroma-labs/signal-pi (enforced by
      // scripts/check-boundaries.mjs).
      {
        find: '@stroma-labs/signal-pi',
        replacement: path.resolve(__dirname, 'internal/packages/signal-pi/src/index.ts')
      },
      { find: '@stroma-labs/signal', replacement: path.resolve(__dirname, 'packages/signal/src/index.ts') }
    ]
  },
  test: {
    // Public + PI submodule tests when the submodule is mounted; the
    // internal/ globs simply match nothing in a public-only checkout.
    include: [
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'internal/packages/**/*.test.ts',
      'internal/apps/**/*.test.ts'
    ],
    coverage: {
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      }
    }
  }
});
