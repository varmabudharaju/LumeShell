import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Shell Detector (Post-Fix)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../../../src/main/terminal/shell-detector.ts'),
    'utf-8'
  );

  it('uses execFileSync with argument array (no shell injection)', () => {
    expect(src).toContain("execFileSync('dscl', ['.', '-read'");
    expect(src).not.toContain('execSync(');
  });

  it('uses os.userInfo().username (not env var)', () => {
    expect(src).toContain('os.userInfo().username');
    expect(src).not.toContain('process.env.USER');
  });

  it('validates shell path exists with existsSync', () => {
    expect(src).toContain('existsSync(shell)');
  });

  it('has fallback to /bin/zsh then /bin/bash', () => {
    expect(src).toContain("'/bin/zsh'");
    expect(src).toContain("'/bin/bash'");
  });
});
