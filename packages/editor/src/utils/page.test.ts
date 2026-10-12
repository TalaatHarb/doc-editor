import { describe, expect, it } from 'vitest';
import { cssContent, printPageCss, resolveTokens } from './page';

describe('page helpers', () => {
  it('builds CSS content with counters and escapes quotes', () => {
    expect(cssContent('Page {page} of {pages}')).toBe(
      '"Page " counter(page) " of " counter(pages)',
    );
    expect(cssContent('a"b')).toBe('"a\\"b"');
    expect(cssContent('')).toBe('""');
  });

  it('resolves tokens for on-screen display', () => {
    expect(resolveTokens('{page}/{pages}', 1, 3)).toBe('1/3');
  });

  it('emits margin boxes only when set', () => {
    const css = printPageCss(
      210,
      297,
      { top: 20, right: 20, bottom: 20, left: 20 },
      undefined,
      'x',
    );
    expect(css).toContain('@bottom-center');
    expect(css).not.toContain('@top-center');
  });
});
