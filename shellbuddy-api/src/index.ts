interface Env {
  GEMINI_API_KEY: string;
  GOOGLE_CLIENT_SECRET: string;
  RATE_LIMIT: KVNamespace;
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const DAILY_LIMIT = 50;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

// Validate Google OAuth token and return email
async function validateToken(token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string; error?: string };
    return data.email || null;
  } catch {
    return null;
  }
}

// Rate limit: returns { allowed, remaining } or null on error
async function checkRateLimit(
  kv: KVNamespace,
  email: string
): Promise<{ allowed: boolean; remaining: number }> {
  // Key: "rl:<email>:<YYYY-MM-DD>"
  const today = new Date().toISOString().slice(0, 10);
  const key = `rl:${email}:${today}`;

  const current = parseInt((await kv.get(key)) || '0', 10);

  if (current >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  // Increment — TTL of 48h so keys auto-expire
  await kv.put(key, String(current + 1), { expirationTtl: 172800 });
  return { allowed: true, remaining: DAILY_LIMIT - current - 1 };
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Expose-Headers': 'X-RateLimit-Remaining',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Only accept POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);

    // Route: POST /v1/auth/token — exchange authorization code for tokens (server-side secret)
    if (url.pathname === '/v1/auth/token') {
      let body: { code?: string; client_id?: string; redirect_uri?: string; code_verifier?: string };
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
      }
      if (!body.code || !body.client_id || !body.redirect_uri) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
      }
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: body.code,
          client_id: body.client_id,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: body.redirect_uri,
          grant_type: 'authorization_code',
          ...(body.code_verifier ? { code_verifier: body.code_verifier } : {}),
        }),
      });
      const tokenData = await tokenRes.text();
      return new Response(tokenData, {
        status: tokenRes.status,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // Route: POST /v1/auth/refresh — refresh access token (server-side secret)
    if (url.pathname === '/v1/auth/refresh') {
      let body: { client_id?: string; refresh_token?: string };
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
      }
      if (!body.client_id || !body.refresh_token) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
      }
      const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: body.client_id,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          refresh_token: body.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const refreshData = await refreshRes.text();
      return new Response(refreshData, {
        status: refreshRes.status,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // Route: POST /v1/chat
    if (url.pathname !== '/v1/chat') {
      return new Response('Not found', {
        status: 404,
        headers: corsHeaders(),
      });
    }

    // Extract and validate OAuth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.slice(7);
    const email = await validateToken(token);
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired Google token — sign in again' }),
        { status: 401, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit check
    const rateLimit = await checkRateLimit(env.RATE_LIMIT, email);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Daily limit reached (50 requests/day). Resets at midnight UTC.',
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders(),
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // Parse the request body
    let body: { model?: string; contents?: unknown; systemInstruction?: unknown; generationConfig?: unknown };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    const model = body.model || 'gemini-2.0-flash';

    // Forward to Gemini API with server-side key (streaming SSE)
    const geminiUrl = `${GEMINI_BASE}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: body.contents,
        systemInstruction: body.systemInstruction,
        generationConfig: body.generationConfig,
      }),
    });

    // Stream the response back
    return new Response(geminiRes.body, {
      status: geminiRes.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': geminiRes.headers.get('Content-Type') || 'text/event-stream',
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    });
  },
};
