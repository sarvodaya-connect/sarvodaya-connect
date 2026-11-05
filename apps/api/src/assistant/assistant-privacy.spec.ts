import { describe, expect, it } from 'vitest';

import { scrubAssistantPayload, scrubAssistantText } from './assistant-privacy.js';

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
});
