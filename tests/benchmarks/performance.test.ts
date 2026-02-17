/**
 * LumeShell Performance Benchmarks
 *
 * Measures key performance metrics and compares with baseline expectations.
 * Run with: npm run test:bench
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn, ChildProcess } from 'child_process';
import os from 'os';

// Benchmark utilities
function measureTime(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

async function measureTimeAsync(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

function runMultipleTimes(fn: () => number, iterations: number): { avg: number; min: number; max: number; stdDev: number } {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    times.push(fn());
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  return { avg, min, max, stdDev };
}

const TEST_DIR = path.join(os.tmpdir(), 'lumeshell-bench');
const ITERATIONS = 10;

describe('Performance Benchmarks', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('File System Operations', () => {
    it('BENCH: listDirectory performance', () => {
      // Create test files
      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(path.join(TEST_DIR, `file-${i}.txt`), `content ${i}`);
      }
      for (let i = 0; i < 20; i++) {
        fs.mkdirSync(path.join(TEST_DIR, `dir-${i}`));
      }

      const results = runMultipleTimes(() => {
        return measureTime(() => {
          fs.readdirSync(TEST_DIR, { withFileTypes: true });
        });
      }, ITERATIONS);

      console.log(`\n📁 listDirectory (120 entries):`);
      console.log(`   Avg: ${results.avg.toFixed(3)}ms`);
      console.log(`   Min: ${results.min.toFixed(3)}ms | Max: ${results.max.toFixed(3)}ms`);
      console.log(`   StdDev: ${results.stdDev.toFixed(3)}ms`);

      // Should complete in under 50ms for 120 entries
      expect(results.avg).toBeLessThan(50);
    });

    it('BENCH: file read performance (various sizes)', () => {
      const sizes = [1024, 10240, 102400, 1024000]; // 1KB, 10KB, 100KB, 1MB

      console.log('\n📄 File Read Performance:');

      for (const size of sizes) {
        const filePath = path.join(TEST_DIR, `bench-${size}.txt`);
        fs.writeFileSync(filePath, 'x'.repeat(size));

        const results = runMultipleTimes(() => {
          return measureTime(() => {
            fs.readFileSync(filePath, 'utf-8');
          });
        }, ITERATIONS);

        const sizeLabel = size >= 1024000 ? `${size / 1024000}MB` : `${size / 1024}KB`;
        console.log(`   ${sizeLabel}: ${results.avg.toFixed(3)}ms (±${results.stdDev.toFixed(3)}ms)`);

        // Expectations based on size
        if (size <= 10240) expect(results.avg).toBeLessThan(5);
        else if (size <= 102400) expect(results.avg).toBeLessThan(20);
        else expect(results.avg).toBeLessThan(100);
      }
    });

    it('BENCH: file write performance', () => {
      const content = 'x'.repeat(10240); // 10KB

      const results = runMultipleTimes(() => {
        const filePath = path.join(TEST_DIR, `write-${Date.now()}-${Math.random()}.txt`);
        return measureTime(() => {
          fs.writeFileSync(filePath, content);
        });
      }, ITERATIONS);

      console.log(`\n✏️  File Write (10KB):`);
      console.log(`   Avg: ${results.avg.toFixed(3)}ms`);
      console.log(`   Min: ${results.min.toFixed(3)}ms | Max: ${results.max.toFixed(3)}ms`);

      expect(results.avg).toBeLessThan(20);
    });

    it('BENCH: recursive directory traversal', () => {
      // Create nested structure
      const depth = 5;
      const filesPerDir = 10;
      let currentDir = TEST_DIR;

      for (let d = 0; d < depth; d++) {
        for (let f = 0; f < filesPerDir; f++) {
          fs.writeFileSync(path.join(currentDir, `file-${f}.txt`), 'content');
        }
        const nextDir = path.join(currentDir, `level-${d}`);
        fs.mkdirSync(nextDir);
        currentDir = nextDir;
      }

      const results = runMultipleTimes(() => {
        return measureTime(() => {
          const walk = (dir: string): number => {
            let count = 0;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              count++;
              if (entry.isDirectory()) {
                count += walk(path.join(dir, entry.name));
              }
            }
            return count;
          };
          walk(TEST_DIR);
        });
      }, ITERATIONS);

      console.log(`\n🌲 Recursive Traversal (${depth} levels, ${filesPerDir} files/dir):`);
      console.log(`   Avg: ${results.avg.toFixed(3)}ms`);

      expect(results.avg).toBeLessThan(100);
    });
  });

  describe('Process Spawning', () => {
    it('BENCH: shell spawn time', () => {
      const results = runMultipleTimes(() => {
        return measureTime(() => {
          execSync('echo "test"', { encoding: 'utf-8', stdio: 'pipe' });
        });
      }, ITERATIONS);

      console.log(`\n🐚 Shell Spawn (echo):`);
      console.log(`   Avg: ${results.avg.toFixed(3)}ms`);
      console.log(`   Min: ${results.min.toFixed(3)}ms | Max: ${results.max.toFixed(3)}ms`);

      // Shell spawn should be under 100ms
      expect(results.avg).toBeLessThan(100);
    });

    it('BENCH: command execution latency', async () => {
      const commands = [
        { cmd: 'pwd', label: 'pwd' },
        { cmd: 'ls -la', label: 'ls -la' },
        { cmd: 'whoami', label: 'whoami' },
        { cmd: 'date', label: 'date' },
      ];

      console.log('\n⚡ Command Execution Latency:');

      for (const { cmd, label } of commands) {
        const results = runMultipleTimes(() => {
          return measureTime(() => {
            execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
          });
        }, ITERATIONS);

        console.log(`   ${label}: ${results.avg.toFixed(3)}ms (±${results.stdDev.toFixed(3)}ms)`);
        expect(results.avg).toBeLessThan(150);
      }
    });

    it('BENCH: PTY-like process creation', async () => {
      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = performance.now();

        await new Promise<void>((resolve) => {
          const proc = spawn('/bin/bash', ['-c', 'echo ready; exit 0'], {
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          proc.stdout?.on('data', () => {});
          proc.on('close', () => {
            times.push(performance.now() - start);
            resolve();
          });
        });
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`\n🔧 PTY-like Process Creation:`);
      console.log(`   Avg: ${avg.toFixed(3)}ms`);

      expect(avg).toBeLessThan(200);
    });
  });

  describe('Memory Operations', () => {
    it('BENCH: JSON parse/stringify (settings-like)', () => {
      const settingsData = {
        appearance: {
          fontFamily: 'JetBrains Mono',
          fontSize: 14,
          themeName: 'github-dark',
          terminalBackground: '#0d1117',
          terminalForeground: '#e6edf3',
          terminalCursor: '#388bfd',
        },
        ai: {
          provider: 'ollama',
          model: 'qwen2.5-coder:1.5b',
          apiKey: '',
        },
        recentPaths: Array(50).fill('/some/path/here'),
      };

      const jsonString = JSON.stringify(settingsData);

      const parseResults = runMultipleTimes(() => {
        return measureTime(() => {
          JSON.parse(jsonString);
        });
      }, ITERATIONS * 10);

      const stringifyResults = runMultipleTimes(() => {
        return measureTime(() => {
          JSON.stringify(settingsData);
        });
      }, ITERATIONS * 10);

      console.log(`\n📋 JSON Operations (settings object):`);
      console.log(`   Parse: ${parseResults.avg.toFixed(4)}ms`);
      console.log(`   Stringify: ${stringifyResults.avg.toFixed(4)}ms`);

      expect(parseResults.avg).toBeLessThan(1);
      expect(stringifyResults.avg).toBeLessThan(1);
    });

    it('BENCH: large data handling (history)', () => {
      // Simulate command history with 1000 entries
      const history = Array(1000).fill(null).map((_, i) => ({
        command: `command-${i} --flag=${i} /path/to/something/${i}`,
        timestamp: Date.now() - i * 1000,
        cwd: `/Users/test/project-${i % 10}`,
      }));

      const jsonString = JSON.stringify(history);
      console.log(`\n📜 History Data Size: ${(jsonString.length / 1024).toFixed(2)}KB`);

      const parseResults = runMultipleTimes(() => {
        return measureTime(() => {
          JSON.parse(jsonString);
        });
      }, ITERATIONS);

      const writeResults = runMultipleTimes(() => {
        const filePath = path.join(TEST_DIR, `history-${Date.now()}.json`);
        return measureTime(() => {
          fs.writeFileSync(filePath, jsonString);
        });
      }, ITERATIONS);

      console.log(`   Parse: ${parseResults.avg.toFixed(3)}ms`);
      console.log(`   Write to Disk: ${writeResults.avg.toFixed(3)}ms`);

      expect(parseResults.avg).toBeLessThan(10);
      expect(writeResults.avg).toBeLessThan(50);
    });
  });

  describe('String Processing', () => {
    it('BENCH: terminal output parsing', () => {
      // Simulate ANSI escape sequences in terminal output
      const ansiOutput = Array(100).fill(null).map((_, i) =>
        `\x1b[32m✓\x1b[0m Test ${i} passed \x1b[90m(${i}ms)\x1b[0m`
      ).join('\n');

      const results = runMultipleTimes(() => {
        return measureTime(() => {
          // Strip ANSI codes (common operation)
          ansiOutput.replace(/\x1b\[[0-9;]*m/g, '');
        });
      }, ITERATIONS * 10);

      console.log(`\n🎨 ANSI Strip (${ansiOutput.length} chars):`);
      console.log(`   Avg: ${results.avg.toFixed(4)}ms`);

      expect(results.avg).toBeLessThan(5);
    });

    it('BENCH: path operations', () => {
      const testPaths = Array(100).fill(null).map((_, i) =>
        `/Users/test/project/src/components/feature-${i}/Component.tsx`
      );

      const results = runMultipleTimes(() => {
        return measureTime(() => {
          for (const p of testPaths) {
            path.basename(p);
            path.dirname(p);
            path.extname(p);
            path.normalize(p);
          }
        });
      }, ITERATIONS);

      console.log(`\n📂 Path Operations (100 paths × 4 ops):`);
      console.log(`   Avg: ${results.avg.toFixed(3)}ms`);

      expect(results.avg).toBeLessThan(5);
    });
  });
});

describe('Reliability Tests', () => {
  const TEST_DIR = path.join(os.tmpdir(), 'lumeshell-reliability');

  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('Error Recovery', () => {
    it('handles non-existent file gracefully', () => {
      const nonExistent = path.join(TEST_DIR, 'does-not-exist.txt');

      expect(() => fs.readFileSync(nonExistent)).toThrow();

      // Verify we can continue after error
      const validFile = path.join(TEST_DIR, 'valid.txt');
      fs.writeFileSync(validFile, 'content');
      expect(fs.readFileSync(validFile, 'utf-8')).toBe('content');
    });

    it('handles permission denied scenarios', () => {
      if (process.platform === 'win32') return; // Skip on Windows

      const restrictedFile = path.join(TEST_DIR, 'restricted.txt');
      fs.writeFileSync(restrictedFile, 'secret');
      fs.chmodSync(restrictedFile, 0o000);

      expect(() => fs.readFileSync(restrictedFile)).toThrow();

      // Cleanup
      fs.chmodSync(restrictedFile, 0o644);
    });

    it('handles corrupt JSON gracefully', () => {
      const corruptFile = path.join(TEST_DIR, 'corrupt.json');
      fs.writeFileSync(corruptFile, '{ invalid json !!!');

      let parsed: unknown = null;
      let error: Error | null = null;

      try {
        parsed = JSON.parse(fs.readFileSync(corruptFile, 'utf-8'));
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(parsed).toBeNull();
    });

    it('handles concurrent file access', async () => {
      const sharedFile = path.join(TEST_DIR, 'shared.txt');
      fs.writeFileSync(sharedFile, '0');

      const operations = Array(10).fill(null).map(async (_, i) => {
        await new Promise(r => setTimeout(r, Math.random() * 10));
        const content = fs.readFileSync(sharedFile, 'utf-8');
        fs.writeFileSync(sharedFile, String(parseInt(content) + 1));
      });

      await Promise.all(operations);

      // Due to race conditions, final value may not be 10
      // This test verifies no crashes occur
      const finalValue = parseInt(fs.readFileSync(sharedFile, 'utf-8'));
      expect(finalValue).toBeGreaterThan(0);
      expect(finalValue).toBeLessThanOrEqual(10);
    });
  });

  describe('Resource Cleanup', () => {
    it('cleans up file handles properly', () => {
      const files: string[] = [];

      // Create and read many files
      for (let i = 0; i < 100; i++) {
        const filePath = path.join(TEST_DIR, `handle-${i}.txt`);
        fs.writeFileSync(filePath, `content ${i}`);
        fs.readFileSync(filePath);
        files.push(filePath);
      }

      // All files should be deletable (no lingering handles)
      for (const file of files) {
        expect(() => fs.unlinkSync(file)).not.toThrow();
      }
    });

    it('handles rapid create/delete cycles', () => {
      const filePath = path.join(TEST_DIR, 'cycle-test.txt');

      for (let i = 0; i < 50; i++) {
        fs.writeFileSync(filePath, `iteration ${i}`);
        expect(fs.existsSync(filePath)).toBe(true);
        fs.unlinkSync(filePath);
        expect(fs.existsSync(filePath)).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty files', () => {
      const emptyFile = path.join(TEST_DIR, 'empty.txt');
      fs.writeFileSync(emptyFile, '');

      expect(fs.readFileSync(emptyFile, 'utf-8')).toBe('');
      expect(fs.statSync(emptyFile).size).toBe(0);
    });

    it('handles very long filenames', () => {
      const maxNameLength = 255; // Most filesystems limit
      const longName = 'a'.repeat(maxNameLength - 4) + '.txt';
      const longPath = path.join(TEST_DIR, longName);

      fs.writeFileSync(longPath, 'content');
      expect(fs.existsSync(longPath)).toBe(true);
    });

    it('handles special characters in filenames', () => {
      const specialNames = [
        'file with spaces.txt',
        'file-with-dashes.txt',
        'file_with_underscores.txt',
        'file.multiple.dots.txt',
        "file'with'quotes.txt",
      ];

      for (const name of specialNames) {
        const filePath = path.join(TEST_DIR, name);
        fs.writeFileSync(filePath, 'content');
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('content');
      }
    });

    it('handles unicode filenames', () => {
      const unicodeNames = [
        '文件.txt',
        'файл.txt',
        'αρχείο.txt',
        '📄document.txt',
      ];

      for (const name of unicodeNames) {
        const filePath = path.join(TEST_DIR, name);
        try {
          fs.writeFileSync(filePath, 'content');
          expect(fs.existsSync(filePath)).toBe(true);
        } catch {
          // Some filesystems may not support certain unicode
        }
      }
    });

    it('handles symlinks correctly', () => {
      if (process.platform === 'win32') return;

      const realFile = path.join(TEST_DIR, 'real.txt');
      const symlink = path.join(TEST_DIR, 'link.txt');

      fs.writeFileSync(realFile, 'real content');
      fs.symlinkSync(realFile, symlink);

      expect(fs.readFileSync(symlink, 'utf-8')).toBe('real content');
      expect(fs.lstatSync(symlink).isSymbolicLink()).toBe(true);
    });
  });
});

describe('Security Benchmarks', () => {
  describe('Path Validation Performance', () => {
    it('BENCH: path traversal check performance', () => {
      const home = os.homedir();
      const testPaths = [
        path.join(home, 'Documents/file.txt'),
        path.join(home, '.config/settings.json'),
        '/etc/passwd',
        path.join(home, '../../../etc/passwd'),
        path.join(home, 'project/../../../etc/hosts'),
      ];

      const isWithinHome = (p: string): boolean => {
        const resolved = path.resolve(p);
        return resolved.startsWith(home + path.sep) || resolved === home;
      };

      const results = runMultipleTimes(() => {
        return measureTime(() => {
          for (let i = 0; i < 1000; i++) {
            for (const p of testPaths) {
              isWithinHome(p);
            }
          }
        });
      }, ITERATIONS);

      console.log(`\n🔒 Path Validation (5000 checks):`);
      console.log(`   Avg: ${results.avg.toFixed(3)}ms`);
      console.log(`   Per check: ${(results.avg / 5000 * 1000).toFixed(3)}μs`);

      // 5000 checks should complete in under 50ms
      expect(results.avg).toBeLessThan(50);
    });

    it('BENCH: input sanitization performance', () => {
      const inputs = [
        'normal input',
        '<script>alert("xss")</script>',
        '"; DROP TABLE users; --',
        '../../../etc/passwd',
        'file.txt\x00.jpg',
        'a'.repeat(10000),
      ];

      const sanitize = (input: string): string => {
        return input
          .replace(/[<>]/g, '')
          .replace(/\x00/g, '')
          .slice(0, 1000);
      };

      const results = runMultipleTimes(() => {
        return measureTime(() => {
          for (let i = 0; i < 1000; i++) {
            for (const input of inputs) {
              sanitize(input);
            }
          }
        });
      }, ITERATIONS);

      console.log(`\n🧹 Input Sanitization (6000 ops):`);
      console.log(`   Avg: ${results.avg.toFixed(3)}ms`);

      expect(results.avg).toBeLessThan(100);
    });
  });

  describe('Encryption/Hashing Performance', () => {
    it('BENCH: crypto operations (if used for API keys)', async () => {
      const crypto = await import('crypto');

      const testData = 'api-key-placeholder-12345678901234567890';

      const hashResults = runMultipleTimes(() => {
        return measureTime(() => {
          crypto.createHash('sha256').update(testData).digest('hex');
        });
      }, ITERATIONS * 10);

      console.log(`\n🔐 SHA-256 Hash:`);
      console.log(`   Avg: ${hashResults.avg.toFixed(4)}ms`);

      expect(hashResults.avg).toBeLessThan(1);
    });
  });
});
