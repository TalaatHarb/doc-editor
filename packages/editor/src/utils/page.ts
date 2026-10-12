/** Converts "Page {page} of {pages}" into a CSS `content` value using counters. */
export function cssContent(template: string): string {
  const parts = template.split(/(\{page\}|\{pages\})/g).filter((part) => part !== '');
  if (parts.length === 0) return '""';
  return parts
    .map((part) =>
      part === '{page}'
        ? 'counter(page)'
        : part === '{pages}'
          ? 'counter(pages)'
          : `"${part.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`,
    )
    .join(' ');
}

export function resolveTokens(template: string, page: number, pages: number): string {
  return template.replace(/\{page\}/g, String(page)).replace(/\{pages\}/g, String(pages));
}

export function printPageCss(
  width: number,
  height: number,
  margins: { top: number; right: number; bottom: number; left: number },
  header?: string,
  footer?: string,
): string {
  const boxes = [
    header ? `@top-center { content: ${cssContent(header)}; font: 9pt sans-serif; color: #555; }` : '',
    footer ? `@bottom-center { content: ${cssContent(footer)}; font: 9pt sans-serif; color: #555; }` : '',
  ].join(' ');
  return `@media print { @page { size: ${width}mm ${height}mm; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; ${boxes} } }`;
}
