import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Bindings = {
  BUCKET: R2Bucket;
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for the frontend
app.use('/*', cors());

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'EdgePDF API is running on Cloudflare Workers' 
  });
});

export default app;
