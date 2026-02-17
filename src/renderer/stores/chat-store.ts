import { create } from 'zustand';
import type { ChatMessage } from '../types/chat';
import { generateId } from '../lib/utils';

const MAX_MESSAGES = 100;

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentRequestId: string | null;
  addUserMessage: (content: string) => void;
  startAssistantMessage: (requestId: string) => void;
  appendChunk: (requestId: string, text: string) => void;
  finishStreaming: (requestId: string) => void;
  setError: (requestId: string, error: string) => void;
  clearMessages: () => void;
}

// BUG-P02: Buffer streaming chunks and flush on interval instead of per-token
let chunkBuffer = '';
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentRequestId: null,

  addUserMessage: (content: string) => {
    const msg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    set((state) => {
      const msgs = [...state.messages, msg];
      return { messages: msgs.length > MAX_MESSAGES ? msgs.slice(-MAX_MESSAGES) : msgs };
    });
  },

  startAssistantMessage: (requestId: string) => {
    const msg: ChatMessage = {
      id: requestId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, msg],
      isStreaming: true,
      currentRequestId: requestId,
    }));
  },

  appendChunk: (requestId: string, text: string) => {
    chunkBuffer += text;
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        const buffered = chunkBuffer;
        chunkBuffer = '';
        flushTimer = null;
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === requestId ? { ...m, content: m.content + buffered } : m
          ),
        }));
      }, 32); // ~30fps flush rate
    }
  },

  finishStreaming: (requestId: string) => {
    // Flush any remaining buffered chunks
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    const remaining = chunkBuffer;
    chunkBuffer = '';
    set((state) => {
      const msgs = state.messages.map((m) =>
        m.id === requestId ? { ...m, content: m.content + remaining, isStreaming: false } : m
      );
      return {
        messages: msgs.length > MAX_MESSAGES ? msgs.slice(-MAX_MESSAGES) : msgs,
        isStreaming: false,
        currentRequestId: null,
      };
    });
  },

  setError: (requestId: string, error: string) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === requestId
          ? { ...m, content: `Error: ${error}`, isStreaming: false }
          : m
      ),
      isStreaming: false,
      currentRequestId: null,
    }));
  },

  clearMessages: () => {
    set({ messages: [], isStreaming: false, currentRequestId: null });
  },
}));
