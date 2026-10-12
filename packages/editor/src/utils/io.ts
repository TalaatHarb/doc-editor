import DOMPurify from 'dompurify';
import type { Editor } from '@tiptap/core';

export type ExportFormat = 'html' | 'txt' | 'json';

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function exportDocument(
  editor: Editor,
  title: string,
  format: ExportFormat,
): { blob: Blob; filename: string } {
  const base = title.trim().replace(/[\\/:*?"<>|]+/g, '-') || 'document';
  if (format === 'json') {
    return {
      blob: new Blob([JSON.stringify(editor.getJSON(), null, 2)], { type: 'application/json' }),
      filename: `${base}.json`,
    };
  }
  if (format === 'txt') {
    return {
      blob: new Blob([editor.getText({ blockSeparator: '\n' })], { type: 'text/plain' }),
      filename: `${base}.txt`,
    };
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${editor.getHTML()}</body></html>`;
  return { blob: new Blob([html], { type: 'text/html' }), filename: `${base}.html` };
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button'],
  });
}

export function textToHtml(text: string): string {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
}

/** Converts an imported file's text into content accepted by Tiptap's setContent. */
export function parseImport(filename: string, text: string): string | object {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || (parsed as { type?: unknown }).type !== 'doc') {
      throw new Error('This JSON file is not a document.');
    }
    return parsed;
  }
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(text)?.[1] ?? text;
    return sanitizeHtml(body);
  }
  if (lower.endsWith('.txt')) return textToHtml(text);
  throw new Error('Unsupported file type. Import .html, .txt or .json.');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
