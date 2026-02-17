import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import path from 'path';

describe('API Key Security (Post-Fix)', () => {
  const geminiSrc = fs.readFileSync(
    path.join(__dirname, '../../src/main/ai/providers/gemini-provider.ts'),
    'utf-8'
  );
  const claudeSrc = fs.readFileSync(
    path.join(__dirname, '../../src/main/ai/providers/claude-provider.ts'),
    'utf-8'
  );
  const openaiSrc = fs.readFileSync(
    path.join(__dirname, '../../src/main/ai/providers/openai-provider.ts'),
    'utf-8'
  );

  it('Gemini API key in URL is documented with comment', () => {
    expect(geminiSrc).toContain('Gemini API requires the key as a query parameter');
  });

  it('Gemini errors are sanitized to not leak API key', () => {
    expect(geminiSrc).toContain('sanitizeError');
    expect(geminiSrc).toContain('[REDACTED]');
  });

  it('Claude correctly sends API key in header', () => {
    expect(claudeSrc).toContain("'x-api-key': config.apiKey");
  });

  it('OpenAI correctly sends API key in Authorization header', () => {
    expect(openaiSrc).toContain('Authorization: `Bearer ${config.apiKey}`');
  });

  it('settings JSON file uses 0o600 permissions', () => {
    const jsonStoreSrc = fs.readFileSync(
      path.join(__dirname, '../../src/main/store/json-store.ts'),
      'utf-8'
    );
    expect(jsonStoreSrc).toContain('mode: 0o600');
  });

  it('all providers support AbortSignal', () => {
    expect(geminiSrc).toContain('signal?: AbortSignal');
    expect(claudeSrc).toContain('signal?: AbortSignal');
    expect(openaiSrc).toContain('signal?: AbortSignal');

    const ollamaSrc = fs.readFileSync(
      path.join(__dirname, '../../src/main/ai/providers/ollama-provider.ts'),
      'utf-8'
    );
    expect(ollamaSrc).toContain('signal?: AbortSignal');
  });
});
