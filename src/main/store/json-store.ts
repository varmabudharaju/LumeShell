import { app } from 'electron';
import path from 'path';
import fs from 'fs';

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal !== null &&
      sourceVal !== undefined &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal) &&
      targetVal !== null
    ) {
      result[key] = deepMerge(targetVal as any, sourceVal as any);
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T];
    }
  }
  return result;
}

export class JsonStore<T extends Record<string, any>> {
  private filePath: string;
  private data: T;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(name: string, defaults: T) {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, `${name}.json`);

    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.data = deepMerge(defaults, JSON.parse(raw));
    } catch {
      this.data = { ...defaults };
    }
  }

  get store(): T {
    return { ...this.data };
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value;
    this.debouncedSave();
  }

  /** Immediately flush any pending debounced writes — call on app quit */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.save();
    }
  }

  private debouncedSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 100);
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
      });
    } catch (err) {
      console.error('Failed to save store:', err);
    }
  }
}
