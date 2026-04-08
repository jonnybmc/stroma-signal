import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function canonicalRouteMiddleware() {
  return {
    name: 'signal-report-canonical-routes',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/r' || req.url?.startsWith('/r?')) {
          req.url = req.url.replace(/^\/r(\?|$)/, '/r/$1');
        }
        if (req.url === '/build' || req.url?.startsWith('/build?')) {
          req.url = req.url.replace(/^\/build(\?|$)/, '/build/$1');
        }
        next();
      });
    }
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@stroma-labs/signal-contracts': path.resolve(currentDir, '../../packages/signal-contracts/src/index.ts')
    }
  },
  plugins: [canonicalRouteMiddleware()],
  server: {
    port: 4174
  },
  preview: {
    port: 4174
  },
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(currentDir, 'index.html'),
        report: path.resolve(currentDir, 'r/index.html'),
        build: path.resolve(currentDir, 'build/index.html')
      }
    }
  }
});
