import { describe, expect, it } from 'vitest';

import {
  CONNECTION_WITH_CREDENTIALS,
  scrubAssistantPayload,
  scrubAssistantText,
} from './assistant-privacy.js';

describe('SarvoAI best-effort privacy scrubbing', () => {
  it.each([
    ['person@example.invalid', '[REDACTED EMAIL]'],
    ['123456789V', '[REDACTED IDENTIFIER]'],
    ['123456789012', '[REDACTED IDENTIFIER]'],
    ['0771234567', '[REDACTED PHONE]'],
    ['+94 77 123 4567', '[REDACTED PHONE]'],
    ['password=fictional-only', '[REDACTED SECRET]'],
    ['postgresql://fixture:fixture@localhost/example', '[REDACTED CONNECTION]'],
    ['Bearer fictional-token', '[REDACTED TOKEN]'],
    ['AKIA' + 'A'.repeat(16), '[REDACTED TOKEN]'],
    ['eyJabc.def.ghi', '[REDACTED TOKEN]'],
  ])('redacts a synthetic sensitive value: %s', (text, replacement) => {
    expect(scrubAssistantText(text)).toBe(replacement);
  });

  it('preserves ordinary totals and society codes; does not claim to classify names', () => {
    expect(scrubAssistantText('TEST-A01: profit LKR 298,400; Fictional Person')).toBe('TEST-A01: profit LKR 298,400; Fictional Person');
  });

  it('scrubs nested strings without mutating the request or its schema structure', () => {
    const payload = { max_tokens: 2048, messages: [{ content: [{ type: 'tool_result', content: '{"email":"person@example.invalid"}' }] }] };
    const safe = scrubAssistantPayload(payload);
    expect(JSON.stringify(safe)).not.toContain('person@example.invalid');
    expect(JSON.stringify(payload)).toContain('person@example.invalid');
    expect(safe).toMatchObject({ max_tokens: 2048, messages: [{ content: [{ type: 'tool_result' }] }] });
  });

  describe('connection strings', () => {
    // The pattern before issue #191: any ':' and then any '@'. Kept here to prove the
    // linear pattern redacts exactly the same text.
    const previous = /\b(?:postgres(?:ql)?|https?):\/\/[^\s"<>]*:[^\s"<>]*@[^\s"<>]+/gi;
    const sameAsPrevious = (text: string) =>
      expect(text.replace(CONNECTION_WITH_CREDENTIALS, 'X')).toBe(text.replace(previous, 'X'));

    it.each([
      ['postgres://fixture:p@ss@localhost:5432/example?sslmode=require', '[REDACTED CONNECTION]'],
      ['see http://a:b:c@d:e@example.invalid/x then', 'see [REDACTED CONNECTION] then'],
      ['HTTPS://FIXTURE:FIXTURE@EXAMPLE.INVALID', '[REDACTED CONNECTION]'],
      ['"postgres://fixture:fixture@db.invalid/x" ok', '"[REDACTED CONNECTION]" ok'],
      ['https://example.invalid:8443/no-credentials', 'https://example.invalid:8443/no-credentials'],
    ])('redacts credentials in %s', (text, scrubbed) => {
      expect(scrubAssistantText(text)).toBe(scrubbed);
      sameAsPrevious(text);
    });

    it.each([
      'https://example.invalid/path:segment@part',
      'http://fixture@example.invalid/only-user',
      'http://fixture:@',
      'http://:@example.invalid',
      'http://a:b',
    ])('matches the previous pattern on the edge case %s', sameAsPrevious);

    it('matches the previous pattern on generated inputs', () => {
      const pieces = ['a', ':', '@', '/', ' ', '"', 'http://', 'postgres://'];
      let seed = 191;
      const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31);
      for (let i = 0; i < 2000; i += 1) {
        const length = 1 + (next() % 14);
        sameAsPrevious(Array.from({ length }, () => pieces[next() % pieces.length]).join(''));
      }
    });

    it('stays fast on long text that looks like a connection string but has no "@"', () => {
      const text = `http://${':'.repeat(100_000)}`;
      const started = performance.now();
      expect(scrubAssistantText(text)).toBe(text);
      expect(performance.now() - started).toBeLessThan(250);
    });
  });
});
