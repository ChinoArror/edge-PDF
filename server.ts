import express from 'express';
import { serve } from '@hono/node-server';
import { createServer as createViteServer } from 'vite';
import { Readable } from 'stream';
import workerApp from './src/worker.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mount the Hono API under /api using the node-server adapter
  // We use express to handle the Vite middleware, and route /api to Hono
  app.use('/api', (req, res, next) => {
    // We can use the fetch adapter from hono node-server
    // But since we are using express, we can just pass the request to hono
    // A simple way is to use the fetch API
    const url = new URL(req.url, `http://${req.headers.host}`);
    const init: any = {
      method: req.method,
      headers: req.headers as any,
      body: req.method !== 'GET' && req.method !== 'HEAD'
        ? Readable.toWeb(req) : undefined,
      duplex: 'half'
    };

    Promise.resolve(workerApp.fetch(new Request(url.href, init), { BUCKET: {} as any, DB: {} as any }))
      .then(async (response) => {
        res.status(response.status);
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } else {
          res.end();
        }
      })
      .catch(next);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
