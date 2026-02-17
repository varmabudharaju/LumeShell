import { BrowserWindow } from 'electron';
import { AIProvider, ChatMessage, ProviderConfig } from './providers/provider-interface';
import { OllamaProvider } from './providers/ollama-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { buildChatSystemPrompt, EXPLAIN_SYSTEM_PROMPT } from './prompts';
import type { ChatContext } from './prompts';
import { IPC } from '../../shared/constants';

const VALID_PROVIDERS = ['ollama', 'gemini'] as const;

// Lazy-init providers on first use (P2.1 — faster startup)
const providerCache: Record<string, AIProvider> = {};

function getProvider(name: string): AIProvider | null {
  if (providerCache[name]) return providerCache[name];
  switch (name) {
    case 'ollama': providerCache[name] = new OllamaProvider(); break;
    case 'gemini': providerCache[name] = new GeminiProvider(); break;
    default: return null;
  }
  return providerCache[name];
}

export class AIService {
  private mainWindow: BrowserWindow | null = null;
  private activeRequests = new Map<string, AbortController>();

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win;
  }

  async chat(
    providerName: string,
    config: ProviderConfig,
    messages: ChatMessage[],
    requestId: string,
    context?: ChatContext
  ): Promise<void> {
    const provider = getProvider(providerName);
    if (!provider) {
      this.mainWindow?.webContents.send(
        IPC.AI_CHAT_ERROR,
        requestId,
        `Unknown provider: ${providerName}`
      );
      return;
    }

    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);
    // BUG-H01: Auto-timeout after 60s to prevent permanently frozen chat
    const timeoutId = setTimeout(() => abortController.abort(), 60_000);

    const fullMessages: ChatMessage[] = [
      { role: 'system', content: buildChatSystemPrompt(context) },
      ...messages,
    ];

    try {
      await provider.streamMessage(fullMessages, config, {
        onChunk: (text) => {
          this.mainWindow?.webContents.send(IPC.AI_CHAT_CHUNK, requestId, text);
        },
        onDone: () => {
          this.mainWindow?.webContents.send(IPC.AI_CHAT_DONE, requestId);
        },
        onError: (error) => {
          this.mainWindow?.webContents.send(IPC.AI_CHAT_ERROR, requestId, error);
        },
      }, abortController.signal);
    } finally {
      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);
    }
  }

  cancelChat(requestId: string): void {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }

  async explainCommand(
    providerName: string,
    config: ProviderConfig,
    command: string
  ): Promise<{ explanation: string; riskLevel: string; sideEffects: string[]; reversible: boolean }> {
    const provider = getProvider(providerName);
    if (!provider) throw new Error(`Unknown provider: ${providerName}`);

    const messages: ChatMessage[] = [
      { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
      { role: 'user', content: command },
    ];

    let result = '';
    let streamError: string | null = null;

    await provider.streamMessage(messages, config, {
      onChunk: (text) => {
        result += text;
      },
      onDone: () => {},
      onError: (error) => {
        streamError = error;
      },
    });

    if (streamError) {
      throw new Error(streamError);
    }

    // Strip markdown code fences (Gemini often wraps JSON in ```json ... ```)
    let jsonStr = result.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    try {
      return JSON.parse(jsonStr);
    } catch {
      return {
        explanation: result || 'Could not analyze command',
        riskLevel: 'moderate',
        sideEffects: ['Analysis incomplete'],
        reversible: false,
      };
    }
  }

  async testConnection(providerName: string, config: ProviderConfig): Promise<boolean> {
    const provider = getProvider(providerName);
    if (!provider) return false;
    return provider.testConnection(config);
  }
}

export const aiService = new AIService();
