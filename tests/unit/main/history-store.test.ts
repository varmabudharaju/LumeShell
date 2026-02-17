import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'lumeshell-history-test');

vi.mock('electron', () => ({
  app: { getPath: () => TEST_DIR },
}));

import {
  getAllHistory,
  addHistoryEntry,
  toggleBookmark,
  deleteHistoryEntry,
  clearHistory,
} from '../../../src/main/store/history-store';

describe('History Store', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    // Reset module state by clearing any existing store file
    const filePath = path.join(TEST_DIR, 'history.json');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  afterEach(() => {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('addHistoryEntry creates entry with correct fields', () => {
    const entry = addHistoryEntry('ls -la', 'tab-1');
    expect(entry.command).toBe('ls -la');
    expect(entry.tabId).toBe('tab-1');
    expect(entry.bookmarked).toBe(false);
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.id).toMatch(/^\d+-[a-z0-9]+$/);
  });

  it('addHistoryEntry adds entries with unique IDs', () => {
    const e1 = addHistoryEntry('cmd1', 'tab-1');
    const e2 = addHistoryEntry('cmd2', 'tab-1');
    expect(e1.id).not.toBe(e2.id);
  });

  it('getAllHistory returns entries', () => {
    addHistoryEntry('cmd1', 'tab-1');
    addHistoryEntry('cmd2', 'tab-1');
    const all = getAllHistory();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('toggleBookmark flips the bookmarked field', () => {
    const entry = addHistoryEntry('cmd-bm', 'tab-1');
    const toggled = toggleBookmark(entry.id);
    expect(toggled?.bookmarked).toBe(true);

    const toggled2 = toggleBookmark(entry.id);
    expect(toggled2?.bookmarked).toBe(false);
  });

  it('toggleBookmark returns null for unknown id', () => {
    const result = toggleBookmark('nonexistent-id');
    expect(result).toBeNull();
  });

  it('deleteHistoryEntry removes the entry', () => {
    const entry = addHistoryEntry('to-delete', 'tab-1');
    deleteHistoryEntry(entry.id);
    const all = getAllHistory();
    expect(all.find((e) => e.id === entry.id)).toBeUndefined();
  });

  it('clearHistory empties the array', () => {
    addHistoryEntry('cmd1', 'tab-1');
    addHistoryEntry('cmd2', 'tab-1');
    clearHistory();
    expect(getAllHistory()).toEqual([]);
  });
});
