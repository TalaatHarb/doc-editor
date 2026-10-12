import { describe, expect, it } from 'vitest';
import { normaliseLink } from './link';

describe('normaliseLink', () => {
  it('keeps safe links and adds https to bare domains', () => {
    expect(normaliseLink('https://a.com')).toBe('https://a.com');
    expect(normaliseLink('mailto:x@y.z')).toBe('mailto:x@y.z');
    expect(normaliseLink(' example.com ')).toBe('https://example.com');
    expect(normaliseLink('')).toBe('');
  });

  it('rejects script and data URLs', () => {
    expect(normaliseLink('javascript:alert(1)')).toBeNull();
    expect(normaliseLink('data:text/html,x')).toBeNull();
  });
});
