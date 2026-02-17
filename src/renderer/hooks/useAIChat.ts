import { useEffect, useCallback } from 'react';
import { useChatStore } from '../stores/chat-store';
import { useSettingsStore } from '../stores/settings-store';
import { useTerminalStore } from '../stores/terminal-store';
import { useHistoryStore } from '../stores/history-store';
import { generateId } from '../lib/utils';

export function useAIChat() {
  const { addUserMessage, startAssistantMessage, appendChunk, finishStreaming, setError, isStreaming } =
    useChatStore();
  const settings = useSettingsStore((s) => s.settings);
  const activeTabId = useTerminalStore((s) => s.activeTabId);

  useEffect(() => {
    const removeChunk = window.lumeshell.ai.onChatChunk((requestId, text) => {
      appendChunk(requestId, text);
    });

    const removeDone = window.lumeshell.ai.onChatDone((requestId) => {
      finishStreaming(requestId);
    });

    const removeError = window.lumeshell.ai.onChatError((requestId, error) => {
      setError(requestId, error);
    });

    return () => {
      removeChunk();
      removeDone();
      removeError();
    };
  }, [appendChunk, finishStreaming, setError]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      addUserMessage(content);

      const requestId = generateId();
      startAssistantMessage(requestId);

      const provider = settings?.activeProvider || 'ollama';
      const messages = useChatStore.getState().messages;

      // Build message history for context (exclude current streaming message)
      const historyMessages = messages
        .filter((m) => !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.content }));

      // P5.1: Gather terminal context for smarter prompts
      let cwd: string | undefined;
      try {
        if (activeTabId) {
          cwd = await window.lumeshell.terminal.getCwd(activeTabId);
        }
      } catch {
        // CWD unavailable — not critical
      }

      const historyEntries = useHistoryStore.getState().entries;
      const recentCommands = historyEntries
        .slice(0, 5)
        .map((e) => e.command);

      const context = { cwd, recentCommands };

      await window.lumeshell.ai.chat(provider, historyMessages, requestId, context);
    },
    [addUserMessage, startAssistantMessage, isStreaming, settings, activeTabId]
  );

  return { sendMessage, isStreaming };
}
