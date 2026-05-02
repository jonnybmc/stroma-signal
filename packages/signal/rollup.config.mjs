import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

const input = {
  index: 'src/index.ts',
  'ga4/index': 'src/ga4/index.ts',
  'report/index': 'src/report/index.ts',
  'summary/index': 'src/summary/index.ts'
};

export default [
  // Browser-runtime SDK bundle. Budget enforced at scripts/check-budgets.mjs
  // on dist/index.mjs (≤ 6656 bytes gzip). MUST NOT pull in any CLI deps;
  // verified by scripts/check-boundaries.mjs.
  {
    input,
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].mjs',
      chunkFileNames: 'chunks/[name]-[hash].mjs',
      sourcemap: true
    },
    plugins: [
      nodeResolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
        sourceMap: true
      }),
      terser()
    ]
  },
  // Browser-runtime .d.ts emit (separate config so Rollup runs the dts
  // plugin against the same entries without re-bundling JS).
  {
    input,
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].d.ts'
    },
    plugins: [dts({ tsconfig: './tsconfig.json' })]
  },
  // CLI bundle for the `signal init` wizard. Separate target so:
  //   - Bundle budget (check-budgets.mjs) only applies to the runtime.
  //   - Workspace-private @stroma-labs/signal-contracts validators get
  //     bundled INTO dist/cli.mjs (NOT externalized) so the published
  //     artifact resolves at consumer install time. The CLI bundle's
  //     `external` config keeps node:* builtins external + keeps
  //     @stroma-labs/signal external (the CLI is a sibling of the
  //     runtime, not a re-bundler of it), but does NOT mark
  //     signal-contracts external. nodeResolve walks the workspace
  //     symlink to find the contracts source.
  //   - Shebang (#!/usr/bin/env node) preserved via output.banner +
  //     terser format.comments preserving anything starting with #!.
  //     Without this, npm bin will silently fail on some installers.
  {
    input: 'src/cli/index.ts',
    output: {
      file: 'dist/cli.mjs',
      format: 'esm',
      banner: '#!/usr/bin/env node',
      sourcemap: true,
      inlineDynamicImports: true
    },
    external: [
      // Keep node builtins external — they exist in the consumer's runtime.
      /^node:/,
      // The CLI is a SIBLING of the runtime SDK, not a re-bundler of it.
      // If the wizard ever needs to reference the runtime, it does so
      // via fully-qualified import which the consumer's node_modules
      // already has installed.
      /^@stroma-labs\/signal($|\/)/
    ],
    plugins: [
      nodeResolve({ preferBuiltins: true }),
      typescript({
        tsconfig: './tsconfig.cli.json',
        declaration: false,
        declarationMap: false,
        sourceMap: true,
        outDir: 'dist'
      }),
      terser({
        format: {
          // Preserve #!/usr/bin/env node banner. Default terser strips
          // banner-style comments unless we explicitly preserve hash-bang.
          comments: (_node, comment) =>
            comment.value.startsWith('!') || /^#!/.test(comment.value || '')
        }
      })
    ]
  }
];
