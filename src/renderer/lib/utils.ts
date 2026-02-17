export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function extractCommandBlocks(markdown: string): string[] {
  const regex = /```(?:bash|sh|shell|zsh)?\n([\s\S]*?)```/g;
  const commands: string[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const block = match[1].trim();
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => {
        if (!l) return false;
        // Skip comments
        if (l.startsWith('#')) return false;
        // Skip lines that are clearly output (pure paths, numbers, blank-ish)
        if (/^\/[\w\/.\-]+$/.test(l)) return false;
        // Skip lines that look like output (no command structure)
        if (/^\d+(\.\d+)*\s*(GB|MB|KB|bytes)/i.test(l)) return false;
        // Must contain at least one command-like word
        return true;
      });
    // Combine multi-line commands (lines ending with \)
    const combined: string[] = [];
    let current = '';
    for (const line of lines) {
      if (line.endsWith('\\')) {
        current += line.slice(0, -1).trim() + ' ';
      } else {
        current += line;
        combined.push(current.trim());
        current = '';
      }
    }
    if (current.trim()) combined.push(current.trim());
    commands.push(...combined);
  }
  return commands;
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
