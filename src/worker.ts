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

// List R2 files
app.get('/api/r2/files', async (c) => {
  try {
    // If BUCKET is undefined (e.g. running in express dev without proper binding), mock it
    if (!c.env.BUCKET) {
      return c.json({ success: true, files: [] });
    }
    const list = await c.env.BUCKET.list();
    return c.json({ success: true, files: list.objects });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// Upload to R2
app.post('/api/r2/upload', async (c) => {
  try {
    if (!c.env.BUCKET) {
      return c.json({ success: false, message: 'R2 Bucket not configured' }, 500);
    }
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;
    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }
    const key = (formData['key'] as string) || file.name;
    await c.env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });
    return c.json({ success: true, key });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

export default app;
