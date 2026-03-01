import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Bindings = {
  BUCKET: R2Bucket;
  DB: D1Database;
  APP_PASSWORD: string;
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

// Password verification endpoint
app.post('/api/login', async (c) => {
  try {
    const { password } = await c.req.json();
    if (password === c.env.APP_PASSWORD) {
      return c.json({ success: true });
    }
    return c.json({ success: false, message: 'Invalid password' }, 401);
  } catch (err) {
    return c.json({ success: false, message: 'Invalid request' }, 400);
  }
});

export default app;
