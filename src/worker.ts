/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Bindings = {
  BUCKET: R2Bucket;
  DB: D1Database;
  APP_PASSWORD: string;
  SSO_SECRET: string;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for the frontend
app.use('/*', cors());

// ─── Helper: Decode JWT payload (no verification, SSO center already verified) ───
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url decode the payload
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// ─── Ensure users table exists ───────────────────────────────────────────────
async function ensureUsersTable(db: D1Database) {
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS users (' +
    'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    'uuid TEXT NOT NULL UNIQUE,' +
    'user_id INTEGER,' +
    'name TEXT,' +
    'username TEXT,' +
    'token TEXT,' +
    'first_seen TEXT NOT NULL,' +
    'last_seen TEXT NOT NULL' +
    ')'
  ).run();
}

// ─── Analytics: fire-and-forget event to SSO center ─────────────────────────
function trackEvent(
  uuid: string,
  eventType: string,
  durationSeconds?: number
): Promise<void> {
  return fetch('https://accounts.aryuki.com/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: 'edge-pdf',
      uuid,
      event_type: eventType,
      ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
    }),
  }).then(() => { }).catch((e) => console.warn('track failed:', e?.message));
}

// ─── Health check endpoint ────────────────────────────────────────────────────
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    message: 'EdgePDF API is running on Cloudflare Workers'
  });
});

// ─── SSO Callback endpoint ────────────────────────────────────────────────────
// Receives JWT token from frontend, verifies via accounts.aryuki.com/api/verify
app.post('/api/sso-callback', async (c) => {
  // 1. Parse body
  let token: string;
  try {
    const body = await c.req.json<{ token: string }>();
    token = body?.token;
  } catch {
    return c.json({ success: false, message: 'Invalid request body' }, 400);
  }
  if (!token) {
    return c.json({ success: false, message: 'No token provided' }, 400);
  }

  // 2. Decode payload & check expiry (sig key lives in SSO center, not here)
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return c.json({ success: false, message: 'Malformed JWT token' }, 401);
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && nowSec > payload.exp) {
    return c.json({ success: false, message: 'Token expired, please log in again.' }, 401);
  }

  // 3. Verify token via SSO center (authoritative permission + validity check)
  let verifyOk = false;
  let verifyErr = '';
  try {
    const verifyRes = await fetch(
      'https://accounts.aryuki.com/api/verify?app_id=edge-pdf',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (verifyRes.ok) {
      verifyOk = true;
    } else {
      let errBody: any = {};
      try { errBody = await verifyRes.json(); } catch { }
      verifyErr = errBody?.error || errBody?.message || `HTTP ${verifyRes.status}`;
    }
  } catch (fetchErr: any) {
    verifyErr = `Network error: ${fetchErr?.message ?? fetchErr}`;
    console.error('SSO verify fetch failed:', verifyErr);
  }

  if (!verifyOk) {
    return c.json({ success: false, message: `SSO verification failed — ${verifyErr}` }, 403);
  }

  // 4. Extract user info from payload
  const uuid = payload.uuid || payload.sub || '';
  const userId = payload.user_id || null;
  const name = payload.name || 'Unknown';
  const username = payload.username || '';
  const nowIso = new Date().toISOString();

  // 5. Upsert into D1
  try {
    await ensureUsersTable(c.env.DB);
    await c.env.DB
      .prepare(
        `INSERT INTO users (uuid, user_id, name, username, token, first_seen, last_seen)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(uuid) DO UPDATE SET
           name      = excluded.name,
           username  = excluded.username,
           token     = excluded.token,
           last_seen = excluded.last_seen`
      )
      .bind(uuid, userId, name, username, token, nowIso, nowIso)
      .run();
  } catch (dbErr: any) {
    console.error('D1 upsert error:', dbErr?.message);
    return c.json({ success: false, message: `Database error: ${dbErr?.message}` }, 500);
  }

  // 6. Fire-and-forget login analytics event
  c.executionCtx.waitUntil(trackEvent(uuid, 'login'));

  return c.json({
    success: true,
    user: { uuid, user_id: userId, name, username },
  });
});

// ─── Analytics proxy endpoint ─────────────────────────────────────────────────
// Frontend calls this to report events (pdf_generate, r2_upload, page_view…)
app.post('/api/track', async (c) => {
  try {
    const body = await c.req.json<{ event_type: string; uuid: string; duration_seconds?: number }>();
    if (!body?.event_type || !body?.uuid) {
      return c.json({ success: false, message: 'event_type and uuid required' }, 400);
    }
    c.executionCtx.waitUntil(
      trackEvent(body.uuid, body.event_type, body.duration_seconds)
    );
    return c.json({ success: true });
  } catch {
    return c.json({ success: false, message: 'Invalid request body' }, 400);
  }
});

// ─── Sign-Out endpoint ────────────────────────────────────────────────────────
// Clears the local app_session cookie and proxies the logout to Auth Center
// so the sso_session cookie on accounts.aryuki.com is also cleared.
app.post('/api/signout', async (c) => {
  // 1. Clear local app_session cookie
  c.header('Set-Cookie', 'app_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');

  // 2. Forward the browser's cookies to Auth Center so the sso_session is cleared
  try {
    await fetch('https://accounts.aryuki.com/api/logout', {
      method: 'POST',
      headers: { 'Cookie': c.req.header('Cookie') || '' },
      signal: AbortSignal.timeout(5000),
    });
  } catch (e: any) {
    // Non-fatal: even if auth-center is unreachable, we still clear local state
    console.warn('Auth Center logout failed:', e?.message);
  }

  return c.json({ success: true });
});

// ─── List R2 files ────────────────────────────────────────────────────────────
app.get('/api/r2/files', async (c) => {
  try {
    if (!c.env.BUCKET) {
      return c.json({ success: true, files: [] });
    }
    const list = await c.env.BUCKET.list();
    return c.json({ success: true, files: list.objects });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// ─── Upload to R2 ─────────────────────────────────────────────────────────────
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
    // Fire-and-forget r2_upload analytics (uuid from request header if provided)
    const uuid = c.req.header('x-user-uuid') || '';
    if (uuid) c.executionCtx.waitUntil(trackEvent(uuid, 'r2_upload'));
    return c.json({ success: true, key });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// ─── Download from R2 ────────────────────────────────────────────────────────
app.get('/api/r2/download', async (c) => {
  try {
    const key = c.req.query('key');
    if (!key) return c.json({ success: false, message: 'key is required' }, 400);
    if (!c.env.BUCKET) return c.json({ success: false, message: 'R2 not configured' }, 500);
    const obj = await c.env.BUCKET.get(key);
    if (!obj) return c.json({ success: false, message: 'File not found' }, 404);
    const contentType = obj.httpMetadata?.contentType || 'application/octet-stream';
    return new Response(obj.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// ─── SPA Fallback: forward non-API routes to Assets (serves index.html) ─────
app.notFound(async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
