import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@stroma-labs/signal/ga4', replacement: path.resolve(__dirname, 'packages/signal/src/ga4/index.ts') },
      { find: '@stroma-labs/signal/report', replacement: path.resolve(__dirname, 'packages/signal/src/report/index.ts') },
      { find: '@stroma-labs/signal-contracts', replacement: path.resolve(__dirname, 'packages/signal-contracts/src/index.ts') },
      { find: '@stroma-labs/signal', replacement: path.resolve(__dirname, 'packages/signal/src/index.ts') }
    ]
  },
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/**/*.test.ts'
    ],
    coverage: {
      reporter: ['text', 'lcov']
    }
  }
});
