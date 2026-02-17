import React, { useState, useRef, useEffect } from 'react';
import { useTerminalStore } from '../../stores/terminal-store';
import { useSettingsStore } from '../../stores/settings-store';

interface CommandCardProps {
  command: string;
}

const riskStyles: Record<string, { bg: string; text: string }> = {
  safe: { bg: 'var(--sb-green)', text: '#ffffff' },
  moderate: { bg: 'var(--sb-yellow)', text: '#ffffff' },
  dangerous: { bg: 'var(--sb-red)', text: '#ffffff' },
};

export const CommandCard: React.FC<CommandCardProps> = ({ command }) => {
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const settings = useSettingsStore((s) => s.settings);
  const [explanation, setExplanation] = useState<{
    explanation: string;
    riskLevel: 'safe' | 'moderate' | 'dangerous';
    sideEffects: string[];
    reversible: boolean;
  } | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // BUG-L09: Cancel pending explain request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleRun = () => {
    if (!activeTabId) return;
    window.lumeshell.terminal.runCommand(activeTabId, command);
  };

  const handleExplain = async () => {
    if (isExplaining) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsExplaining(true);
    try {
      const provider = settings?.activeProvider || 'ollama';
      const result = await window.lumeshell.ai.explainCommand(provider, command);
      if (controller.signal.aborted) return;
      setExplanation(result);
    } catch {
      if (controller.signal.aborted) return;
      setExplanation({
        explanation: 'Failed to analyze command',
        riskLevel: 'moderate',
        sideEffects: [],
        reversible: false,
      });
    } finally {
      if (!controller.signal.aborted) setIsExplaining(false);
    }
  };

  const risk = explanation ? riskStyles[explanation.riskLevel] : null;

  return (
    <div className="my-2 card-3d overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: 'var(--sb-bg-surface)' }}
      >
        <code className="text-xs font-mono break-all flex-1" style={{ color: 'var(--sb-text-primary)' }}>
          $ {command}
        </code>
        <div className="flex items-center gap-1.5 ml-3 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={handleRun}
            disabled={!activeTabId}
            title="Run this command in terminal"
            className="btn-3d-sm btn-3d-success px-2.5 py-1 text-[11px] font-medium rounded-md glow-success"
          >
            Run
          </button>
          <button
            onClick={handleExplain}
            disabled={isExplaining}
            title="Explain what this command does"
            className="btn-3d-sm px-2.5 py-1 text-[11px] font-medium rounded-md"
          >
            {isExplaining ? '...' : 'Explain'}
          </button>
        </div>
      </div>

      {explanation && (
        <div className="px-3 py-2.5 space-y-2" style={{ background: 'var(--sb-bg-body)', borderTop: '1px solid var(--sb-border)' }}>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: risk?.bg, color: risk?.text }}
            >
              {explanation.riskLevel}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--sb-text-secondary)' }}>
              {explanation.reversible ? 'Reversible' : 'Not reversible'}
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--sb-text-primary)' }}>
            {explanation.explanation}
          </p>
          {explanation.sideEffects.length > 0 && (
            <p className="text-[11px]" style={{ color: 'var(--sb-text-secondary)' }}>
              Side effects: {explanation.sideEffects.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
