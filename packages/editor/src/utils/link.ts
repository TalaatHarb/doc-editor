import type { Editor } from '@tiptap/core';

const SAFE_PROTOCOL = /^(https?:|mailto:|tel:|\/|#)/i;

/** Normalises user input into a link target; bare domains get `https://`. Returns null for unsafe schemes. */
export function normaliseLink(input: string): string | null {
  const value = input.trim();
  if (!value) return '';
  if (SAFE_PROTOCOL.test(value)) return value;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return null;
  return `https://${value}`;
}

/** Prompts for a URL and applies, updates or removes the link around the selection. */
export function promptForLink(editor: Editor): boolean {
  const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
  const input = window.prompt('Link URL (leave empty to remove)', previous);
  if (input === null) return true;
  const href = normaliseLink(input);
  const chain = editor.chain().focus().extendMarkRange('link');
  if (href === '') chain.unsetLink().run();
  else if (href) chain.setLink({ href }).run();
  return true;
}
