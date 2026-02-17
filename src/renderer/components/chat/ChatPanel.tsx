import React, { useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chat-store';
import { useAIChat } from '../../hooks/useAIChat';
import { useUIStore } from '../../stores/ui-store';
import { useSettingsStore } from '../../stores/settings-store';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export const ChatPanel: React.FC = () => {
  const { messages, clearMessages } = useChatStore();
  const { sendMessage, isStreaming } = useAIChat();
  const chatPanelWidth = useUIStore((s) => s.chatPanelWidth);
  const provider = useSettingsStore((s) => s.settings?.activeProvider || 'ollama');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      className="flex flex-col h-full shrink-0"
      style={{
        width: chatPanelWidth,
        background: 'var(--sb-bg-body)',
        borderLeft: '1px solid var(--sb-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-[44px] shrink-0"
        style={{
          background: 'var(--sb-bg-base)',
          borderBottom: '1px solid var(--sb-border)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full glow-success" style={{ background: 'var(--sb-green-bright)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--sb-text-primary)' }}>
            AI Assistant
          </span>
          <span className="pill-3d text-[10px]">{provider}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearMessages} className="btn-3d-icon-sm" title="Clear chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <button onClick={() => useUIStore.getState().setChatPanelMinimized(true)} className="btn-3d-icon-sm" title="Minimize chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--sb-bg-active)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sb-accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--sb-text-primary)' }}>
              Ask me anything
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--sb-text-muted)' }}>
              Get shell commands, explanations, and run them directly in your terminal.
            </p>
            <div className="mt-4 flex flex-col gap-2 w-full">
              {['How do I find large files?', 'Show my disk usage', 'List running processes'].map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  title={`Ask: ${q}`}
                  className="btn-3d text-xs text-left px-3 py-2.5 rounded-lg"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
};
