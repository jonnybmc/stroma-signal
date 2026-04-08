import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

const input = {
  index: 'src/index.ts',
  'ga4/index': 'src/ga4/index.ts',
  'report/index': 'src/report/index.ts'
};

export default [
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
  {
    input,
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].d.ts'
    },
    plugins: [dts({ tsconfig: './tsconfig.json' })]
  }
];
