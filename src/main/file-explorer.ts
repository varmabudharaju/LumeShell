import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: number;
  permissions: string;
}

const SENSITIVE_DIRS = ['.ssh', '.gnupg', '.aws', '.config/gcloud'];

const SYSTEM_ROOTS = ['/', '/etc', '/usr', '/var', '/System', '/Library', '/bin', '/sbin', '/tmp'];

export function validatePath(targetPath: string): string {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Invalid path: path must be a non-empty string');
  }

  // Reject null bytes
  if (targetPath.includes('\x00')) {
    throw new Error('Invalid path: null bytes not allowed');
  }

  const resolved = path.resolve(targetPath);
  const home = os.homedir();

  // Must be within $HOME
  if (!resolved.startsWith(home + '/') && resolved !== home) {
    throw new Error(`Access denied: path must be within ${home}`);
  }

  // Reject $HOME itself for destructive operations (caller can override for reads)
  // Reject sensitive subdirectories
  const relative = path.relative(home, resolved);
  for (const sensitive of SENSITIVE_DIRS) {
    if (relative === sensitive || relative.startsWith(sensitive + '/')) {
      throw new Error(`Access denied: ${sensitive} is a protected directory`);
    }
  }

  // Resolve symlinks and re-check
  try {
    const real = fs.realpathSync(resolved);
    if (!real.startsWith(home + '/') && real !== home) {
      throw new Error('Access denied: symlink target is outside home directory');
    }
  } catch (e: any) {
    // ENOENT is ok — file doesn't exist yet (e.g. creating a new file)
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }

  return resolved;
}

function validatePathAllowHome(targetPath: string): string {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Invalid path: path must be a non-empty string');
  }
  if (targetPath.includes('\x00')) {
    throw new Error('Invalid path: null bytes not allowed');
  }
  const resolved = path.resolve(targetPath);
  const home = os.homedir();
  if (!resolved.startsWith(home + '/') && resolved !== home) {
    throw new Error(`Access denied: path must be within ${home}`);
  }
  return resolved;
}

function validateDeletePath(targetPath: string): string {
  const resolved = validatePath(targetPath);
  const home = os.homedir();

  // Never allow deleting $HOME itself
  if (resolved === home) {
    throw new Error('Access denied: cannot delete home directory');
  }

  // Reject system roots (extra safety)
  for (const root of SYSTEM_ROOTS) {
    if (resolved === root) {
      throw new Error(`Access denied: cannot delete ${root}`);
    }
  }

  // Require at least 3 path segments from root for recursive delete
  const segments = resolved.split('/').filter(Boolean);
  if (segments.length < 3) {
    throw new Error('Access denied: path too shallow for deletion');
  }

  return resolved;
}

function formatPermissions(mode: number): string {
  const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  const owner = perms[(mode >> 6) & 7];
  const group = perms[(mode >> 3) & 7];
  const other = perms[mode & 7];
  return `${owner}${group}${other}`;
}

export function listDirectory(dirPath: string, showHidden = false): FileEntry[] {
  try {
    const resolved = validatePathAllowHome(dirPath);
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      if (!showHidden && entry.name.startsWith('.')) continue;

      const fullPath = path.join(resolved, entry.name);
      try {
        // Use lstatSync as fallback for broken symlinks
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          stat = fs.lstatSync(fullPath);
        }
        result.push({
          name: entry.name,
          path: fullPath,
          isDirectory: stat.isDirectory(),
          size: stat.size,
          modified: stat.mtimeMs,
          permissions: formatPermissions(stat.mode),
        });
      } catch {
        // Skip files we can't stat at all
      }
    }

    // Sort: directories first, then alphabetical
    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  } catch (e: any) {
    if (e.message?.startsWith('Access denied') || e.message?.startsWith('Invalid path')) {
      throw e;
    }
    return [];
  }
}

export function deleteFileOrDir(targetPath: string): void {
  const resolved = validateDeletePath(targetPath);
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    fs.rmSync(resolved, { recursive: true });
  } else {
    fs.unlinkSync(resolved);
  }
}

export function renameFileOrDir(oldPath: string, newName: string): string {
  validatePath(oldPath);

  // Reject newName containing path separators or traversal
  if (!newName || typeof newName !== 'string') {
    throw new Error('Invalid name: must be a non-empty string');
  }
  if (newName.includes('/') || newName.includes('\\') || newName.includes('..')) {
    throw new Error('Invalid name: must not contain path separators or ".."');
  }
  if (newName.includes('\x00')) {
    throw new Error('Invalid name: null bytes not allowed');
  }

  const dir = path.dirname(oldPath);
  const newPath = path.join(dir, newName);
  const resolvedNew = validatePath(newPath);
  fs.renameSync(path.resolve(oldPath), resolvedNew);
  return resolvedNew;
}

export function createFileOrDir(parentPath: string, name: string, isDirectory: boolean): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid name: must be a non-empty string');
  }
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error('Invalid name: must not contain path separators or ".."');
  }

  const fullPath = path.join(parentPath, name);
  const resolved = validatePath(fullPath);
  if (isDirectory) {
    fs.mkdirSync(resolved, { recursive: true });
  } else {
    fs.writeFileSync(resolved, '', 'utf-8');
  }
  return resolved;
}

export function getPermissions(targetPath: string): { mode: number; readable: string } {
  const resolved = validatePath(targetPath);
  const stat = fs.statSync(resolved);
  return {
    mode: stat.mode & 0o777,
    readable: formatPermissions(stat.mode),
  };
}

export function setPermissions(targetPath: string, mode: number): void {
  if (typeof mode !== 'number' || !Number.isFinite(mode) || mode < 0 || mode > 0o777) {
    throw new Error('Invalid mode: must be a number between 0 and 0o777');
  }
  const resolved = validatePath(targetPath);
  fs.chmodSync(resolved, mode);
}

const MAX_READ_SIZE = 10 * 1024 * 1024; // 10 MB — BUG-L02

export function readFile(filePath: string): string {
  const resolved = validatePath(filePath); // BUG-L01: use strict validation (blocks .ssh, .gnupg, etc.)
  // BUG-L02: Check file size before reading to prevent OOM
  const stat = fs.statSync(resolved);
  if (stat.size > MAX_READ_SIZE) {
    throw new Error(`File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`);
  }
  return fs.readFileSync(resolved, 'utf-8');
}

export function writeFile(filePath: string, content: string): void {
  const resolved = validatePath(filePath);
  fs.writeFileSync(resolved, content, 'utf-8');
}

export function getHomePath(): string {
  return os.homedir();
}
