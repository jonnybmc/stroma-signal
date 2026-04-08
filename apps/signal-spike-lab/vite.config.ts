import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const collectedEvents: unknown[] = [];
const currentDir = path.dirname(fileURLToPath(import.meta.url));

function collectorMiddleware() {
  const handle = async (req: { method?: string; url?: string }, res: { setHeader: (name: string, value: string) => void; end: (body?: string) => void; statusCode: number }): Promise<boolean> => {
    if (req.method === 'POST' && req.url === '/collect') {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve) => {
        (req as NodeJS.ReadableStream).on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        (req as NodeJS.ReadableStream).on('end', () => resolve());
      });
      const body = Buffer.concat(chunks).toString('utf8');
      try {
        collectedEvents.unshift(JSON.parse(body));
      } catch {
        collectedEvents.unshift({ parseError: true, raw: body });
      }
      if (collectedEvents.length > 25) collectedEvents.length = 25;
      res.statusCode = 204;
      res.end();
      return true;
    }

    if (req.method === 'GET' && req.url === '/api/events') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ events: collectedEvents }, null, 2));
      return true;
    }

    if (req.method === 'POST' && req.url === '/api/reset') {
      collectedEvents.splice(0, collectedEvents.length);
      res.statusCode = 204;
      res.end();
      return true;
    }

    return false;
  };

  return {
    name: 'signal-spike-collector',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        void handle(req, res).then((handled) => {
          if (!handled) next();
        });
      });
    }
  };
}

export default defineConfig({
  resolve: {
    alias: [
      { find: '@stroma-labs/signal/ga4', replacement: path.resolve(currentDir, '../../packages/signal/src/ga4/index.ts') },
      { find: '@stroma-labs/signal/report', replacement: path.resolve(currentDir, '../../packages/signal/src/report/index.ts') },
      { find: '@stroma-labs/signal-contracts', replacement: path.resolve(currentDir, '../../packages/signal-contracts/src/index.ts') },
      { find: '@stroma-labs/signal', replacement: path.resolve(currentDir, '../../packages/signal/src/index.ts') }
    ]
  },
  plugins: [collectorMiddleware()],
  server: {
    port: 4173
  },
  preview: {
    port: 4173
  },
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(currentDir, 'index.html'),
        offers: path.resolve(currentDir, 'offers/index.html')
      }
    }
  }
});
