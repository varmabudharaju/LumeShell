import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/lumeshell-test' },
}));

import {
  listDirectory,
  deleteFileOrDir,
  renameFileOrDir,
  createFileOrDir,
  getPermissions,
  setPermissions,
  readFile,
  writeFile,
} from '../../../src/main/file-explorer';

const home = os.homedir();
const TEST_DIR = path.join(home, '.lumeshell-explorer-test');

describe('File Explorer Unit Tests', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('listDirectory', () => {
    it('returns files and directories with correct metadata', () => {
      fs.writeFileSync(path.join(TEST_DIR, 'file.txt'), 'hello');
      fs.mkdirSync(path.join(TEST_DIR, 'subdir'));

      const entries = listDirectory(TEST_DIR);
      expect(entries.length).toBe(2);

      const dir = entries.find((e) => e.name === 'subdir');
      const file = entries.find((e) => e.name === 'file.txt');
      expect(dir?.isDirectory).toBe(true);
      expect(file?.isDirectory).toBe(false);
      expect(file?.size).toBe(5);
    });

    it('hides dotfiles when showHidden=false', () => {
      fs.writeFileSync(path.join(TEST_DIR, '.hidden'), 'secret');
      fs.writeFileSync(path.join(TEST_DIR, 'visible.txt'), 'public');

      const entries = listDirectory(TEST_DIR, false);
      expect(entries.map((e) => e.name)).not.toContain('.hidden');
      expect(entries.map((e) => e.name)).toContain('visible.txt');
    });

    it('shows dotfiles when showHidden=true', () => {
      fs.writeFileSync(path.join(TEST_DIR, '.hidden'), 'secret');

      const entries = listDirectory(TEST_DIR, true);
      expect(entries.map((e) => e.name)).toContain('.hidden');
    });

    it('sorts directories before files', () => {
      fs.writeFileSync(path.join(TEST_DIR, 'zebra.txt'), '');
      fs.mkdirSync(path.join(TEST_DIR, 'alpha'));

      const entries = listDirectory(TEST_DIR);
      expect(entries[0].name).toBe('alpha');
      expect(entries[0].isDirectory).toBe(true);
    });

    it('rejects listing outside $HOME', () => {
      expect(() => listDirectory('/etc')).toThrow('Access denied');
    });
  });

  describe('deleteFileOrDir', () => {
    it('removes a file', () => {
      const filePath = path.join(TEST_DIR, 'to-delete.txt');
      fs.writeFileSync(filePath, 'bye');
      deleteFileOrDir(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('removes a directory recursively', () => {
      const dirPath = path.join(TEST_DIR, 'to-delete-dir');
      fs.mkdirSync(dirPath);
      fs.writeFileSync(path.join(dirPath, 'child.txt'), 'nested');
      deleteFileOrDir(dirPath);
      expect(fs.existsSync(dirPath)).toBe(false);
    });

    it('rejects paths outside $HOME', () => {
      expect(() => deleteFileOrDir('/tmp/some-file')).toThrow('Access denied');
    });
  });

  describe('renameFileOrDir', () => {
    it('renames and returns new path', () => {
      const oldPath = path.join(TEST_DIR, 'old-name.txt');
      fs.writeFileSync(oldPath, 'content');

      const newPath = renameFileOrDir(oldPath, 'new-name.txt');
      expect(path.basename(newPath)).toBe('new-name.txt');
      expect(fs.existsSync(newPath)).toBe(true);
      expect(fs.existsSync(oldPath)).toBe(false);
    });

    it('rejects path traversal', () => {
      const testFile = path.join(TEST_DIR, 'safe.txt');
      fs.writeFileSync(testFile, 'content');
      expect(() => renameFileOrDir(testFile, '../escape.txt')).toThrow('must not contain');
    });
  });

  describe('createFileOrDir', () => {
    it('creates an empty file', () => {
      const result = createFileOrDir(TEST_DIR, 'new-file.txt', false);
      expect(fs.existsSync(result)).toBe(true);
      expect(fs.readFileSync(result, 'utf-8')).toBe('');
    });

    it('creates a directory', () => {
      const result = createFileOrDir(TEST_DIR, 'new-dir', true);
      expect(fs.statSync(result).isDirectory()).toBe(true);
    });
  });

  describe('getPermissions / setPermissions', () => {
    it('returns correct mode', () => {
      const filePath = path.join(TEST_DIR, 'perm-test.txt');
      fs.writeFileSync(filePath, 'test');
      fs.chmodSync(filePath, 0o755);

      const perms = getPermissions(filePath);
      expect(perms.mode).toBe(0o755);
      expect(perms.readable).toBe('rwxr-xr-x');
    });

    it('changes the mode', () => {
      const filePath = path.join(TEST_DIR, 'chmod-test.txt');
      fs.writeFileSync(filePath, 'test');
      setPermissions(filePath, 0o644);

      const stat = fs.statSync(filePath);
      expect(stat.mode & 0o777).toBe(0o644);
    });

    it('rejects invalid mode', () => {
      const filePath = path.join(TEST_DIR, 'invalid-mode.txt');
      fs.writeFileSync(filePath, 'test');
      expect(() => setPermissions(filePath, -1)).toThrow('Invalid mode');
      expect(() => setPermissions(filePath, 0o1000)).toThrow('Invalid mode');
    });
  });

  describe('readFile / writeFile', () => {
    it('reads file content as UTF-8', () => {
      const filePath = path.join(TEST_DIR, 'read-test.txt');
      fs.writeFileSync(filePath, 'hello world', 'utf-8');
      expect(readFile(filePath)).toBe('hello world');
    });

    it('writes content and creates file', () => {
      const filePath = path.join(TEST_DIR, 'write-test.txt');
      writeFile(filePath, 'new content');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content');
    });

    it('rejects reading outside $HOME', () => {
      expect(() => readFile('/etc/passwd')).toThrow('Access denied');
    });

    it('rejects writing outside $HOME', () => {
      expect(() => writeFile('/tmp/evil.txt', 'bad')).toThrow('Access denied');
    });
  });
});
