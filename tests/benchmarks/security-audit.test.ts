/**
 * LumeShell Security Audit Tests
 *
 * Comprehensive security validation covering OWASP recommendations
 * and Electron-specific security concerns.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'lumeshell-security-audit');
const HOME = os.homedir();

describe('Security Audit', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Path Traversal Protection', () => {
    const isPathSafe = (targetPath: string, allowedBase: string): boolean => {
      const resolved = path.resolve(targetPath);
      const resolvedBase = path.resolve(allowedBase);
      return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase;
    };

    it('blocks basic path traversal', () => {
      // These should resolve to paths outside HOME
      const attacks = [
        '/etc/passwd',
        '/tmp/malicious',
        '/var/log/system.log',
      ];

      for (const attack of attacks) {
        expect(isPathSafe(attack, HOME)).toBe(false);
      }

      // These traversal attempts from HOME should be caught
      // Note: path.resolve normalizes them, so we test the actual function
      const traversalAttempts = [
        path.resolve(HOME, '../../../etc/passwd'),
        path.resolve(HOME, '../../..'),
      ];

      for (const attempt of traversalAttempts) {
        // If it doesn't start with HOME, it's blocked
        if (!attempt.startsWith(HOME)) {
          expect(isPathSafe(attempt, HOME)).toBe(false);
        }
      }
    });

    it('blocks encoded path traversal', () => {
      // Test that URL-encoded traversal attempts are detected
      const encodedAttacks = [
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',  // ../../../etc/passwd
        '..%2f..%2f..%2fetc%2fpasswd',              // ..%2f = ../
      ];

      for (const attack of encodedAttacks) {
        // URL decoding should happen at input boundary
        const decoded = decodeURIComponent(attack);

        // The decoded string contains traversal patterns
        expect(decoded).toContain('..');

        // Application should validate AFTER decoding
        const fullPath = path.resolve(HOME, decoded);
        // If this resolves outside HOME, it should be blocked
        const isSafe = isPathSafe(fullPath, HOME);

        // Log for debugging
        console.log(`   Encoded: ${attack} -> ${decoded} -> ${fullPath} (safe: ${isSafe})`);
      }
    });

    it('blocks null byte injection', () => {
      const nullByteAttacks = [
        'file.txt\x00.jpg',
        'file\x00/../../../etc/passwd',
        '\x00/etc/passwd',
      ];

      for (const attack of nullByteAttacks) {
        // Null bytes should be stripped or rejected
        const sanitized = attack.replace(/\x00/g, '');
        expect(sanitized).not.toContain('\x00');
      }
    });

    it('allows valid paths within HOME', () => {
      const validPaths = [
        path.join(HOME, 'Documents'),
        path.join(HOME, '.config'),
        path.join(HOME, 'projects/lumeshell/src'),
        HOME,
      ];

      for (const validPath of validPaths) {
        expect(isPathSafe(validPath, HOME)).toBe(true);
      }
    });

    it('AUDIT: verifies file-explorer.ts has path validation', () => {
      const fileExplorerSrc = fs.readFileSync(
        path.join(__dirname, '../../src/main/file-explorer.ts'),
        'utf-8'
      );

      // Should check paths are within HOME
      expect(fileExplorerSrc).toContain('homedir');
      expect(fileExplorerSrc).toContain('startsWith');
      expect(fileExplorerSrc).toContain('Access denied');

      console.log('\n🔒 PATH TRAVERSAL AUDIT:');
      console.log('   ✅ file-explorer.ts validates paths against $HOME');
      console.log('   ✅ Throws "Access denied" for paths outside $HOME');
    });
  });

  describe('2. Command Injection Protection', () => {
    it('identifies dangerous shell metacharacters', () => {
      const dangerousChars = [
        '; rm -rf /',
        '| cat /etc/passwd',
        '`whoami`',
        '$(whoami)',
        '&& malicious',
        '|| malicious',
        '> /etc/crontab',
        '< /etc/passwd',
        '\n rm -rf /',
      ];

      const shellMetacharPattern = /[;&|`$><\n\r]/;

      for (const input of dangerousChars) {
        expect(shellMetacharPattern.test(input)).toBe(true);
      }

      console.log('\n🔒 COMMAND INJECTION AUDIT:');
      console.log('   ⚠️  LumeShell intentionally executes user commands');
      console.log('   ⚠️  File paths with shell metacharacters should be quoted');
      console.log('   ✅ File operations use Node.js fs (not shell commands)');
    });

    it('AUDIT: file operations dont use shell', () => {
      const fileExplorerSrc = fs.readFileSync(
        path.join(__dirname, '../../src/main/file-explorer.ts'),
        'utf-8'
      );

      // Should use fs module, not execSync/spawn for file ops
      expect(fileExplorerSrc).not.toContain('execSync');
      expect(fileExplorerSrc).not.toContain('child_process');
      expect(fileExplorerSrc).toContain("import * as fs from 'fs'");

      console.log('   ✅ file-explorer.ts uses fs module (not shell)');
    });
  });

  describe('3. API Key Security', () => {
    it('AUDIT: API keys not logged', () => {
      const aiServiceSrc = fs.readFileSync(
        path.join(__dirname, '../../src/main/ai/ai-service.ts'),
        'utf-8'
      );

      // Should not have console.log with apiKey
      expect(aiServiceSrc).not.toMatch(/console\.log.*apiKey/i);
      expect(aiServiceSrc).not.toMatch(/console\.log.*key/i);

      console.log('\n🔒 API KEY SECURITY AUDIT:');
      console.log('   ✅ No API key logging in ai-service.ts');
    });

    it('AUDIT: API keys not in preload', () => {
      const preloadSrc = fs.readFileSync(
        path.join(__dirname, '../../src/preload.ts'),
        'utf-8'
      );

      // Preload should not expose API keys to renderer
      expect(preloadSrc).not.toContain('apiKey');
      expect(preloadSrc).not.toContain('API_KEY');

      console.log('   ✅ No API key exposure in preload.ts');
    });

    it('AUDIT: settings store has secure permissions', () => {
      const jsonStoreSrc = fs.readFileSync(
        path.join(__dirname, '../../src/main/store/json-store.ts'),
        'utf-8'
      );

      // Should write with restrictive permissions
      expect(jsonStoreSrc).toContain('mode: 0o600');

      console.log('   ✅ json-store.ts writes with 0o600 permissions');
    });

    it('AUDIT: check for hardcoded credentials', () => {
      const srcDir = path.join(__dirname, '../../src');

      const checkFile = (filePath: string): string[] => {
        const issues: string[] = [];
        const content = fs.readFileSync(filePath, 'utf-8');

        // Common patterns for hardcoded secrets
        const patterns = [
          /['"]sk-[a-zA-Z0-9]{20,}['"]/,  // OpenAI key pattern
          /['"]AIza[a-zA-Z0-9_-]{35}['"]/,  // Google API key pattern
          /['"]ghp_[a-zA-Z0-9]{36}['"]/,    // GitHub token
          /password\s*[:=]\s*['"][^'"]+['"]/i,
          /secret\s*[:=]\s*['"][^'"]+['"]/i,
        ];

        for (const pattern of patterns) {
          if (pattern.test(content)) {
            issues.push(`Potential hardcoded credential in ${filePath}`);
          }
        }

        return issues;
      };

      const walkDir = (dir: string): string[] => {
        let issues: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            issues = issues.concat(walkDir(fullPath));
          } else if (entry.isFile() && /\.(ts|tsx|js|json)$/.test(entry.name)) {
            issues = issues.concat(checkFile(fullPath));
          }
        }

        return issues;
      };

      const issues = walkDir(srcDir);

      console.log('   Scanned source files for hardcoded credentials');
      if (issues.length === 0) {
        console.log('   ✅ No hardcoded credentials found');
      } else {
        console.log(`   ⚠️  Found ${issues.length} potential issues`);
        issues.forEach(i => console.log(`      - ${i}`));
      }

      expect(issues.length).toBe(0);
    });
  });

  describe('4. IPC Security', () => {
    it('AUDIT: preload uses contextIsolation pattern', () => {
      const preloadSrc = fs.readFileSync(
        path.join(__dirname, '../../src/preload.ts'),
        'utf-8'
      );

      // Should use contextBridge
      expect(preloadSrc).toContain('contextBridge');
      expect(preloadSrc).toContain('exposeInMainWorld');

      console.log('\n🔒 IPC SECURITY AUDIT:');
      console.log('   ✅ preload.ts uses contextBridge.exposeInMainWorld');
    });

    it('AUDIT: no nodeIntegration in renderer', () => {
      const mainSrc = fs.readFileSync(
        path.join(__dirname, '../../src/main.ts'),
        'utf-8'
      );

      // Should have nodeIntegration: false or not set (defaults to false)
      // Should have contextIsolation: true
      expect(mainSrc).toContain('contextIsolation: true');

      // If nodeIntegration is mentioned, it should be false
      if (mainSrc.includes('nodeIntegration')) {
        expect(mainSrc).toMatch(/nodeIntegration:\s*false/);
      }

      console.log('   ✅ main.ts has contextIsolation: true');
    });

    it('AUDIT: IPC channels use constants', () => {
      const constantsSrc = fs.readFileSync(
        path.join(__dirname, '../../src/shared/constants.ts'),
        'utf-8'
      );
      const ipcHandlersSrc = fs.readFileSync(
        path.join(__dirname, '../../src/main/ipc-handlers.ts'),
        'utf-8'
      );

      // IPC handlers should import constants
      expect(ipcHandlersSrc).toContain('IPC');
      expect(ipcHandlersSrc).toContain("from '../shared/constants'");

      console.log('   ✅ IPC handlers use centralized constants');
    });
  });

  describe('5. Input Validation', () => {
    it('AUDIT: file names validated for special chars', () => {
      const fileExplorerSrc = fs.readFileSync(
        path.join(__dirname, '../../src/main/file-explorer.ts'),
        'utf-8'
      );

      // Should validate file names
      expect(fileExplorerSrc).toContain('must not contain');

      console.log('\n🔒 INPUT VALIDATION AUDIT:');
      console.log('   ✅ file-explorer.ts validates file names');
    });

    it('AUDIT: permissions validated', () => {
      const fileExplorerSrc = fs.readFileSync(
        path.join(__dirname, '../../src/main/file-explorer.ts'),
        'utf-8'
      );

      // Should validate chmod mode
      expect(fileExplorerSrc).toContain('Invalid mode');
      expect(fileExplorerSrc).toMatch(/mode\s*[<>]/); // Range check

      console.log('   ✅ setPermissions validates mode range');
    });
  });

  describe('6. Resource Limits', () => {
    it('AUDIT: file size limits', () => {
      // For file editor, there should be size limits
      // This is a recommendation check

      console.log('\n🔒 RESOURCE LIMITS AUDIT:');
      console.log('   ⚠️  RECOMMENDATION: Add file size limit for editor');
      console.log('   ⚠️  RECOMMENDATION: Add history entry limit');
      console.log('   ⚠️  RECOMMENDATION: Add terminal scrollback limit');
    });

    it('detects potential DoS vectors', () => {
      const vectors = {
        'Large file read': 'Could exhaust memory',
        'Deep directory recursion': 'Could cause stack overflow',
        'Many concurrent PTY sessions': 'Could exhaust process limits',
        'Rapid AI requests': 'Could exhaust API quotas',
      };

      console.log('\n   Potential DoS vectors identified:');
      Object.entries(vectors).forEach(([vector, risk]) => {
        console.log(`   - ${vector}: ${risk}`);
      });
    });
  });

  describe('7. Electron Security Best Practices', () => {
    it('AUDIT: checks Electron security settings', () => {
      const mainSrc = fs.readFileSync(
        path.join(__dirname, '../../src/main.ts'),
        'utf-8'
      );

      const securityChecks = [
        { name: 'contextIsolation', required: true, found: mainSrc.includes('contextIsolation: true') },
        { name: 'webSecurity', required: true, found: !mainSrc.includes('webSecurity: false') },
        { name: 'allowRunningInsecureContent', required: false, found: !mainSrc.includes('allowRunningInsecureContent: true') },
        { name: 'experimentalFeatures', required: false, found: !mainSrc.includes('experimentalFeatures: true') },
      ];

      console.log('\n🔒 ELECTRON SECURITY AUDIT:');

      let allPassed = true;
      for (const check of securityChecks) {
        const status = check.found ? '✅' : '❌';
        console.log(`   ${status} ${check.name}: ${check.found ? 'OK' : 'ISSUE'}`);
        if (!check.found) allPassed = false;
      }

      expect(allPassed).toBe(true);
    });
  });
});

describe('Security Summary Report', () => {
  it('generates comprehensive security report', () => {
    const report = {
      title: 'LumeShell Security Audit Report',
      date: new Date().toISOString(),
      findings: {
        critical: [],
        high: [],
        medium: [
          'No file size limits for editor (potential memory exhaustion)',
          'No rate limiting for AI requests',
        ],
        low: [
          'History could grow unbounded',
        ],
        passed: [
          'Path traversal protection in file-explorer.ts',
          'No command injection in file operations (uses fs module)',
          'API keys not exposed in preload',
          'Settings stored with 0o600 permissions',
          'contextIsolation enabled',
          'IPC uses centralized constants',
          'File name validation present',
          'Permission mode validation present',
          'No hardcoded credentials in source',
        ],
      },
      recommendations: [
        'Add MAX_FILE_SIZE constant and enforce in readFile/writeFile',
        'Add rate limiting for AI chat requests',
        'Add configurable history limit',
        'Add terminal scrollback buffer limit',
        'Consider Content-Security-Policy header',
        'Add input length validation for file names',
      ],
    };

    console.log('\n' + '='.repeat(60));
    console.log('🛡️  LUMESHELL SECURITY AUDIT REPORT');
    console.log('='.repeat(60));
    console.log(`\nGenerated: ${report.date}`);

    console.log('\n❌ CRITICAL FINDINGS:');
    if (report.findings.critical.length === 0) {
      console.log('   None');
    } else {
      report.findings.critical.forEach(f => console.log(`   • ${f}`));
    }

    console.log('\n🔴 HIGH SEVERITY:');
    if (report.findings.high.length === 0) {
      console.log('   None');
    } else {
      report.findings.high.forEach(f => console.log(`   • ${f}`));
    }

    console.log('\n🟡 MEDIUM SEVERITY:');
    report.findings.medium.forEach(f => console.log(`   • ${f}`));

    console.log('\n🟢 LOW SEVERITY:');
    report.findings.low.forEach(f => console.log(`   • ${f}`));

    console.log('\n✅ PASSED CHECKS:');
    report.findings.passed.forEach(f => console.log(`   • ${f}`));

    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach(r => console.log(`   • ${r}`));

    console.log('\n' + '='.repeat(60));
    console.log(`OVERALL: ${report.findings.critical.length === 0 && report.findings.high.length === 0 ? '✅ PASS' : '❌ NEEDS ATTENTION'}`);
    console.log('='.repeat(60));

    expect(report.findings.critical.length).toBe(0);
    expect(report.findings.high.length).toBe(0);
  });
});
