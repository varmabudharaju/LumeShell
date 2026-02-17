import React, { useMemo } from 'react';
import type { ChatMessage as ChatMessageType } from '../../types/chat';
import { CommandCard } from './CommandCard';

interface ChatMessageProps {
  message: ChatMessageType;
}

function extractBlocks(markdown: string): Array<{ type: 'text'; content: string } | { type: 'commands'; commands: string[] }> {
  const parts: Array<{ type: 'text'; content: string } | { type: 'commands'; commands: string[] }> = [];
  const regex = /```(?:bash|sh|shell|zsh)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    // Text before code block
    const textBefore = markdown.slice(lastIndex, match.index).trim();
    if (textBefore) {
      parts.push({ type: 'text', content: textBefore });
    }

    // Parse commands from code block
    const block = match[1].trim();
    const commands = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => {
        if (!l || l.startsWith('#')) return false;
        if (/^\/[\w\/.\-]+$/.test(l)) return false;
        if (/^\d+(\.\d+)*\s*(GB|MB|KB|bytes)/i.test(l)) return false;
        return true;
      });

    if (commands.length > 0) {
      parts.push({ type: 'commands', commands });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  const remaining = markdown.slice(lastIndex).trim();
  if (remaining) {
    parts.push({ type: 'text', content: remaining });
  }

  return parts;
}

export const ChatMessage: React.FC<ChatMessageProps> = React.memo(({ message }) => {
  const isUser = message.role === 'user';

  const blocks = useMemo(() => {
    if (isUser || message.isStreaming) {
      return [{ type: 'text' as const, content: message.content }];
    }
    return extractBlocks(message.content);
  }, [message.content, message.isStreaming, isUser]);

  return (
    <div className={`px-4 py-2 ${isUser ? 'flex justify-end' : ''}`}>
      {isUser ? (
        <div
          className="max-w-[85%] px-3 py-2 rounded-xl text-sm"
          style={{
            background: 'linear-gradient(145deg, var(--sb-accent-blue), #2563eb)',
            color: '#ffffff',
            boxShadow: '3px 3px 6px rgba(0,0,0,0.3), -1px -1px 3px rgba(255,255,255,0.05)'
          }}
        >
          {message.content}
        </div>
      ) : (
        <div className="text-sm" style={{ color: 'var(--sb-text-primary)' }}>
          {blocks.map((block, i) => (
            <React.Fragment key={i}>
              {block.type === 'text' && block.content && (
                <div className="whitespace-pre-wrap leading-relaxed my-1">
                  {block.content}
                </div>
              )}
              {block.type === 'commands' && block.commands.map((cmd, j) => (
                <CommandCard key={`${i}-${j}`} command={cmd} />
              ))}
            </React.Fragment>
          ))}
          {message.isStreaming && (
            <span
              className="inline-block w-1.5 h-4 rounded-sm animate-pulse ml-0.5"
              style={{ background: 'var(--sb-accent-blue)' }}
            />
          )}
        </div>
      )}
    </div>
  );
});
