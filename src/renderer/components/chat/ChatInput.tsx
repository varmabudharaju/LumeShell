import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useHistoryStore } from '../../stores/history-store';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const historyEntries = useHistoryStore((s) => s.entries);

  // P5.2: Compute suggestions from history based on input
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];

    const seen = new Set<string>();
    const results: string[] = [];

    for (const entry of historyEntries) {
      const cmd = entry.command;
      const lower = cmd.toLowerCase();
      if (lower.includes(q) && !seen.has(lower)) {
        seen.add(lower);
        results.push(cmd);
        if (results.length >= 5) break;
      }
    }
    return results;
  }, [value, historyEntries]);

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0);
    setSelectedSuggestion(-1);
  }, [suggestions]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    setShowSuggestions(false);
  };

  const applySuggestion = useCallback((suggestion: string) => {
    setValue(suggestion);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Suggestion navigation
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        return;
      }
      if (e.key === 'Tab' && selectedSuggestion >= 0) {
        e.preventDefault();
        applySuggestion(suggestions[selectedSuggestion]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showSuggestions && selectedSuggestion >= 0) {
        applySuggestion(suggestions[selectedSuggestion]);
      } else {
        handleSubmit();
      }
    }
  };

  const canSend = value.trim() && !disabled;

  return (
    <div
      className="p-4 relative"
      style={{
        borderTop: '1px solid var(--sb-border)',
        background: 'var(--sb-bg-base)',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* P5.2: Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-4 right-4 bottom-full mb-1 rounded-lg overflow-hidden z-50"
          style={{
            background: 'var(--sb-bg-overlay)',
            border: '1px solid var(--sb-border-strong)',
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div className="px-3 py-1.5 text-[10px] font-medium" style={{ color: 'var(--sb-text-muted)', borderBottom: '1px solid var(--sb-border)' }}>
            History suggestions
          </div>
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              title={`Use: ${suggestion}`}
              className="w-full px-3 py-1.5 text-left text-xs font-mono truncate transition-colors"
              style={{
                color: i === selectedSuggestion ? 'var(--sb-text-primary)' : 'var(--sb-text-secondary)',
                background: i === selectedSuggestion ? 'var(--sb-bg-active)' : 'transparent',
              }}
              onMouseEnter={() => setSelectedSuggestion(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                applySuggestion(suggestion);
              }}
            >
              <span style={{ color: 'var(--sb-text-muted)', marginRight: 6 }}>$</span>
              {suggestion}
            </button>
          ))}
          <div className="px-3 py-1 text-[10px]" style={{ color: 'var(--sb-text-placeholder)', borderTop: '1px solid var(--sb-border)' }}>
            Tab to complete · Esc to dismiss
          </div>
        </div>
      )}

      <div className="card-3d flex items-end" style={{ padding: '12px 16px' }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          placeholder="Ask a question..."
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-sm resize-none outline-none"
          style={{
            color: 'var(--sb-text-primary)',
            minHeight: '22px',
            maxHeight: '120px',
            caretColor: 'var(--sb-accent-blue)',
            paddingRight: '12px',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          title="Send message"
          className={`btn-3d-icon shrink-0 ${canSend ? 'btn-3d-success glow-success' : ''}`}
          style={{
            width: '36px',
            height: '36px',
            background: canSend
              ? 'linear-gradient(145deg, var(--sb-green-bright), var(--sb-green))'
              : 'var(--sb-bg-surface)',
            color: canSend ? '#ffffff' : 'var(--sb-text-placeholder)',
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      <div className="text-[10px] mt-2 text-center" style={{ color: 'var(--sb-text-placeholder)' }}>
        Enter to send · Shift+Enter for new line
      </div>
    </div>
  );
};
