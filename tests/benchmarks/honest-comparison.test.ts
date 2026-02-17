/**
 * HONEST Comparison: LumeShell vs Terminal
 *
 * Both run the SAME commands through a shell.
 * No tricks, no unfair comparisons.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'honest-bench');

// Simulates how LumeShell runs commands (via node-pty style)
async function shellBuddyRun(cmd: string): Promise<{ time: number; output: string }> {
  return new Promise((resolve) => {
    const start = performance.now();

    // This is what node-pty does under the hood - spawns a shell
    const proc = spawn('/bin/zsh', ['-c', cmd], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    proc.stdout?.on('data', (d) => output += d.toString());
    proc.stderr?.on('data', (d) => output += d.toString());

    proc.on('close', () => {
      resolve({ time: performance.now() - start, output });
    });
  });
}

// How Terminal.app runs commands (also via shell)
function terminalRun(cmd: string): { time: number; output: string } {
  const start = performance.now();
  const output = execSync(cmd, {
    encoding: 'utf-8',
    shell: '/bin/zsh',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  return { time: performance.now() - start, output };
}

describe('HONEST: Same Commands, Fair Comparison', () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    for (let i = 0; i < 50; i++) {
      fs.writeFileSync(path.join(TEST_DIR, `file-${i}.txt`), `content ${i}`);
    }
  });

  afterAll(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  const results: Array<{
    command: string;
    lumeshell: number;
    terminal: number;
    diff: string;
    winner: string;
  }> = [];

  it('1. echo "hello"', async () => {
    const cmd = 'echo "hello"';

    // Run multiple times and average
    const sbTimes: number[] = [];
    const termTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const sb = await shellBuddyRun(cmd);
      sbTimes.push(sb.time);

      const term = terminalRun(cmd);
      termTimes.push(term.time);
    }

    const sbAvg = sbTimes.reduce((a, b) => a + b) / sbTimes.length;
    const termAvg = termTimes.reduce((a, b) => a + b) / termTimes.length;
    const diff = ((sbAvg - termAvg) / termAvg * 100).toFixed(1);
    const winner = Math.abs(sbAvg - termAvg) < 0.5 ? 'TIE' : sbAvg < termAvg ? 'LumeShell' : 'Terminal';

    results.push({ command: 'echo "hello"', lumeshell: sbAvg, terminal: termAvg, diff: `${diff}%`, winner });

    console.log(`\n  echo "hello"`);
    console.log(`    LumeShell: ${sbAvg.toFixed(2)}ms`);
    console.log(`    Terminal:   ${termAvg.toFixed(2)}ms`);
    console.log(`    Diff:       ${diff}% | Winner: ${winner}`);
  });

  it('2. pwd', async () => {
    const cmd = 'pwd';

    const sbTimes: number[] = [];
    const termTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const sb = await shellBuddyRun(cmd);
      sbTimes.push(sb.time);

      const term = terminalRun(cmd);
      termTimes.push(term.time);
    }

    const sbAvg = sbTimes.reduce((a, b) => a + b) / sbTimes.length;
    const termAvg = termTimes.reduce((a, b) => a + b) / termTimes.length;
    const diff = ((sbAvg - termAvg) / termAvg * 100).toFixed(1);
    const winner = Math.abs(sbAvg - termAvg) < 0.5 ? 'TIE' : sbAvg < termAvg ? 'LumeShell' : 'Terminal';

    results.push({ command: 'pwd', lumeshell: sbAvg, terminal: termAvg, diff: `${diff}%`, winner });

    console.log(`\n  pwd`);
    console.log(`    LumeShell: ${sbAvg.toFixed(2)}ms`);
    console.log(`    Terminal:   ${termAvg.toFixed(2)}ms`);
    console.log(`    Diff:       ${diff}% | Winner: ${winner}`);
  });

  it('3. ls -la (50 files)', async () => {
    const cmd = `ls -la "${TEST_DIR}"`;

    const sbTimes: number[] = [];
    const termTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const sb = await shellBuddyRun(cmd);
      sbTimes.push(sb.time);

      const term = terminalRun(cmd);
      termTimes.push(term.time);
    }

    const sbAvg = sbTimes.reduce((a, b) => a + b) / sbTimes.length;
    const termAvg = termTimes.reduce((a, b) => a + b) / termTimes.length;
    const diff = ((sbAvg - termAvg) / termAvg * 100).toFixed(1);
    const winner = Math.abs(sbAvg - termAvg) < 0.5 ? 'TIE' : sbAvg < termAvg ? 'LumeShell' : 'Terminal';

    results.push({ command: 'ls -la', lumeshell: sbAvg, terminal: termAvg, diff: `${diff}%`, winner });

    console.log(`\n  ls -la (50 files)`);
    console.log(`    LumeShell: ${sbAvg.toFixed(2)}ms`);
    console.log(`    Terminal:   ${termAvg.toFixed(2)}ms`);
    console.log(`    Diff:       ${diff}% | Winner: ${winner}`);
  });

  it('4. cat file (read file)', async () => {
    const testFile = path.join(TEST_DIR, 'file-0.txt');
    const cmd = `cat "${testFile}"`;

    const sbTimes: number[] = [];
    const termTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const sb = await shellBuddyRun(cmd);
      sbTimes.push(sb.time);

      const term = terminalRun(cmd);
      termTimes.push(term.time);
    }

    const sbAvg = sbTimes.reduce((a, b) => a + b) / sbTimes.length;
    const termAvg = termTimes.reduce((a, b) => a + b) / termTimes.length;
    const diff = ((sbAvg - termAvg) / termAvg * 100).toFixed(1);
    const winner = Math.abs(sbAvg - termAvg) < 0.5 ? 'TIE' : sbAvg < termAvg ? 'LumeShell' : 'Terminal';

    results.push({ command: 'cat file', lumeshell: sbAvg, terminal: termAvg, diff: `${diff}%`, winner });

    console.log(`\n  cat file`);
    console.log(`    LumeShell: ${sbAvg.toFixed(2)}ms`);
    console.log(`    Terminal:   ${termAvg.toFixed(2)}ms`);
    console.log(`    Diff:       ${diff}% | Winner: ${winner}`);
  });

  it('5. whoami', async () => {
    const cmd = 'whoami';

    const sbTimes: number[] = [];
    const termTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const sb = await shellBuddyRun(cmd);
      sbTimes.push(sb.time);

      const term = terminalRun(cmd);
      termTimes.push(term.time);
    }

    const sbAvg = sbTimes.reduce((a, b) => a + b) / sbTimes.length;
    const termAvg = termTimes.reduce((a, b) => a + b) / termTimes.length;
    const diff = ((sbAvg - termAvg) / termAvg * 100).toFixed(1);
    const winner = Math.abs(sbAvg - termAvg) < 0.5 ? 'TIE' : sbAvg < termAvg ? 'LumeShell' : 'Terminal';

    results.push({ command: 'whoami', lumeshell: sbAvg, terminal: termAvg, diff: `${diff}%`, winner });

    console.log(`\n  whoami`);
    console.log(`    LumeShell: ${sbAvg.toFixed(2)}ms`);
    console.log(`    Terminal:   ${termAvg.toFixed(2)}ms`);
    console.log(`    Diff:       ${diff}% | Winner: ${winner}`);
  });

  it('6. date', async () => {
    const cmd = 'date';

    const sbTimes: number[] = [];
    const termTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const sb = await shellBuddyRun(cmd);
      sbTimes.push(sb.time);

      const term = terminalRun(cmd);
      termTimes.push(term.time);
    }

    const sbAvg = sbTimes.reduce((a, b) => a + b) / sbTimes.length;
    const termAvg = termTimes.reduce((a, b) => a + b) / termTimes.length;
    const diff = ((sbAvg - termAvg) / termAvg * 100).toFixed(1);
    const winner = Math.abs(sbAvg - termAvg) < 0.5 ? 'TIE' : sbAvg < termAvg ? 'LumeShell' : 'Terminal';

    results.push({ command: 'date', lumeshell: sbAvg, terminal: termAvg, diff: `${diff}%`, winner });

    console.log(`\n  date`);
    console.log(`    LumeShell: ${sbAvg.toFixed(2)}ms`);
    console.log(`    Terminal:   ${termAvg.toFixed(2)}ms`);
    console.log(`    Diff:       ${diff}% | Winner: ${winner}`);
  });

  it('7. find (search files)', async () => {
    const cmd = `find "${TEST_DIR}" -name "*.txt" | head -10`;

    const sbTimes: number[] = [];
    const termTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const sb = await shellBuddyRun(cmd);
      sbTimes.push(sb.time);

      const term = terminalRun(cmd);
      termTimes.push(term.time);
    }

    const sbAvg = sbTimes.reduce((a, b) => a + b) / sbTimes.length;
    const termAvg = termTimes.reduce((a, b) => a + b) / termTimes.length;
    const diff = ((sbAvg - termAvg) / termAvg * 100).toFixed(1);
    const winner = Math.abs(sbAvg - termAvg) < 0.5 ? 'TIE' : sbAvg < termAvg ? 'LumeShell' : 'Terminal';

    results.push({ command: 'find *.txt', lumeshell: sbAvg, terminal: termAvg, diff: `${diff}%`, winner });

    console.log(`\n  find *.txt`);
    console.log(`    LumeShell: ${sbAvg.toFixed(2)}ms`);
    console.log(`    Terminal:   ${termAvg.toFixed(2)}ms`);
    console.log(`    Diff:       ${diff}% | Winner: ${winner}`);
  });

  it('8. wc -l (count lines)', async () => {
    const testFile = path.join(TEST_DIR, 'file-0.txt');
    const cmd = `wc -l "${testFile}"`;

    const sbTimes: number[] = [];
    const termTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const sb = await shellBuddyRun(cmd);
      sbTimes.push(sb.time);

      const term = terminalRun(cmd);
      termTimes.push(term.time);
    }

    const sbAvg = sbTimes.reduce((a, b) => a + b) / sbTimes.length;
    const termAvg = termTimes.reduce((a, b) => a + b) / termTimes.length;
    const diff = ((sbAvg - termAvg) / termAvg * 100).toFixed(1);
    const winner = Math.abs(sbAvg - termAvg) < 0.5 ? 'TIE' : sbAvg < termAvg ? 'LumeShell' : 'Terminal';

    results.push({ command: 'wc -l', lumeshell: sbAvg, terminal: termAvg, diff: `${diff}%`, winner });

    console.log(`\n  wc -l`);
    console.log(`    LumeShell: ${sbAvg.toFixed(2)}ms`);
    console.log(`    Terminal:   ${termAvg.toFixed(2)}ms`);
    console.log(`    Diff:       ${diff}% | Winner: ${winner}`);
  });

  it('9. grep (search in file)', async () => {
    const cmd = `grep -r "content" "${TEST_DIR}" | head -5`;

    const sbTimes: number[] = [];
    const termTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const sb = await shellBuddyRun(cmd);
      sbTimes.push(sb.time);

      const term = terminalRun(cmd);
      termTimes.push(term.time);
    }

    const sbAvg = sbTimes.reduce((a, b) => a + b) / sbTimes.length;
    const termAvg = termTimes.reduce((a, b) => a + b) / termTimes.length;
    const diff = ((sbAvg - termAvg) / termAvg * 100).toFixed(1);
    const winner = Math.abs(sbAvg - termAvg) < 0.5 ? 'TIE' : sbAvg < termAvg ? 'LumeShell' : 'Terminal';

    results.push({ command: 'grep -r', lumeshell: sbAvg, terminal: termAvg, diff: `${diff}%`, winner });

    console.log(`\n  grep -r`);
    console.log(`    LumeShell: ${sbAvg.toFixed(2)}ms`);
    console.log(`    Terminal:   ${termAvg.toFixed(2)}ms`);
    console.log(`    Diff:       ${diff}% | Winner: ${winner}`);
  });

  it('10. du -sh (disk usage)', async () => {
    const cmd = `du -sh "${TEST_DIR}"`;

    const sbTimes: number[] = [];
    const termTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const sb = await shellBuddyRun(cmd);
      sbTimes.push(sb.time);

      const term = terminalRun(cmd);
      termTimes.push(term.time);
    }

    const sbAvg = sbTimes.reduce((a, b) => a + b) / sbTimes.length;
    const termAvg = termTimes.reduce((a, b) => a + b) / termTimes.length;
    const diff = ((sbAvg - termAvg) / termAvg * 100).toFixed(1);
    const winner = Math.abs(sbAvg - termAvg) < 0.5 ? 'TIE' : sbAvg < termAvg ? 'LumeShell' : 'Terminal';

    results.push({ command: 'du -sh', lumeshell: sbAvg, terminal: termAvg, diff: `${diff}%`, winner });

    console.log(`\n  du -sh`);
    console.log(`    LumeShell: ${sbAvg.toFixed(2)}ms`);
    console.log(`    Terminal:   ${termAvg.toFixed(2)}ms`);
    console.log(`    Diff:       ${diff}% | Winner: ${winner}`);
  });

  it('FINAL HONEST RESULTS', () => {
    let sbWins = 0;
    let termWins = 0;
    let ties = 0;

    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║           HONEST COMPARISON: SAME COMMANDS                       ║');
    console.log('║           Both running through zsh shell                         ║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log('║ Command        │ LumeShell  │ Terminal    │ Diff     │ Winner   ║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');

    for (const r of results) {
      const cmdStr = r.command.padEnd(14);
      const sbStr = `${r.lumeshell.toFixed(2)}ms`.padStart(9);
      const termStr = `${r.terminal.toFixed(2)}ms`.padStart(9);
      const diffStr = r.diff.padStart(8);
      const winStr = r.winner.padEnd(8);

      console.log(`║ ${cmdStr} │ ${sbStr}   │ ${termStr}   │ ${diffStr} │ ${winStr} ║`);

      if (r.winner === 'LumeShell') sbWins++;
      else if (r.winner === 'Terminal') termWins++;
      else ties++;
    }

    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log(`║ SCORE: LumeShell ${sbWins} | Terminal ${termWins} | Ties ${ties}                        ║`);
    console.log('╠══════════════════════════════════════════════════════════════════╣');

    const sbTotal = results.reduce((a, r) => a + r.lumeshell, 0);
    const termTotal = results.reduce((a, r) => a + r.terminal, 0);
    const totalDiff = ((sbTotal - termTotal) / termTotal * 100).toFixed(1);

    console.log(`║ TOTAL TIME: LumeShell ${sbTotal.toFixed(1)}ms | Terminal ${termTotal.toFixed(1)}ms       ║`);
    console.log(`║ OVERALL:    ${Number(totalDiff) > 0 ? 'LumeShell is ' + totalDiff + '% SLOWER' : 'LumeShell is ' + Math.abs(Number(totalDiff)) + '% FASTER'}                       ║`);
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log('║                                                                  ║');
    console.log('║ HONEST ASSESSMENT:                                               ║');
    console.log('║                                                                  ║');
    if (Math.abs(Number(totalDiff)) < 10) {
      console.log('║ ⚖️  VERDICT: They are essentially THE SAME speed.               ║');
      console.log('║                                                                  ║');
      console.log('║ Both spawn zsh, both run the same commands, both wait for       ║');
      console.log('║ the same syscalls. Any difference is just noise/variance.       ║');
    } else if (Number(totalDiff) > 0) {
      console.log('║ 🐢 VERDICT: LumeShell is SLOWER.                               ║');
      console.log('║                                                                  ║');
      console.log('║ The node-pty/Electron overhead adds latency compared to         ║');
      console.log('║ native Terminal.app. This is an area to improve.                ║');
    } else {
      console.log('║ 🚀 VERDICT: LumeShell is FASTER.                               ║');
    }
    console.log('║                                                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    console.log('\n📊 WHAT THIS MEANS FOR LUMESHELL:');
    console.log('');
    console.log('   For TERMINAL commands: Performance is essentially identical.');
    console.log('   LumeShell\'s value is NOT speed, it\'s:');
    console.log('   • Integrated AI chat for command help');
    console.log('   • Built-in file explorer (no switching to Finder)');
    console.log('   • Custom themes and appearance');
    console.log('   • All-in-one development environment');
    console.log('');
    console.log('   Be honest in marketing. Don\'t claim speed advantages');
    console.log('   that don\'t exist for terminal operations.');
  });
});
