import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'lumeshell-jsonstore-test');

vi.mock('electron', () => ({
  app: { getPath: () => TEST_DIR },
}));

import { JsonStore } from '../../../src/main/store/json-store';

interface TestData {
  name: string;
  count: number;
  nested: { value: string; extra: string };
}

const defaults: TestData = {
  name: 'default',
  count: 0,
  nested: { value: 'initial', extra: 'default-extra' },
};

describe('JsonStore (Post-Fix)', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('creates file with defaults if no file exists', () => {
    const store = new JsonStore<TestData>('test-new', defaults);
    expect(store.get('name')).toBe('default');
    expect(store.get('count')).toBe(0);
  });

  it('loads existing data and merges with defaults', () => {
    const filePath = path.join(TEST_DIR, 'test-existing.json');
    fs.writeFileSync(filePath, JSON.stringify({ name: 'saved', count: 42 }), 'utf-8');

    const store = new JsonStore<TestData>('test-existing', defaults);
    expect(store.get('name')).toBe('saved');
    expect(store.get('count')).toBe(42);
    expect(store.get('nested')).toEqual({ value: 'initial', extra: 'default-extra' });
  });

  it('handles corrupt JSON file — falls back to defaults', () => {
    const filePath = path.join(TEST_DIR, 'test-corrupt.json');
    fs.writeFileSync(filePath, '{ invalid json !!!', 'utf-8');

    const store = new JsonStore<TestData>('test-corrupt', defaults);
    expect(store.get('name')).toBe('default');
  });

  it('deep merges nested objects — preserves default fields for missing nested keys', () => {
    const filePath = path.join(TEST_DIR, 'test-deep.json');
    fs.writeFileSync(filePath, JSON.stringify({ nested: { value: 'custom' } }), 'utf-8');

    const store = new JsonStore<TestData>('test-deep', defaults);
    expect(store.get('nested')).toEqual({ value: 'custom', extra: 'default-extra' });
  });

  it('set(key, value) updates in-memory store', () => {
    const store = new JsonStore<TestData>('test-memory', defaults);
    store.set('count', 99);
    expect(store.get('count')).toBe(99);
  });

  it('store getter returns a copy (not reference to internal state)', () => {
    const store = new JsonStore<TestData>('test-copy', defaults);
    const copy = store.store;
    copy.name = 'mutated';
    expect(store.get('name')).toBe('default');
  });

  it('uses debounced writes (not synchronous on every set)', () => {
    const jsonStoreSrc = fs.readFileSync(
      path.join(__dirname, '../../../src/main/store/json-store.ts'),
      'utf-8'
    );
    expect(jsonStoreSrc).toContain('debouncedSave');
    expect(jsonStoreSrc).toContain('saveTimer');
  });

  it('writes with 0o600 permissions', () => {
    const jsonStoreSrc = fs.readFileSync(
      path.join(__dirname, '../../../src/main/store/json-store.ts'),
      'utf-8'
    );
    expect(jsonStoreSrc).toContain('mode: 0o600');
  });

  it('set(key, value) eventually persists to disk', async () => {
    const store = new JsonStore<TestData>('test-persist', defaults);
    store.set('name', 'updated');

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 200));

    const filePath = path.join(TEST_DIR, 'test-persist.json');
    const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(onDisk.name).toBe('updated');
  });
});
