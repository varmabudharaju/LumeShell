import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('AI Service (Post-Fix)', () => {
  const aiServiceSrc = fs.readFileSync(
    path.join(__dirname, '../../../src/main/ai/ai-service.ts'),
    'utf-8'
  );

  it('chat prepends CHAT_SYSTEM_PROMPT to messages', () => {
    expect(aiServiceSrc).toContain('CHAT_SYSTEM_PROMPT');
    expect(aiServiceSrc).toContain("{ role: 'system', content: CHAT_SYSTEM_PROMPT }");
  });

  it('uses AbortController for request cancellation', () => {
    expect(aiServiceSrc).toContain('AbortController');
    expect(aiServiceSrc).toContain('abortController.signal');
    expect(aiServiceSrc).toContain('activeRequests');
  });

  it('has cancelChat method', () => {
    expect(aiServiceSrc).toContain('cancelChat(requestId: string)');
    expect(aiServiceSrc).toContain('controller.abort()');
  });

  it('explainCommand does not throw inside onError callback', () => {
    // Should use streamError variable, not throw
    expect(aiServiceSrc).toContain('streamError = error');
    // Check there's no `throw new Error(error)` in onError
    const onErrorSection = aiServiceSrc.match(/onError:.*?(?=\n\s*\})/s)?.[0] || '';
    expect(onErrorSection).not.toContain('throw new Error');
  });

  it('cleans up activeRequests in finally block', () => {
    expect(aiServiceSrc).toContain('finally');
    expect(aiServiceSrc).toContain('this.activeRequests.delete(requestId)');
  });

  it('testConnection returns false for unknown provider', () => {
    expect(aiServiceSrc).toContain('if (!provider) return false');
  });
});
