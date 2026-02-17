import { useEffect } from 'react';
import { useHistoryStore } from '../stores/history-store';

export function useCommandHistory() {
  const { loadHistory, addEntry } = useHistoryStore();

  useEffect(() => {
    loadHistory();

    const removeListener = window.lumeshell.terminal.onCommandEntered(
      (tabId, command) => {
        addEntry(command, tabId);
      }
    );

    return removeListener;
  }, [loadHistory, addEntry]);
}
