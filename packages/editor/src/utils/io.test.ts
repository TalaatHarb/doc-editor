import { describe, expect, it } from 'vitest';
import { parseImport, sanitizeHtml, textToHtml } from './io';

describe('import helpers', () => {
  it('strips scripts and event handlers from HTML', () => {
    const clean = sanitizeHtml('<p onclick="x()">Hi</p><script>alert(1)</script><img src=x onerror=alert(1)>');
    expect(clean).not.toMatch(/script|onclick|onerror/);
    expect(clean).toContain('Hi');
  });

  it('escapes plain text', () => {
    expect(textToHtml('a <b>\nc\n\nd')).toBe('<p>a &lt;b&gt;<br>c</p><p>d</p>');
  });

  it('rejects unsupported and malformed files', () => {
    expect(() => parseImport('x.exe', '')).toThrow(/Unsupported/);
    expect(() => parseImport('x.json', '{"a":1}')).toThrow(/not a document/);
    expect(parseImport('x.html', '<html><body><p>ok</p></body></html>')).toBe('<p>ok</p>');
  });
});
