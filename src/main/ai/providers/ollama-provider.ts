import { AIProvider, ChatMessage, ProviderConfig, StreamCallbacks } from './provider-interface';

export class OllamaProvider implements AIProvider {
  name = 'ollama';

  async streamMessage(
    messages: ChatMessage[],
    config: ProviderConfig,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    const model = config.model || 'llama3.2';

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
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
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              callbacks.onChunk(json.message.content);
            }
            if (json.done) {
              callbacks.onDone();
              return;
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }
      callbacks.onDone();
    } catch (error) {
      if (signal?.aborted) return;
      callbacks.onError(error instanceof Error ? error.message : 'Ollama connection failed');
    }
  }

  async testConnection(config: ProviderConfig): Promise<boolean> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
