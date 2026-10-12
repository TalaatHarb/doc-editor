import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { buildExtensions } from './index';
import { getSearchState } from './search';

function makeEditor(content: unknown) {
  return new Editor({
    extensions: buildExtensions({ highlightMergeFields: true }),
    content: content as never,
  });
}

const doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello hello HELLO world' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Dear ' },
        { type: 'mergeField', attrs: { key: 'customer.name' } },
      ],
    },
  ],
};

describe('Search extension', () => {
  it('finds case-insensitively by default and respects matchCase', () => {
    const editor = makeEditor(doc);
    editor.commands.setSearch({ query: 'hello' });
    expect(getSearchState(editor).matches).toHaveLength(3);
    editor.commands.setSearch({ matchCase: true });
    expect(getSearchState(editor).matches).toHaveLength(1);
  });

  it('supports regex and ignores invalid patterns', () => {
    const editor = makeEditor(doc);
    editor.commands.setSearch({ query: 'hel+o', regex: true });
    expect(getSearchState(editor).matches).toHaveLength(3);
    editor.commands.setSearch({ query: '(', regex: true });
    expect(getSearchState(editor).matches).toHaveLength(0);
  });

  it('replaces all matches', () => {
    const editor = makeEditor(doc);
    editor.commands.setSearch({ query: 'hello' });
    editor.commands.replaceAll('Hi');
    expect(editor.getText()).toContain('Hi Hi Hi world');
  });
});

describe('MergeField node', () => {
  it('inserts a merge field and renders text form', () => {
    const editor = makeEditor(doc);
    editor.commands.insertMergeField({ key: 'order.id' });
    expect(JSON.stringify(editor.getJSON())).toContain('order.id');
    expect(editor.getText()).toContain('{{customer.name}}');
  });
});
