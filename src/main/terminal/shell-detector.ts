import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import os from 'os';

export function detectDefaultShell(): string {
  // Try dscl first (most reliable on macOS)
  try {
    const username = os.userInfo().username;
    const result = execFileSync('dscl', ['.', '-read', `/Users/${username}`, 'UserShell'], {
      encoding: 'utf-8',
    });
    const match = result.match(/UserShell:\s*(.+)/);
    if (match) {
      const shell = match[1].trim();
      if (existsSync(shell)) return shell;
    }
  } catch {
    // fall through
  }

  // Try SHELL env
  const env = process.env.SHELL;
  if (env && existsSync(env)) return env;

  // Default to zsh on macOS
  if (existsSync('/bin/zsh')) return '/bin/zsh';
  return '/bin/bash';
}
