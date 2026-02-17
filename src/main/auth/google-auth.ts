import { safeStorage, shell } from 'electron';
import crypto from 'crypto';
import http from 'http';
import { URL } from 'url';
import { JsonStore } from '../store/json-store';

// OAuth constants — injected at build time via environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const SCOPES = [
  'openid',
  'email',
];

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const WORKER_URL = process.env.LUMESHELL_API_URL || 'https://shellbuddy-api.sairam-varma.workers.dev';

interface AuthData {
  encryptedRefreshToken: string;
  email: string;
}

const authDefaults: AuthData = {
  encryptedRefreshToken: '',
  email: '',
};

let authStore: JsonStore<AuthData> | null = null;

function getAuthStore(): JsonStore<AuthData> {
  if (!authStore) {
    authStore = new JsonStore<AuthData>('google-auth', authDefaults);
  }
  return authStore;
}

// In-memory ephemeral state (not persisted — refreshed on restart)
let accessToken: string | null = null;
let expiresAt: number = 0;
let refreshPromise: Promise<boolean> | null = null;
let authInProgress = false;

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

function encryptToken(token: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage unavailable — cannot store credentials safely');
  }
  return safeStorage.encryptString(token).toString('base64');
}

function decryptToken(encrypted: string): string {
  if (!encrypted) return '';
  if (!safeStorage.isEncryptionAvailable()) {
    return ''; // Cannot decrypt without secure storage
  }
  const buf = Buffer.from(encrypted, 'base64');
  return safeStorage.decryptString(buf);
}

export async function startAuth(): Promise<{ success: boolean; email?: string; error?: string }> {
  if (authInProgress) {
    return { success: false, error: 'Sign-in already in progress' };
  }
  authInProgress = true;

  const { codeVerifier, codeChallenge } = generatePKCE();

  try {
    return await new Promise((resolve) => {
      let resolved = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const server = http.createServer();

      function finish(result: { success: boolean; email?: string; error?: string }) {
        if (resolved) return;
        resolved = true;
        if (timeout) clearTimeout(timeout);
        server.close();
        resolve(result);
      }

      server.on('error', () => {
        finish({ success: false, error: 'Failed to start local server' });
      });

      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          finish({ success: false, error: 'Failed to start local server' });
          return;
        }

        const port = address.port;
        const redirectUri = `http://127.0.0.1:${port}/callback`;

        const authUrl = new URL(GOOGLE_AUTH_URL);
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', SCOPES.join(' '));
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');

        timeout = setTimeout(() => {
          finish({ success: false, error: 'Authentication timed out' });
        }, 120_000);

        // Open the browser
        shell.openExternal(authUrl.toString());
      });

      server.on('request', async (req, res) => {
        function respond(html: string) {
          if (!res.headersSent) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
          }
        }

        try {
          const port = (server.address() as { port: number }).port;
          const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);

          if (reqUrl.pathname !== '/callback') {
            if (!res.headersSent) {
              res.writeHead(404);
              res.end('Not found');
            }
            return;
          }

          if (resolved) {
            respond('<html><body><p>Already handled. You can close this tab.</p></body></html>');
            return;
          }

          const code = reqUrl.searchParams.get('code');
          const error = reqUrl.searchParams.get('error');

          if (error || !code) {
            respond('<html><body><h2>Authentication failed</h2><p>You can close this tab.</p></body></html>');
            finish({ success: false, error: error || 'No authorization code received' });
            return;
          }

          const redirectUri = `http://127.0.0.1:${port}/callback`;

          const tokenResponse = await fetch(`${WORKER_URL}/v1/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              client_id: GOOGLE_CLIENT_ID,
              redirect_uri: redirectUri,
              code_verifier: codeVerifier,
            }),
          });

          if (!tokenResponse.ok) {
            respond('<html><body><h2>Authentication failed</h2><p>You can close this tab.</p></body></html>');
            finish({ success: false, error: `Token exchange failed: ${tokenResponse.status}` });
            return;
          }

          const tokens = await tokenResponse.json() as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
            id_token?: string;
          };

          accessToken = tokens.access_token;
          expiresAt = Date.now() + tokens.expires_in * 1000;

          let userEmail = '';
          if (tokens.id_token) {
            try {
              const payload = JSON.parse(
                Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString()
              );
              userEmail = payload.email || '';
            } catch {
              // ignore decode error
            }
          }

          if (tokens.refresh_token) {
            const store = getAuthStore();
            store.set('encryptedRefreshToken', encryptToken(tokens.refresh_token));
            store.set('email', userEmail);
          }

          respond('<html><body style="font-family:system-ui;text-align:center;padding:60px"><h2>Authentication successful!</h2><p>You can close this tab and return to LumeShell.</p></body></html>');
          finish({ success: true, email: userEmail });
        } catch (err) {
          respond('<html><body><h2>Authentication failed</h2><p>You can close this tab.</p></body></html>');
          const msg = err instanceof Error ? err.message : 'Token exchange failed';
          finish({ success: false, error: msg });
        }
      });
    });
  } finally {
    authInProgress = false;
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  const store = getAuthStore();
  const encrypted = store.get('encryptedRefreshToken');
  if (!encrypted) return false;

  const refreshToken = decryptToken(encrypted);
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${WORKER_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GOOGLE_CLIENT_ID,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[google-auth] refresh failed:', response.status, errText);
      return false;
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
    };

    accessToken = data.access_token;
    expiresAt = Date.now() + data.expires_in * 1000;
    return true;
  } catch {
    return false;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  // If we have a valid token with >5 min remaining, use it
  if (accessToken && Date.now() < expiresAt - 5 * 60 * 1000) {
    return accessToken;
  }

  // Deduplicate concurrent refresh calls
  if (refreshPromise) {
    await refreshPromise;
    return accessToken;
  }

  refreshPromise = refreshAccessToken();
  try {
    const refreshed = await refreshPromise;
    if (refreshed && accessToken) {
      return accessToken;
    }
    return null;
  } finally {
    refreshPromise = null;
  }
}

export function getAuthStatus(): { signedIn: boolean; email?: string } {
  const store = getAuthStore();
  const hasRefreshToken = !!store.get('encryptedRefreshToken');
  if (!hasRefreshToken) {
    return { signedIn: false };
  }
  return { signedIn: true, email: store.get('email') || undefined };
}

export function signOut(): void {
  accessToken = null;
  expiresAt = 0;
  refreshPromise = null;
  const store = getAuthStore();
  store.set('encryptedRefreshToken', '');
  store.set('email', '');
}
