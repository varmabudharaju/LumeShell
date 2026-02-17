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
  readFile,
  writeFile,
  setPermissions,
  validatePath,
} from '../../src/main/file-explorer';

const home = os.homedir();
const TEST_DIR = path.join(home, '.lumeshell-security-test');

describe('File Explorer Security — Path Validation', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('validatePath', () => {
    it('rejects paths outside $HOME', () => {
      expect(() => validatePath('/etc/passwd')).toThrow('Access denied');
      expect(() => validatePath('/tmp/something')).toThrow('Access denied');
      expect(() => validatePath('/')).toThrow('Access denied');
    });

    it('rejects null bytes', () => {
      expect(() => validatePath(`${home}/test\x00.txt`)).toThrow('null bytes');
    });

    it('rejects empty string', () => {
      expect(() => validatePath('')).toThrow('Invalid path');
    });

    it('rejects sensitive directories', () => {
      expect(() => validatePath(`${home}/.ssh`)).toThrow('protected directory');
      expect(() => validatePath(`${home}/.ssh/id_rsa`)).toThrow('protected directory');
      expect(() => validatePath(`${home}/.gnupg`)).toThrow('protected directory');
      expect(() => validatePath(`${home}/.aws`)).toThrow('protected directory');
    });

    it('allows paths within $HOME', () => {
      expect(() => validatePath(TEST_DIR)).not.toThrow();
      expect(() => validatePath(path.join(TEST_DIR, 'file.txt'))).not.toThrow();
    });
  });

  describe('deleteFileOrDir', () => {
    it('rejects paths outside $HOME', () => {
      expect(() => deleteFileOrDir('/etc/hosts')).toThrow('Access denied');
    });

    it('rejects "/" as input', () => {
      expect(() => deleteFileOrDir('/')).toThrow('Access denied');
    });

    it('rejects $HOME itself', () => {
      expect(() => deleteFileOrDir(home)).toThrow('Access denied');
    });

    it('removes force:true — uses recursive without force', () => {
      const src = deleteFileOrDir.toString();
      expect(src).not.toContain('force: true');
    });

    it('deletes a file within $HOME', () => {
      const testFile = path.join(TEST_DIR, 'delete-me.txt');
      fs.writeFileSync(testFile, 'test');
      deleteFileOrDir(testFile);
      expect(fs.existsSync(testFile)).toBe(false);
    });
  });

  describe('renameFileOrDir', () => {
    it('rejects path traversal in newName (../ attack)', () => {
      const testFile = path.join(TEST_DIR, 'innocent.txt');
      fs.writeFileSync(testFile, 'test');
      expect(() => renameFileOrDir(testFile, '../../traversed.txt')).toThrow('must not contain');
    });

    it('rejects absolute paths in newName', () => {
      const testFile = path.join(TEST_DIR, 'innocent2.txt');
      fs.writeFileSync(testFile, 'test');
      expect(() => renameFileOrDir(testFile, '/etc/malicious')).toThrow('must not contain');
    });

    it('allows normal renames within $HOME', () => {
      const testFile = path.join(TEST_DIR, 'old-name.txt');
      fs.writeFileSync(testFile, 'test');
      const result = renameFileOrDir(testFile, 'new-name.txt');
      expect(fs.existsSync(result)).toBe(true);
      expect(path.basename(result)).toBe('new-name.txt');
    });
  });

  describe('createFileOrDir', () => {
    it('rejects creating files outside $HOME', () => {
      expect(() => createFileOrDir('/tmp', 'evil.txt', false)).toThrow('Access denied');
    });

    it('rejects traversal in name', () => {
      expect(() => createFileOrDir(TEST_DIR, '../escape.txt', false)).toThrow('must not contain');
    });
  });

  describe('writeFile', () => {
    it('rejects writing outside $HOME', () => {
      expect(() => writeFile('/tmp/evil.txt', 'bad')).toThrow('Access denied');
    });

    it('writes within $HOME', () => {
      const testFile = path.join(TEST_DIR, 'write-test.txt');
      writeFile(testFile, 'safe content');
      expect(fs.readFileSync(testFile, 'utf-8')).toBe('safe content');
    });
  });

  describe('readFile', () => {
    it('rejects reading outside $HOME', () => {
      expect(() => readFile('/etc/passwd')).toThrow('Access denied');
    });
  });

  describe('setPermissions', () => {
    it('rejects paths outside $HOME', () => {
      expect(() => setPermissions('/etc/passwd', 0o777)).toThrow('Access denied');
    });

    it('rejects invalid mode values', () => {
      const testFile = path.join(TEST_DIR, 'perm-test.txt');
      fs.writeFileSync(testFile, 'test');
      expect(() => setPermissions(testFile, -1)).toThrow('Invalid mode');
      expect(() => setPermissions(testFile, 0o1000)).toThrow('Invalid mode');
      expect(() => setPermissions(testFile, NaN)).toThrow('Invalid mode');
    });
  });

  describe('listDirectory', () => {
    it('rejects listing outside $HOME', () => {
      expect(() => listDirectory('/etc')).toThrow('Access denied');
    });

    it('lists within $HOME', () => {
      fs.writeFileSync(path.join(TEST_DIR, 'listed.txt'), 'test');
      const entries = listDirectory(TEST_DIR);
      expect(entries.length).toBeGreaterThan(0);
    });
  });
});
