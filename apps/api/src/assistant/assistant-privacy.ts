/** Best-effort text scrubbing, in addition to database field allowlists.
 * This is not a general PII classifier: arbitrary unlabelled secrets cannot be
 * reliably recognized. Initial TEST use is restricted to fictional records.
 */
export function scrubAssistantText(value: string): string {
  return value
    .replace(/\b(?:postgres(?:ql)?|https?):\/\/[^\s"<>]*:[^\s"<>]*@[^\s"<>]+/gi, '[REDACTED CONNECTION]')
    .replace(/\b(?:Bearer\s+\S+|(?:AKIA|ASIA)[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/gi, '[REDACTED TOKEN]')
    .replace(/\b(?:password|passwd|secret|api[_ -]?key|access[_ -]?token)\s*[:=]\s*[^\s,;]+/gi, '[REDACTED SECRET]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]')
    .replace(/\b(?:\d{9}[vVxX]|\d{12})\b/g, '[REDACTED IDENTIFIER]')
    .replace(/(?:\+\d[\d ()-]{7,}\d|\b0\d{9}\b)/g, '[REDACTED PHONE]');
}
