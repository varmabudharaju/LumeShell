import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';
import { detectDefaultShell } from './shell-detector';
import { IPC } from '../../shared/constants';
import os from 'os';
import { execFile } from 'child_process';

interface PtyInstance {
  process: pty.IPty;
  commandBuffer: string;
}

interface WarmPty {
  process: pty.IPty;
  shell: string;
  createdAt: number;
}

const POOL_SIZE = 2; // Keep 2 warm PTYs ready
const POOL_MAX_AGE = 60000; // Refresh warm PTYs after 60s

class PtyManager {
  private instances = new Map<string, PtyInstance>();
  private mainWindow: BrowserWindow | null = null;
  private warmPool: WarmPty[] = [];
  private poolInterval: ReturnType<typeof setInterval> | null = null;

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win;
    // Start warming pool when window is ready
    this.initPool();
  }

  private initPool(): void {
    // Fill pool initially
    this.fillPool();
    // Periodically refresh stale PTYs
    this.poolInterval = setInterval(() => this.maintainPool(), 30000);
  }

  private fillPool(): void {
    while (this.warmPool.length < POOL_SIZE) {
      try {
        const warm = this.spawnWarmPty();
        if (warm) this.warmPool.push(warm);
      } catch {
        break; // Stop if spawn fails
      }
    }
  }

  private spawnWarmPty(): WarmPty | null {
    const shell = detectDefaultShell();
    const home = os.homedir();
    try {
      const proc = pty.spawn(shell, ['--login'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: home,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          LANG: process.env.LANG || 'en_US.UTF-8',
        } as Record<string, string>,
      });
      return { process: proc, shell, createdAt: Date.now() };
    } catch {
      return null;
    }
  }

  private maintainPool(): void {
    const now = Date.now();
    // Remove stale PTYs
    this.warmPool = this.warmPool.filter((warm) => {
      if (now - warm.createdAt > POOL_MAX_AGE) {
        try { warm.process.kill(); } catch { /* ignore */ }
        return false;
      }
      return true;
    });
    // Refill
    this.fillPool();
  }

  private takeFromPool(): WarmPty | null {
    const warm = this.warmPool.shift() || null;
    // Async refill
    setTimeout(() => this.fillPool(), 0);
    return warm;
  }

  private static readonly MAX_PTY_COUNT = 20;

  create(id: string, cols?: number, rows?: number): { pid: number; shell: string } {
    if (this.instances.size >= PtyManager.MAX_PTY_COUNT) {
      throw new Error(`Maximum terminal limit (${PtyManager.MAX_PTY_COUNT}) reached`);
    }
    // Try to use a warm PTY from the pool
    const warm = this.takeFromPool();
    let proc: pty.IPty;
    let shell: string;

    if (warm) {
      proc = warm.process;
      shell = warm.shell;
      // Resize to requested dimensions
      try {
        proc.resize(cols || 80, rows || 24);
      } catch { /* ignore */ }
    } else {
      // Fallback: spawn fresh
      shell = detectDefaultShell();
      const home = os.homedir();
      proc = pty.spawn(shell, ['--login'], {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: home,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          LANG: process.env.LANG || 'en_US.UTF-8',
        } as Record<string, string>,
      });
    }

    const instance: PtyInstance = {
      process: proc,
      commandBuffer: '',
    };

    proc.onData((data: string) => {
      try {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send(IPC.TERMINAL_DATA, id, data);
        }
      } catch {
        // Window destroyed, ignore
      }
    });

    proc.onExit(({ exitCode }) => {
      try {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send(IPC.TERMINAL_EXIT, id, exitCode);
        }
      } catch {
        // Window destroyed, ignore
      }
      this.instances.delete(id);
    });

    this.instances.set(id, instance);
    return { pid: proc.pid, shell };
  }

  write(id: string, data: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;

    // Track command buffer for history + autocomplete
    if (data === '\r' || data === '\n') {
      const cmd = instance.commandBuffer.trim();
      if (cmd.length > 0) {
        this.mainWindow?.webContents.send(IPC.TERMINAL_COMMAND_ENTERED, id, cmd);
      }
      instance.commandBuffer = '';
    } else if (data === '\x7f') {
      // backspace
      instance.commandBuffer = instance.commandBuffer.slice(0, -1);
    } else if (data === '\x03') {
      // Ctrl+C clears buffer
      instance.commandBuffer = '';
    } else if (data === '\x1b[C' || data === '\x1b[D' || data === '\x1b[A' || data === '\x1b[B') {
      // Arrow keys — clear buffer (user is navigating shell history)
      instance.commandBuffer = '';
    } else {
      // Handle both single keystrokes and pasted multi-char text
      for (const char of data) {
        if (char.charCodeAt(0) >= 32) {
          instance.commandBuffer += char;
        }
      }
    }

    // Broadcast current input buffer for autocomplete
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(IPC.TERMINAL_INPUT_BUFFER, id, instance.commandBuffer);
      }
    } catch { /* ignore */ }

    instance.process.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    try {
      instance.process.resize(cols, rows);
    } catch {
      // ignore resize errors on dead processes
    }
  }

  kill(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    instance.process.kill();
    this.instances.delete(id);
  }

  killAll(): void {
    for (const [id] of this.instances) {
      this.kill(id);
    }
    // Clean up warm pool
    for (const warm of this.warmPool) {
      try { warm.process.kill(); } catch { /* ignore */ }
    }
    this.warmPool = [];
    if (this.poolInterval) {
      clearInterval(this.poolInterval);
      this.poolInterval = null;
    }
  }

  sendSignal(id: string, signal: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    if (signal === 'SIGINT') {
      instance.process.write('\x03');
    } else if (signal === 'SIGTSTP') {
      instance.process.write('\x1a');
    }
  }

  getCwd(id: string): Promise<string> {
    const instance = this.instances.get(id);
    if (!instance) return Promise.resolve(os.homedir());
    return new Promise((resolve) => {
      execFile('lsof', ['-p', String(instance.process.pid)], { encoding: 'utf-8', timeout: 5000 }, (err, stdout) => {
        if (err || !stdout) {
          resolve(os.homedir());
          return;
        }
        const match = stdout.split('\n').find((line) => line.includes('cwd'));
        if (match) {
          const parts = match.trim().split(/\s+/);
          const cwd = parts[parts.length - 1];
          resolve(cwd || os.homedir());
        } else {
          resolve(os.homedir());
        }
      });
    });
  }

  writeCommand(id: string, command: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    // BUG-L03: Strip embedded newlines/carriage returns to prevent multi-command injection
    const sanitized = command.replace(/[\r\n]/g, ' ');
    instance.process.write(sanitized + '\r');
  }
}

export const ptyManager = new PtyManager();
