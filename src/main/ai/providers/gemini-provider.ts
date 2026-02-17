import { AIProvider, ChatMessage, ProviderConfig, StreamCallbacks } from './provider-interface';
import { getValidAccessToken, refreshAccessToken } from '../../auth/google-auth';

// Worker proxy URL — set via environment variable at build time
const WORKER_URL = process.env.LUMESHELL_API_URL || 'https://shellbuddy-api.sairam-varma.workers.dev';

function sanitizeError(error: string): string {
  let msg = error.replace(/https?:\/\/[^\s]+key=[^\s&]+/g, '[URL_REDACTED]');
  msg = msg.replace(/Bearer\s+[A-Za-z0-9\-_.]+/g, 'Bearer [REDACTED]');
  return msg;
}

export class GeminiProvider implements AIProvider {
  name = 'gemini';

  private async fetchWithAuth(
    url: string,
    options: RequestInit,
    signal?: AbortSignal
  ): Promise<Response> {
    let token = await getValidAccessToken();
    if (!token) throw new Error('Not signed in to Google — go to Settings to sign in');

    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers as Record<string, string>, Authorization: `Bearer ${token}` },
      signal,
    });

    // Retry once on 401 with a fresh token
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) throw new Error('Google session expired — sign in again in Settings');
      token = await getValidAccessToken();
      if (!token) throw new Error('Google session expired — sign in again in Settings');
      return fetch(url, {
        ...options,
        headers: { ...options.headers as Record<string, string>, Authorization: `Bearer ${token}` },
        signal,
      });
    }

    return response;
  }

  async streamMessage(
    messages: ChatMessage[],
    config: ProviderConfig,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const model = config.model || 'gemini-2.0-flash';

    // Convert to Gemini format
    const systemMsg = messages.find((m) => m.role === 'system');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    try {
      const response = await this.fetchWithAuth(`${WORKER_URL}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          contents,
          systemInstruction: systemMsg
            ? { parts: [{ text: systemMsg.content }] }
            : undefined,
          generationConfig: {
            maxOutputTokens: 4096,
          },
        }),
      }, signal);

      if (!response.ok) {
        const text = await response.text();
        // Parse error responses (Worker returns {error: "..."}, Gemini returns {error: {message: "..."}})
        try {
          const errJson = JSON.parse(text);
          const errMsg = typeof errJson.error === 'string'
            ? errJson.error
            : errJson.error?.message || JSON.stringify(errJson.error);
          if (errMsg) throw new Error(errMsg);
        } catch (parseErr) {
          if (parseErr instanceof Error && !text.startsWith('{')) {
            // Not JSON — use raw text
          } else {
            throw parseErr;
          }
        }
        throw new Error(`Gemini error: ${response.status} ${sanitizeError(text)}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          try {
            const json = JSON.parse(data);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) callbacks.onChunk(text);
          } catch {
            // skip
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) callbacks.onChunk(text);
          } catch {
            // skip
          }
        }
      }

      callbacks.onDone();
    } catch (error) {
      if (signal?.aborted) return;
      const msg = error instanceof Error ? error.message : 'Gemini request failed';
      callbacks.onError(sanitizeError(msg));
    }
  }

  async testConnection(config: ProviderConfig): Promise<boolean> {
    try {
      // Send a minimal request through the worker to verify auth + connectivity
      const token = await getValidAccessToken();
      if (!token) {
        console.error('[gemini] testConnection: no access token');
        return false;
      }

      const response = await fetch(`${WORKER_URL}/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: config.model || 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error(`[gemini] testConnection failed: ${response.status}`, text);
      }
      return response.ok;
    } catch (err) {
      console.error('[gemini] testConnection error:', err);
      return false;
    }
  }
}
